import { Request, Response } from "express";
import { chatService } from "../service/chatService.js";

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