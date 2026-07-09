import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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

vi.mock("../../src/service/cronService.js", () => ({
  runSnapshotAndCleanup: vi.fn(),
}));

vi.mock("../../util/ipUtils.js", () => ({
  getClientIp: vi.fn(),
}));

const { boardService } = await import("../../src/service/boardService.js");
const { triggerNoteAdded } = await import("../../src/service/pusherService.js");
const { runSnapshotAndCleanup } = await import("../../src/service/cronService.js");
const { getClientIp } = await import("../../util/ipUtils.js");
const { default: boardRoutes } = await import("../../src/routes/boardRoutes.js");

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", boardRoutes);
  return app;
}

describe("API Routes (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/board", () => {
    it("should return the board with notes", async () => {
      vi.mocked(boardService.getBoard).mockResolvedValue({
        background: "",
        notes: [{ id: "1", x: 100, y: 200, description: "Test note", color: "yellow" }],
      });

      const res = await request(createTestApp()).get("/api/board");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Board fetched successfully",
        data: {
          background: "",
          notes: [{ id: "1", x: 100, y: 200, description: "Test note", color: "yellow" }],
        },
      });
    });

    it("should return 500 when service fails", async () => {
      vi.mocked(boardService.getBoard).mockRejectedValue(new Error("DB error"));

      const res = await request(createTestApp()).get("/api/board");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Failed to fetch board",
        data: null,
      });
    });
  });

  describe("POST /api/board", () => {
    it("should create a note and return 201", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      vi.mocked(boardService.addNote).mockResolvedValue({
        id: "1", x: 50, y: 80, description: "Integration test note", color: "blue",
      });

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 50, y: 80, description: "Integration test note", color: "blue" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        message: "Note added successfully",
        data: { id: "1", x: 50, y: 80, description: "Integration test note", color: "blue" },
      });
      expect(boardService.addNote).toHaveBeenCalledWith({
        x: 50, y: 80, description: "Integration test note", color: "blue", ipAddress: "192.168.1.1",
      });
      expect(triggerNoteAdded).toHaveBeenCalled();
    });

    it("should return 400 when body is invalid", async () => {
      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 50 }); 

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Missing required fields: x, y, description, color",
        data: null,
      });
      expect(boardService.addNote).not.toHaveBeenCalled();
    });

    it("should return 429 when IP limit is exceeded", async () => {
      vi.mocked(getClientIp).mockReturnValue("10.0.0.5");
      vi.mocked(boardService.addNote).mockRejectedValue(
        new Error("IP limit reached: maximum 5 notes per IP address"),
      );

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 10, y: 20, description: "Over limit", color: "red" });

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        message: "IP limit reached: maximum 5 notes per IP address",
        data: null,
      });
    });
  });

  describe("GET /api/board/snapshot", () => {
    it("should trigger snapshot and return success", async () => {
      vi.mocked(runSnapshotAndCleanup).mockResolvedValue(undefined);

      const res = await request(createTestApp()).get("/api/board/snapshot");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Snapshot and cleanup triggered successfully",
      });
      expect(runSnapshotAndCleanup).toHaveBeenCalled();
    });

    it("should return 500 when snapshot fails", async () => {
      vi.mocked(runSnapshotAndCleanup).mockRejectedValue(new Error("Snapshot failed"));

      const res = await request(createTestApp()).get("/api/board/snapshot");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Failed to trigger snapshot and cleanup",
      });
    });
  });
});