import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrismaClient } from "../mocks/prisma.js";


const mockPrisma = createMockPrisma();

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: class {
      constructor() {
        return mockPrisma;
      }
    },
  };
});

const mockRedisInstance = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

vi.mock("../../util/redis.js", () => ({
  default: mockRedisInstance,  
}));

const { boardRepository } = await import("../../src/respository/boardRepository.js");

describe("boardRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBoard", () => {
    it("should upsert and return the board with notes", async () => {
      const expectedBoard = {
        id: 1,
        background: "",
        notes: [{ id: 1, description: "test", color: "yellow", x: 100, y: 200, ipAddress: "::1", boardId: 1 }],
      };
      mockPrisma.board.upsert.mockResolvedValue(expectedBoard);

      const result = await boardRepository.getBoard();

      expect(result).toEqual(expectedBoard);
      expect(mockPrisma.board.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        create: { id: 1, background: "" },
        update: {},
        include: { notes: true },
      });
    });
  });

  describe("getNoteIds", () => {
    it("should return an array of note IDs", async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);

      const result = await boardRepository.getNoteIds();
      expect(result).toEqual([1, 2, 3]);
      expect(mockPrisma.note.findMany).toHaveBeenCalledWith({ select: { id: true } });
    });

    it("should return an empty array when no notes exist", async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);

      const result = await boardRepository.getNoteIds();
      expect(result).toEqual([]);
    });
  });

  describe("countNotesByIp", () => {
    it("should return the count of notes for a given IP", async () => {
      mockPrisma.note.count.mockResolvedValue(3);

      const result = await boardRepository.countNotesByIp("192.168.1.1");
      expect(result).toBe(3);
      expect(mockPrisma.note.count).toHaveBeenCalledWith({
        where: { ipAddress: "192.168.1.1" },
      });
    });

    it("should return 0 when no notes exist for the IP", async () => {
      mockPrisma.note.count.mockResolvedValue(0);

      const result = await boardRepository.countNotesByIp("10.0.0.1");
      expect(result).toBe(0);
    });
  });

  describe("addNote", () => {
    it("should create and return a note", async () => {
      const noteInput = { x: 100, y: 200, description: "Test note", color: "blue", ipAddress: "::1" };
      const expectedNote = { id: 1, ...noteInput, boardId: 1 };
      mockPrisma.board.findFirst.mockResolvedValue({ id: 1, background: "" });
      mockPrisma.note.create.mockResolvedValue(expectedNote);

      const result = await boardRepository.addNote(noteInput);
      expect(result).toEqual(expectedNote);
      expect(mockPrisma.note.create).toHaveBeenCalledWith({
        data: { ...noteInput, boardId: 1 },
      });
    });
  });

  describe("deleteNote", () => {
    it("should delete and return the note", async () => {
      const expectedNote = { id: 1, description: "test", color: "red", x: 50, y: 50, ipAddress: "::1", boardId: 1 };
      mockPrisma.note.delete.mockResolvedValue(expectedNote);
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await boardRepository.deleteNote(1);
      expect(result).toEqual(expectedNote);
      expect(mockPrisma.note.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRedisInstance.del).toHaveBeenCalledWith("board:data");
    });
  });

  describe("deleteNotesByIds", () => {
    it("should delete notes by IDs and return the count", async () => {
      mockPrisma.note.deleteMany.mockResolvedValue({ count: 2 });
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await boardRepository.deleteNotesByIds([1, 2]);
      expect(result).toEqual({ count: 2 });
      expect(mockPrisma.note.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
      expect(mockRedisInstance.del).toHaveBeenCalledWith("board:data");
    });
  });

  describe("deleteAllNotes", () => {
    it("should delete all notes", async () => {
      mockPrisma.note.deleteMany.mockResolvedValue({ count: 5 });
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await boardRepository.deleteAllNotes();
      expect(result).toEqual({ count: 5 });
      expect(mockPrisma.note.deleteMany).toHaveBeenCalledWith();
      expect(mockRedisInstance.del).toHaveBeenCalledWith("board:data");
    });
  });

  describe("updateBoardBackground", () => {
    it("should update the board background URL", async () => {
      mockPrisma.board.findFirst.mockResolvedValue({ id: 1, background: "" });
      mockPrisma.board.update.mockResolvedValue({ id: 1, background: "https://example.com/bg.png" });
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await boardRepository.updateBoardBackground("https://example.com/bg.png");
      expect(result).toEqual({ id: 1, background: "https://example.com/bg.png" });
      expect(mockPrisma.board.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { background: "https://example.com/bg.png" },
      });
      expect(mockRedisInstance.del).toHaveBeenCalledWith("board:data");
    });
  });

  describe("updateBoardBackgroundAndDeleteNotes", () => {
    it("should update background and delete notes in a transaction", async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));

      const result = await boardRepository.updateBoardBackgroundAndDeleteNotes("https://example.com/bg.png", [1, 2, 3]);
      expect(result).toBeUndefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should skip deleting notes when ids array is empty", async () => {
      const txMock = { board: { update: vi.fn() }, note: { deleteMany: vi.fn() } };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(txMock));

      await boardRepository.updateBoardBackgroundAndDeleteNotes("https://example.com/bg.png", []);
      expect(txMock.board.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { background: "https://example.com/bg.png" },
      });
      expect(txMock.note.deleteMany).not.toHaveBeenCalled();
    });
  });
});