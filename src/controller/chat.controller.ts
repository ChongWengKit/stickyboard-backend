import { Request, Response } from "express";
import { chatService } from "../service/chat.service.js";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGE_LENGTH,
  isValidChatMessage,
  isValidHistoryMessage,
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

      if (history !== undefined && history !== null) {
        if (!Array.isArray(history)) {
          res.status(400).json({
            success: false,
            message: "History must be an array of messages",
            data: null,
          });
          return;
        }
        for (const msg of history) {
          if (!isValidHistoryMessage(msg)) {
            res.status(400).json({
              success: false,
              message: "History messages must have a valid role (user/assistant) and content no longer than 500 characters",
              data: null,
            });
            return;
          }
        }
      }

      const result = await chatService.chat(question.trim(), history ?? []);

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