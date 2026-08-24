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
const { chatService } = await import("../../src/service/chat.service.js");

const completion = (content: string) => ({
  choices: [{ message: { content } }],
});

describe("chatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = "test-key";
  });

  describe("chat", () => {
    it("should throw when GROQ_API_KEY is not configured", async () => {
      process.env.GROQ_API_KEY = "";
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2]);
      vi.mocked(boardRepository.searchSimilarNotes).mockResolvedValue([]);

      await expect(chatService.chat("Hello", [])).rejects.toThrow(
        "GROQ_API_KEY is not configured in environment variables"
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

      const result = await chatService.chat("give me the summary of the notes board", []);

      expect(boardRepository.getAllNotes).toHaveBeenCalledTimes(1);
      expect(boardRepository.searchSimilarNotes).not.toHaveBeenCalled();
      expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
      expect(result.answer).toBe("Here is the summary of your notes.");
      expect(result.sources).toEqual([
        { id: 1, description: "Buy groceries", similarity: 1 },
        { id: 2, description: "Book a flight", similarity: 1 },
      ]);
    });

    it("should accept a fenced-JSON broad rewrite", async () => {
      mockClient.chat.completions.create
        .mockResolvedValueOnce(
          completion("```json\n{\"query\": \"board\", \"type\": \"broad\"}\n```")
        )
        .mockResolvedValueOnce(completion("Summary."));

      vi.mocked(boardRepository.getAllNotes).mockResolvedValue([
        { id: 5, description: "Note X" },
      ]);

      await chatService.chat("what's on the board", []);

      expect(boardRepository.getAllNotes).toHaveBeenCalledTimes(1);
      expect(boardRepository.searchSimilarNotes).not.toHaveBeenCalled();
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

      const result = await chatService.chat("what can i buy", []);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith("buy shopping groceries");
      expect(boardRepository.searchSimilarNotes).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        undefined,
        "buy shopping groceries"
      );
      expect(boardRepository.getAllNotes).not.toHaveBeenCalled();
      expect(result.answer).toBe("You have a grocery task.");
    });

    it("should fall back to specific search when the rewrite is not valid JSON", async () => {
      mockClient.chat.completions.create
        .mockResolvedValueOnce(completion("summary board"))
        .mockResolvedValueOnce(completion("No relevant notes."));

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1]);
      vi.mocked(boardRepository.searchSimilarNotes).mockResolvedValue([]);

      await chatService.chat("give me the summary of the notes board", []);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        "give me the summary of the notes board"
      );
      expect(boardRepository.searchSimilarNotes).toHaveBeenCalledTimes(1);
      expect(boardRepository.getAllNotes).not.toHaveBeenCalled();
    });
  });
});
