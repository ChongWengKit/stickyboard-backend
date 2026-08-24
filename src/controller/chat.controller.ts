import { Request, Response } from "express";
import { chatService } from "../service/chat.service.js";

export const chatController = {
  async chat(req: Request, res: Response) {
    try {
      const { question, history } = req.body;

      const result = await chatService.chat(question, history);

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
};