import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/service/embedding.service.js", () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
  },
}));

vi.mock("../../src/respository/board.repository.js", () => ({
  boardRepository: {
    searchSimilarNotes: vi.fn(),
    getAllNotes: vi.fn(),
  },
}));

vi.mock("../../src/respository/chat.repository.js", () => ({
  chatRepository: {
    createMessage: vi.fn(),
    getMessagesByIp: vi.fn(),
    deleteAllByIp: vi.fn(),
  },
}));

const mockClient: any = {
  chat: { completions: { create: vi.fn() } },
};

vi.mock("groq-sdk", () => ({
  Groq: class {
    constructor() {
      return mockClient;
    }
  },
}));

const { embeddingService } = await import("../../src/service/embedding.service.js");
const { boardRepository } = await import("../../src/respository/board.repository.js");
const { chatRepository } = await import("../../src/respository/chat.repository.js");
const { chatService } = await import("../../src/service/chat.service.js");
const { encrypt } = await import("../../util/crypto.js");

const completion = (content: string) => ({
  choices: [{ message: { content } }],
});

const IP = "192.168.1.1";

function storedMessage(
  role: "user" | "assistant",
  content: string,
  overrides: Partial<any> = {}
) {
  const enc = encrypt(content);
  return {
    id: Math.floor(Math.random() * 10000),
    ipAddress: IP,
    role,
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    tag: enc.tag,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("chatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = "test-key";
    process.env.CHAT_ENCRYPTION_KEY = "a".repeat(64);
    vi.mocked(chatRepository.getMessagesByIp).mockResolvedValue([]);
    vi.mocked(chatRepository.createMessage).mockResolvedValue({} as any);
    vi.mocked(chatRepository.deleteAllByIp).mockResolvedValue({ count: 0 });
  });

  describe("chat", () => {
    it("should throw when GROQ_API_KEY is not configured", async () => {
      process.env.GROQ_API_KEY = "";
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2]);
      vi.mocked(boardRepository.searchSimilarNotes).mockResolvedValue([]);

      await expect(chatService.chat("Hello", IP)).rejects.toThrow(
        "GROQ_API_KEY is not configured in environment variables"
      );
    });

    it("should throw when question is missing or empty", async () => {
      await expect(chatService.chat("", IP)).rejects.toThrow("VALIDATION_ERROR");
      await expect(chatService.chat("   ", IP)).rejects.toThrow("VALIDATION_ERROR");
    });

    it("should throw when question is too long", async () => {
      await expect(chatService.chat("a".repeat(501), IP)).rejects.toThrow(
        "VALIDATION_ERROR"
      );
    });

    it("should throw when ipAddress is invalid", async () => {
      await expect(chatService.chat("Hello", "")).rejects.toThrow("VALIDATION_ERROR");
      await expect(chatService.chat("Hello", "unknown")).rejects.toThrow("VALIDATION_ERROR");
      await expect(chatService.chat("Hello", undefined as any)).rejects.toThrow(
        "VALIDATION_ERROR"
      );
    });

    it("should use the full board when the rewrite classifies the query as broad", async () => {
      mockClient.chat.completions.create
        .mockResolvedValueOnce(
          completion(JSON.stringify({ query: "summary board", type: "broad" }))
        )
        .mockResolvedValueOnce(completion("Here is the summary of your notes."));

      vi.mocked(boardRepository.getAllNotes).mockResolvedValue([
        { id: 1, description: "Buy groceries" },
        { id: 2, description: "Book a flight" },
      ]);

      const result = await chatService.chat("give me the summary of the notes board", IP);

      expect(boardRepository.getAllNotes).toHaveBeenCalledTimes(1);
      expect(boardRepository.searchSimilarNotes).not.toHaveBeenCalled();
      expect(result.answer).toBe("Here is the summary of your notes.");
      expect(result.sources).toEqual([
        { id: 1, description: "Buy groceries", similarity: 1 },
        { id: 2, description: "Book a flight", similarity: 1 },
      ]);
    });

    it("should use semantic search when the rewrite classifies the query as specific", async () => {
      mockClient.chat.completions.create
        .mockResolvedValueOnce(
          completion(JSON.stringify({ query: "buy shopping groceries", type: "specific" }))
        )
        .mockResolvedValueOnce(completion("You have a grocery task."));

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
      vi.mocked(boardRepository.searchSimilarNotes).mockResolvedValue([
        { id: 1, description: "Buy groceries", similarity: 0.9 },
      ]);

      const result = await chatService.chat("what can i buy", IP);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith("buy shopping groceries");
      expect(boardRepository.searchSimilarNotes).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        undefined,
        "buy shopping groceries"
      );
      expect(result.answer).toBe("You have a grocery task.");
    });

    it("should persist the user and assistant messages encrypted at rest", async () => {
      mockClient.chat.completions.create
        .mockResolvedValueOnce(
          completion(JSON.stringify({ query: "board", type: "broad" }))
        )
        .mockResolvedValueOnce(completion("Summary."));

      vi.mocked(boardRepository.getAllNotes).mockResolvedValue([
        { id: 1, description: "Note X" },
      ]);

      await chatService.chat("what's on the board", IP);

      expect(chatRepository.createMessage).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(chatRepository.createMessage).mock.calls;
      expect(calls[0][0]).toMatchObject({ ipAddress: IP, role: "user" });
      expect(calls[1][0]).toMatchObject({ ipAddress: IP, role: "assistant" });
      // Must be encrypted, not stored as plaintext.
      expect(calls[0][0].ciphertext).not.toContain("what's on the board");
      expect(typeof calls[0][0].iv).toBe("string");
      expect(typeof calls[0][0].tag).toBe("string");
    });

    it("should derive AI history from the server's stored encrypted messages", async () => {
      vi.mocked(chatRepository.getMessagesByIp).mockResolvedValue([
        storedMessage("user", "prior question"),
        storedMessage("assistant", "prior answer"),
      ]);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(
          completion(JSON.stringify({ query: "board", type: "broad" }))
        )
        .mockResolvedValueOnce(completion("Summary."));

      vi.mocked(boardRepository.getAllNotes).mockResolvedValue([
        { id: 1, description: "Note X" },
      ]);

      await chatService.chat("what's next", IP);

      // Second completion call is the generation; it must include the decrypted history.
      const genCall = vi.mocked(mockClient.chat.completions.create).mock.calls[1][0];
      const genMessages = genCall.messages as { role: string; content: string }[];
      expect(genMessages.some((m) => m.content === "prior question")).toBe(true);
      expect(genMessages.some((m) => m.content === "prior answer")).toBe(true);
      // The persisted store must never contain the plaintext history.
      const persistArgs = vi.mocked(chatRepository.createMessage).mock.calls.map(
        (c) => c[0].ciphertext
      );
      expect(persistArgs.some((c) => c.includes("prior question"))).toBe(false);
    });
  });

  describe("getMessages", () => {
    it("should return decrypted, human-readable messages for the IP", async () => {
      vi.mocked(chatRepository.getMessagesByIp).mockResolvedValue([
        storedMessage("user", "hello there"),
        storedMessage("assistant", "hi!"),
      ]);

      const result = await chatService.getMessages(IP);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ role: "user", content: "hello there" });
      expect(result[1]).toMatchObject({ role: "assistant", content: "hi!" });
      expect(typeof result[0].id).toBe("string");
      expect(typeof result[0].timestamp).toBe("number");
      expect(chatRepository.getMessagesByIp).toHaveBeenCalledWith(IP);
    });

    it("should throw on invalid IP", async () => {
      await expect(chatService.getMessages("unknown")).rejects.toThrow("VALIDATION_ERROR");
    });
  });

  describe("clearMessages", () => {
    it("should delete all messages for the IP", async () => {
      await chatService.clearMessages(IP);
      expect(chatRepository.deleteAllByIp).toHaveBeenCalledWith(IP);
    });

    it("should throw on invalid IP", async () => {
      await expect(chatService.clearMessages("")).rejects.toThrow("VALIDATION_ERROR");
    });
  });
});

