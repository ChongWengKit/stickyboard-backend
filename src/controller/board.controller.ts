import { Request, Response } from "express";
import { boardService } from "../service/board.service.js";
import { getClientIp } from "../../util/ipUtils.js";
export const boardController = {
  async getBoard(req: Request, res: Response) {
    try {
      const board = await boardService.getBoard();
      res.json({ success: true , message: "Board fetched successfully", data: board });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch board", data: null });
    }
  },

  async addNote(req: Request, res: Response) {
    try {
      const { x, y, description, color } = req.body;

      const ipAddress = getClientIp(req);
      if (ipAddress === "unknown") {
        res
          .status(400)
          .json({ success: false, message: "Failed to get client IP address", data: null });
        return;
      }

      const note = await boardService.addNote({ x, y, description, color, ipAddress });
      res.status(201).json({ success: true, message: "Note added successfully", data: note });
    } catch (error: any) {
      if (error?.message === "IP_LIMIT_REACHED") {
        res.status(429).json({ success: false, message: error.message, data: null });
        return;
      }
      if (error?.message === "VALIDATION_ERROR") {
        res.status(400).json({ success: false, message: error.message, data: null });
        return;
      }
      res.status(500).json({ success: false, message: "Failed to add note", data: null });
    }
  },

  async deleteAllNotes(req: Request, res: Response) {
    try {
      await boardService.deleteAllNotes();
      res.json({ success: true, message: "All notes deleted successfully", data: null });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to delete all notes", data: null });
    }
  }
};
