import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../src/service/board.service.js", () => ({
  boardService: {
    getBoard: vi.fn(),
    addNote: vi.fn(),
    deleteAllNotes: vi.fn(),
  },
}));

vi.mock("../../src/service/pusher.service.js", () => ({
  triggerNoteAdded: vi.fn(),
}));

vi.mock("../../util/ipUtils.js", () => ({
  getClientIp: vi.fn(),
}));

const { boardController } = await import("../../src/controller/board.controller.js");
const { boardService } = await import("../../src/service/board.service.js");
const { triggerNoteAdded } = await import("../../src/service/pusher.service.js");
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

    it("should return 400 when description is too long", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "a".repeat(501), color: "#ffffff" } });
      const res = mockRes();

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Description must be a non-empty string no longer than 500 characters",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should return 400 when description is empty", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "   ", color: "#ffffff" } });
      const res = mockRes();

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Description must be a non-empty string no longer than 500 characters",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should return 400 when color is not a valid hex color", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "Test", color: "blue" } });
      const res = mockRes();

      await boardController.addNote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Color must be a valid hex color (e.g. #ffffff or #fff)",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should return 400 when IP address is unknown", async () => {
      const req = mockReq({ body: { x: 100, y: 200, description: "Test", color: "#0000ff" } });
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
      const req = mockReq({ body: { x: 100, y: 200, description: "New note", color: "#00ff00" } });
      const res = mockRes();
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      vi.mocked(boardService.addNote).mockResolvedValue({
        id: "1", x: 100, y: 200, description: "New note", color: "#00ff00",
      });

      await boardController.addNote(req, res);

      expect(boardService.addNote).toHaveBeenCalledWith({
        x: 100, y: 200, description: "New note", color: "#00ff00", ipAddress: "192.168.1.1",
      });
      expect(triggerNoteAdded).toHaveBeenCalledWith({
        id: "1", x: 100, y: 200, description: "New note", color: "#00ff00",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Note added successfully",
        data: { id: "1", x: 100, y: 200, description: "New note", color: "#00ff00" },
      });
    });

    it("should return 429 when IP limit is reached", async () => {
      const req = mockReq({ body: { x: 10, y: 20, description: "Too many", color: "#ff0000" } });
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
      const req = mockReq({ body: { x: 50, y: 60, description: "Error test", color: "#800080" } });
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