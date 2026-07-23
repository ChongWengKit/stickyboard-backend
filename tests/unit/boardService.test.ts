import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/service/embeddingService.js", () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
  },
}));

vi.mock("../../util/chunking.js", () => ({
  chunkText: vi.fn(),
}));

vi.mock("../../src/respository/boardRepository.js", () => ({
  boardRepository: {
    getBoard: vi.fn(),
    getNoteIds: vi.fn(),
    countNotesByIp: vi.fn(),
    addNote: vi.fn(),
    insertChunks: vi.fn(),
    deleteChunksByNoteIds: vi.fn(),
    deleteChunksByNoteId: vi.fn(),
    deleteAllChunks: vi.fn(),
    deleteNotesByIds: vi.fn(),
    deleteAllNotes: vi.fn(),
    updateBoardBackground: vi.fn(),
    updateBoardBackgroundAndDeleteNotes: vi.fn(),
  },
}));

const { boardRepository } = await import("../../src/respository/boardRepository.js");
const { embeddingService } = await import("../../src/service/embeddingService.js");
const { chunkText } = await import("../../util/chunking.js");
const { boardService } = await import("../../src/service/boardService.js");

describe("boardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBoard", () => {
    it("should return board with mapped notes", async () => {
      const mockBoard = {
        background: "",
        notes: [
          { id: 1, x: 100, y: 200, description: "Note 1", color: "yellow", ipAddress: "::1", boardId: 1 },
          { id: 2, x: 300, y: 400, description: "Note 2", color: "blue", ipAddress: "::1", boardId: 1 },
        ],
      };
      vi.mocked(boardRepository.getBoard).mockResolvedValue(mockBoard as any);

      const result = await boardService.getBoard();

      expect(result).toEqual({
        background: "",
        notes: [
          { id: "1", x: 100, y: 200, description: "Note 1", color: "yellow" },
          { id: "2", x: 300, y: 400, description: "Note 2", color: "blue" },
        ],
      });
    });

    it("should return empty notes array when board has no notes", async () => {
      vi.mocked(boardRepository.getBoard).mockResolvedValue({ id: 1, background: "", notes: [] } as any);

      const result = await boardService.getBoard();
      expect(result.notes).toEqual([]);
    });
  });

  describe("getNoteIds", () => {
    it("should return note IDs from repository", async () => {
      vi.mocked(boardRepository.getNoteIds).mockResolvedValue([1, 2, 3]);

      const result = await boardService.getNoteIds();
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("addNote", () => {
    it("should add a note when IP limit is not reached", async () => {
      vi.mocked(boardRepository.countNotesByIp).mockResolvedValue(2);
      const createdNote = { id: 5, x: 100, y: 200, description: "New note", color: "green", ipAddress: "::1", boardId: 1 };
      vi.mocked(boardRepository.addNote).mockResolvedValue(createdNote);
      vi.mocked(chunkText).mockReturnValue([]);
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([]);
      vi.mocked(boardRepository.insertChunks).mockResolvedValue(undefined as any);

      const result = await boardService.addNote({
        x: 100, y: 200, description: "New note", color: "green", ipAddress: "::1",
      });

      expect(result).toEqual({ id: "5", x: 100, y: 200, description: "New note", color: "green" });
      expect(boardRepository.countNotesByIp).toHaveBeenCalledWith("::1");
      expect(boardRepository.addNote).toHaveBeenCalledWith({
        x: 100, y: 200, description: "New note", color: "green", ipAddress: "::1",
      });
    });

    it("should throw when IP limit is reached", async () => {
      vi.mocked(boardRepository.countNotesByIp).mockResolvedValue(5);

      await expect(boardService.addNote({
        x: 100, y: 200, description: "Too many", color: "red", ipAddress: "::1",
      })).rejects.toThrow("IP limit reached: maximum 5 notes per IP address");

      expect(boardRepository.addNote).not.toHaveBeenCalled();
    });


  });

  describe("deleteNotesByIds", () => {
    it("should delete notes by IDs", async () => {
      vi.mocked(boardRepository.deleteNotesByIds).mockResolvedValue({ count: 2 });

      const result = await boardService.deleteNotesByIds([1, 2]);
      expect(result).toEqual({ count: 2 });
    });
  });

  describe("deleteAllNotes", () => {
    it("should delete all notes", async () => {
      vi.mocked(boardRepository.deleteAllNotes).mockResolvedValue({ count: 10 });

      const result = await boardService.deleteAllNotes();
      expect(result).toEqual({ count: 10 });
    });
  });

  describe("updateBoardBackground", () => {
    it("should update board background", async () => {
      const url = "https://example.com/bg.png";
      vi.mocked(boardRepository.updateBoardBackground).mockResolvedValue({ id: 1, background: url });

      const result = await boardService.updateBoardBackground(url);
      expect(result).toEqual({ id: 1, background: url });
    });
  });

  describe("updateBoardBackgroundAndDeleteNotes", () => {
    it("should update background and delete notes in a transaction", async () => {
      const url = "https://example.com/bg.png";
      await boardService.updateBoardBackgroundAndDeleteNotes(url, [1, 2]);
      expect(boardRepository.updateBoardBackgroundAndDeleteNotes).toHaveBeenCalledWith(url, [1, 2]);
    });
  });
});