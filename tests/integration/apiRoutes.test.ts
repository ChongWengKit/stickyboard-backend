import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/service/board.service.js", () => ({
  boardService: {
    getBoard: vi.fn(),
    addNote: vi.fn(),
    deleteAllNotes: vi.fn(),
  },
}));

vi.mock("../../src/service/cron.service.js", () => ({
  runSnapshotAndCleanup: vi.fn(),
}));

vi.mock("../../util/ipUtils.js", () => ({
  getClientIp: vi.fn(),
}));

const { boardService } = await import("../../src/service/board.service.js");
const { runSnapshotAndCleanup } = await import("../../src/service/cron.service.js");
const { getClientIp } = await import("../../util/ipUtils.js");
const { default: boardRoutes } = await import("../../src/routes/board.routes.js");

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
        id: "1", x: 50, y: 80, description: "Integration test note", color: "#0000ff",
      });

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 50, y: 80, description: "Integration test note", color: "#0000ff" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        message: "Note added successfully",
        data: { id: "1", x: 50, y: 80, description: "Integration test note", color: "#0000ff" },
      });
      expect(boardService.addNote).toHaveBeenCalledWith({
        x: 50, y: 80, description: "Integration test note", color: "#0000ff", ipAddress: "192.168.1.1",
      });
    });

    it("should return 400 when body is invalid", async () => {
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("VALIDATION_ERROR"));

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 50 }); 

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(boardService.addNote).toHaveBeenCalled();
    });

    it("should return 400 when description is too long", async () => {
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("VALIDATION_ERROR"));

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 10, y: 20, description: "a".repeat(501), color: "#ffffff" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(boardService.addNote).toHaveBeenCalled();
    });

    it("should return 400 when color is invalid", async () => {
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("VALIDATION_ERROR"));

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 10, y: 20, description: "Valid note", color: "red" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(boardService.addNote).toHaveBeenCalled();
    });

    it("should return 429 when IP limit is exceeded", async () => {
      vi.mocked(getClientIp).mockReturnValue("10.0.0.5");
      vi.mocked(boardService.addNote).mockRejectedValue(new Error("IP_LIMIT_REACHED"));

      const res = await request(createTestApp())
        .post("/api/board")
        .send({ x: 10, y: 20, description: "Over limit", color: "#ff0000" });

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        message: "IP_LIMIT_REACHED",
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