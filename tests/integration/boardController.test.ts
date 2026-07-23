import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../src/service/boardService.js", () => ({
  boardService: {
    getBoard: vi.fn(),
    addNote: vi.fn(),
    deleteAllNotes: vi.fn(),
  },
}));

vi.mock("../../src/service/pusherService.js", () => ({
  triggerNoteAdded: vi.fn(),
}));

vi.mock("../../util/ipUtils.js", () => ({
  getClientIp: vi.fn(),
}));

const { boardController } = await import("../../src/controller/boardController.js");
const { boardService } = await import("../../src/service/boardService.js");
const { triggerNoteAdded } = await import("../../src/service/pusherService.js");
const { getClientIp } = await import("../../util/ipUtils.js");

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, headers: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("boardController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBoard", () => {
    it("should return board data on success", async () => {
      const req = mockReq();
      const res = mockRes();
      vi.mocked(boardService.getBoard).mockResolvedValue({
        background: "",
        notes: [{ id: "1", x: 100, y: 200, description: "Test", color: "yellow" }],
      });

      await boardController.getBoard(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Board fetched successfully",
        data: { background: "", notes: [{ id: "1", x: 100, y: 200, description: "Test", color: "yellow" }] },
      });
    });

    it("should return 500 on service error", async () => {
      const req = mockReq();
      const res = mockRes();
      vi.mocked(boardService.getBoard).mockRejectedValue(new Error("DB error"));

      await boardController.getBoard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch board",
        data: null,
      });
    });
  });

  describe("addNote", () => {
    it("should return 400 when required fields are missing", async () => {
      const req = mockReq({ body: { x: 100 } }); // missing y, description, color
      const res = mockRes();

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields: x, y, description, color",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should return 400 when IP address is unknown", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "Test", color: "blue" } });
      const res = mockRes();
      vi.mocked(getClientIp).mockReturnValue("unknown");

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to get client IP address",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should add a note and return 201 on success", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "New note", color: "green" } });
      const res = mockRes();
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      vi.mocked(boardService.addNote).mockResolvedValue({
        id: "1", x: 100, y: 200, description: "New note", color: "green",
      });

      await boardController.addNote(req, res);

      expect(boardService.addNote).toHaveBeenCalledWith({
        x: 100, y: 200, description: "New note", color: "green", ipAddress: "192.168.1.1",
      });
      expect(triggerNoteAdded).toHaveBeenCalledWith({
        id: "1", x: 100, y: 200, description: "New note", color: "green",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Note added successfully",
        data: { id: "1", x: 100, y: 200, description: "New note", color: "green" },
      });
    });

    it("should return 429 when IP limit is reached", async () => {
      const req = mockReq({ body: { x: 10, y: 20, description: "Too many", color: "red" } });
      const res = mockRes();
      vi.mocked(getClientIp).mockReturnValue("10.0.0.1");
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("IP limit reached: maximum 5 notes per IP address"));

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "IP limit reached: maximum 5 notes per IP address",
        data: null,
      });
    });

    it("should return 500 on unexpected error", async () => {
      const req = mockReq({ body: { x: 50, y: 60, description: "Error test", color: "purple" } });
      const res = mockRes();
      vi.mocked(getClientIp).mockReturnValue("10.0.0.2");
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("Unexpected DB error"));

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to add note",
        data: null,
      });
    });
  });

  describe("deleteAllNotes", () => {
    it("should delete all notes and return success", async () => {
      const req = mockReq();
      const res = mockRes();
      vi.mocked(boardService.deleteAllNotes).mockResolvedValue({ count: 5 });

      await boardController.deleteAllNotes(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "All notes deleted successfully",
        data: null,
      });
    });

    it("should return 500 on error", async () => {
      const req = mockReq();
      const res = mockRes();
      vi.mocked(boardService.deleteAllNotes).mockRejectedValue(new Error("Delete failed"));

      await boardController.deleteAllNotes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to delete all notes",
        data: null,
      });
    });
  });
});