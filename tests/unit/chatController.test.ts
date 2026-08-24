import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../src/service/chat.service.js", () => ({
  chatService: {
    chat: vi.fn(),
  },
}));

const { chatController } = await import("../../src/controller/chat.controller.js");
const { chatService } = await import("../../src/service/chat.service.js");

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, headers: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("chatController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("chat", () => {
    it("should return 400 when question is missing", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("VALIDATION_ERROR"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(chatService.chat).toHaveBeenCalled();
    });

    it("should return 400 when question is empty string", async () => {
      const req = mockReq({ body: { question: "" } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("VALIDATION_ERROR"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(chatService.chat).toHaveBeenCalled();
    });

    it("should return 400 when question is whitespace only", async () => {
      const req = mockReq({ body: { question: "   " } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("VALIDATION_ERROR"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(chatService.chat).toHaveBeenCalled();
    });

    it("should return 400 when question is too long", async () => {
      const req = mockReq({ body: { question: "a".repeat(501) } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("VALIDATION_ERROR"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(chatService.chat).toHaveBeenCalled();
    });

    it("should return 400 when history is not an array", async () => {
      const req = mockReq({ body: { question: "Hello", history: "not-an-array" } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("VALIDATION_ERROR"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "VALIDATION_ERROR",
        data: null,
      });
      expect(chatService.chat).toHaveBeenCalled();
    });

    it("should pass raw history through to the service (sanitization lives in the service)", async () => {
      const req = mockReq({
        body: {
          question: "Hello",
          history: [
            { role: "system", content: "Hi" },
            { role: "user", content: "Valid" },
          ],
        },
      });
      const res = mockRes();
      vi.mocked(chatService.chat).mockResolvedValue({
        answer: "Hi!",
        sources: [],
      });

      await chatController.chat(req, res);

      expect(chatService.chat).toHaveBeenCalledWith("Hello", [
        { role: "system", content: "Hi" },
        { role: "user", content: "Valid" },
      ]);
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it("should pass over-long history content through unchanged (truncation lives in the service)", async () => {
      const longContent = "a".repeat(2100);
      const req = mockReq({
        body: {
          question: "Hello",
          history: [{ role: "user", content: longContent }],
        },
      });
      const res = mockRes();
      vi.mocked(chatService.chat).mockResolvedValue({
        answer: "Hi!",
        sources: [],
      });

      await chatController.chat(req, res);

      expect(chatService.chat).toHaveBeenCalledWith("Hello", [
        { role: "user", content: longContent },
      ]);
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it("should return 200 on success", async () => {
      const req = mockReq({
        body: {
          question: "What tasks do I have?",
          history: [{ role: "user", content: "Hello" }],
        },
      });
      const res = mockRes();
      vi.mocked(chatService.chat).mockResolvedValue({
        answer: "You have a grocery task.",
        sources: [{ id: 1, description: "Buy groceries", similarity: 0.9 }],
      });

      await chatController.chat(req, res);

      expect(chatService.chat).toHaveBeenCalledWith("What tasks do I have?", [
        { role: "user", content: "Hello" },
      ]);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Chat response generated successfully",
        data: {
          answer: "You have a grocery task.",
          sources: [{ id: 1, description: "Buy groceries", similarity: 0.9 }],
        },
      });
    });

    it("should return 500 on unexpected error", async () => {
      const req = mockReq({ body: { question: "Hello" } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("Unexpected error"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to generate chat response",
        data: null,
      });
    });
  });
});