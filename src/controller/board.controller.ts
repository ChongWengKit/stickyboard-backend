import { Request, Response } from "express";
import { boardService } from "../service/board.service.js";
import { triggerNoteAdded } from "../service/pusher.service.js";
import { getClientIp } from "../../util/ipUtils.js";
import {
  MAX_NOTE_DESCRIPTION_LENGTH,
  isValidHexColor,
  isValidNoteDescription,
} from "../../util/validation.js";
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

      if (!isValidNoteDescription(description)) {
        res
          .status(400)
          .json({
            success: false,
            message: `Description must be a non-empty string no longer than ${MAX_NOTE_DESCRIPTION_LENGTH} characters`,
            data: null,
          });
        return;
      }

      if (!isValidHexColor(color)) {
        res
          .status(400)
          .json({
            success: false,
            message: "Color must be a valid hex color (e.g. #ffffff or #fff)",
            data: null,
          });
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
      await triggerNoteAdded(note);
      res.status(201).json({ success: true, message: "Note added successfully", data: note });
    } catch (error: any) {
      if (error.message?.includes("IP limit reached")) {
        res.status(429).json({ success: false, message: error.message, data: null });
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
