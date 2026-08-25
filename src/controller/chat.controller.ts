import { Request, Response } from "express";
import { chatService } from "../service/chat.service.js";
import { getClientIp } from "../../util/ipUtils.js";

function resolveIp(req: Request): string {
  return getClientIp(req);
}

export const chatController = {
  async chat(req: Request, res: Response) {
    try {
      const { question } = req.body;

      const ipAddress = resolveIp(req);
      if (ipAddress === "unknown") {
        res
          .status(400)
          .json({ success: false, message: "Failed to get client IP address", data: null });
        return;
      }

      const result = await chatService.chat(question, ipAddress);

      res.json({
        success: true,
        message: "Chat response generated successfully",
        data: result,
      });
    } catch (error: any) {
      if (error?.message === "VALIDATION_ERROR") {
        res.status(400).json({ success: false, message: error.message, data: null });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Failed to generate chat response",
        data: null,
      });
    }
  },

  async getMessages(req: Request, res: Response) {
    try {
      const ipAddress = resolveIp(req);
      if (ipAddress === "unknown") {
        res
          .status(400)
          .json({ success: false, message: "Failed to get client IP address", data: null });
        return;
      }

      const messages = await chatService.getMessages(ipAddress);

      res.json({
        success: true,
        message: "Chat history fetched successfully",
        data: messages,
      });
    } catch (error: any) {
      if (error?.message === "VALIDATION_ERROR") {
        res.status(400).json({ success: false, message: error.message, data: null });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat history",
        data: null,
      });
    }
  },

  async clearMessages(req: Request, res: Response) {
    try {
      const ipAddress = resolveIp(req);
      if (ipAddress === "unknown") {
        res
          .status(400)
          .json({ success: false, message: "Failed to get client IP address", data: null });
        return;
      }

      await chatService.clearMessages(ipAddress);

      res.json({
        success: true,
        message: "Chat history cleared successfully",
        data: null,
      });
    } catch (error: any) {
      if (error?.message === "VALIDATION_ERROR") {
        res.status(400).json({ success: false, message: error.message, data: null });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Failed to clear chat history",
        data: null,
      });
    }
  },
};
