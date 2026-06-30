import { Request, Response } from "express";
import { boardService } from "../service/boardService";
import { triggerNoteAdded } from "../service/pusherService";

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return realIp;
  }
  return req.socket.remoteAddress || "unknown";
}

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
      if (x == null || y == null || !description || !color) {
        res
          .status(400)
          .json({ success: false, message: "Missing required fields: x, y, description, color", data: null });
        return;
      }

      const ipAddress = getClientIp(req);
      if(ipAddress === "unknown") {
        res
          .status(400)
          .json({ success: false, message: "Failed to get client IP address", data: null });
        return;
      }
      const note = await boardService.addNote({
        x,
        y,
        description,
        color,
        ipAddress,
      });
      triggerNoteAdded(note);
      res.status(201).json({ success: true, message: "Note added successfully", data: note });
    } catch (error: any) {
      if (error.message?.includes("IP limit reached")) {
        res.status(429).json({ success: false, message: error.message, data: null });
        return;
      }
      res.status(500).json({ sucess: false, message: "Failed to add note", data: null });
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
