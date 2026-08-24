import { Request, Response } from "express";
import { chatService } from "../service/chat.service.js";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  isValidChatMessage,
  sanitizeHistoryMessages,
} from "../../util/validation.js";

export const chatController = {
  async chat(req: Request, res: Response) {
    try {
      const { question, history } = req.body;

      if (!question || typeof question !== "string" || question.trim() === "") {
        res.status(400).json({
          success: false,
          message: "Missing required field: question",
          data: null,
        });
        return;
      }

      if (!isValidChatMessage(question)) {
        res.status(400).json({
          success: false,
          message: `Question must be a non-empty string no longer than ${MAX_CHAT_MESSAGE_LENGTH} characters`,
          data: null,
        });
        return;
      }

      if (history !== undefined && history !== null && !Array.isArray(history)) {
        res.status(400).json({
          success: false,
          message: "History must be an array of messages",
          data: null,
        });
        return;
      }
      const cleanHistory = sanitizeHistoryMessages(history ?? []);

      const result = await chatService.chat(question.trim(), cleanHistory);

      res.json({
        success: true,
        message: "Chat response generated successfully",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to generate chat response",
        data: null,
      });
    }
  },
};