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

vi.mock("../../src/service/chat.service.js", () => ({
  chatService: {
    chat: vi.fn(),
    getMessages: vi.fn(),
    clearMessages: vi.fn(),
  },
}));

vi.mock("../../util/ipUtils.js", () => ({
  getClientIp: vi.fn(),
}));

const { boardService } = await import("../../src/service/board.service.js");
const { runSnapshotAndCleanup } = await import("../../src/service/cron.service.js");
const { chatService } = await import("../../src/service/chat.service.js");
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

  describe("POST /api/chat", () => {
    it("should post a chat message scoped to the client IP", async () => {
      vi.mocked(getClientIp).mockReturnValue("203.0.113.9");
      vi.mocked(chatService.chat).mockResolvedValue({
        answer: "You have a grocery task.",
        sources: [],
      });

      const res = await request(createTestApp())
        .post("/api/chat")
        .send({ question: "What tasks do I have?" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Chat response generated successfully",
        data: { answer: "You have a grocery task.", sources: [] },
      });
      expect(chatService.chat).toHaveBeenCalledWith(
        "What tasks do I have?",
        "203.0.113.9"
      );
    });

    it("should return 400 when the client IP is unknown", async () => {
      vi.mocked(getClientIp).mockReturnValue("unknown");

      const res = await request(createTestApp())
        .post("/api/chat")
        .send({ question: "Hello" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Failed to get client IP address",
        data: null,
      });
      expect(chatService.chat).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/chat/messages", () => {
    it("should return the stored chat history for the IP", async () => {
      vi.mocked(getClientIp).mockReturnValue("203.0.113.9");
      const msgs = [{ id: "1", role: "user", content: "hi", timestamp: 0 }];
      vi.mocked(chatService.getMessages).mockResolvedValue(msgs as any);

      const res = await request(createTestApp()).get("/api/chat/messages");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Chat history fetched successfully",
        data: msgs,
      });
      expect(chatService.getMessages).toHaveBeenCalledWith("203.0.113.9");
    });
  });

  describe("DELETE /api/chat", () => {
    it("should clear the chat history for the IP", async () => {
      vi.mocked(getClientIp).mockReturnValue("203.0.113.9");
      vi.mocked(chatService.clearMessages).mockResolvedValue({ count: 2 } as any);

      const res = await request(createTestApp()).delete("/api/chat");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Chat history cleared successfully",
        data: null,
      });
      expect(chatService.clearMessages).toHaveBeenCalledWith("203.0.113.9");
    });
  });
});