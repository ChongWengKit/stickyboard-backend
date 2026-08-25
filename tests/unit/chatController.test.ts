import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

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

const { chatController } = await import("../../src/controller/chat.controller.js");
const { chatService } = await import("../../src/service/chat.service.js");
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

describe("chatController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("chat", () => {
    it("should return 400 when the client IP cannot be resolved", async () => {
      vi.mocked(getClientIp).mockReturnValue("unknown");
      const req = mockReq({ body: { question: "Hello" } });
      const res = mockRes();

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to get client IP address",
        data: null,
      });
      expect(chatService.chat).not.toHaveBeenCalled();
    });

    it("should return 400 when question is invalid", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
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
    });

    it("should call the service with the resolved IP and return 200 on success", async () => {
      vi.mocked(getClientIp).mockReturnValue("203.0.113.7");
      const req = mockReq({ body: { question: "What tasks?" } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockResolvedValue({
        answer: "Grocery task.",
        sources: [],
      });

      await chatController.chat(req, res);

      expect(chatService.chat).toHaveBeenCalledWith("What tasks?", "203.0.113.7");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Chat response generated successfully",
        data: { answer: "Grocery task.", sources: [] },
      });
    });

    it("should return 500 on unexpected error", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      const req = mockReq({ body: { question: "Hello" } });
      const res = mockRes();
      vi.mocked(chatService.chat).mockRejectedValue(new Error("Unexpected"));

      await chatController.chat(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to generate chat response",
        data: null,
      });
    });
  });

  describe("getMessages", () => {
    it("should return 400 when IP is unknown", async () => {
      vi.mocked(getClientIp).mockReturnValue("unknown");
      const res = mockRes();

      await chatController.getMessages(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(chatService.getMessages).not.toHaveBeenCalled();
    });

    it("should return the decrypted messages on success", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      const res = mockRes();
      const msgs = [{ id: "1", role: "user", content: "hi", timestamp: 1 }];
      vi.mocked(chatService.getMessages).mockResolvedValue(msgs as any);

      await chatController.getMessages(mockReq(), res);

      expect(chatService.getMessages).toHaveBeenCalledWith("192.168.1.1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Chat history fetched successfully",
        data: msgs,
      });
    });

    it("should return 500 on unexpected error", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      const res = mockRes();
      vi.mocked(chatService.getMessages).mockRejectedValue(new Error("boom"));

      await chatController.getMessages(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch chat history",
        data: null,
      });
    });
  });

  describe("clearMessages", () => {
    it("should return 400 when IP is unknown", async () => {
      vi.mocked(getClientIp).mockReturnValue("unknown");
      const res = mockRes();

      await chatController.clearMessages(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(chatService.clearMessages).not.toHaveBeenCalled();
    });

    it("should clear messages for the IP and return success", async () => {
      vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
      const res = mockRes();
      vi.mocked(chatService.clearMessages).mockResolvedValue({ count: 2 } as any);

      await chatController.clearMessages(mockReq(), res);

      expect(chatService.clearMessages).toHaveBeenCalledWith("192.168.1.1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Chat history cleared successfully",
        data: null,
      });
    });
  });
});
