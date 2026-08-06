import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/service/embedding.service.js", () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
  },
}));

vi.mock("../../src/respository/board.repository.js", () => ({
  boardRepository: {
    searchSimilarNotes: vi.fn(),
  },
}));

const { embeddingService } = await import("../../src/service/embedding.service.js");
const { boardRepository } = await import("../../src/respository/board.repository.js");
const { chatService } = await import("../../src/service/chat.service.js");

describe("chatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});