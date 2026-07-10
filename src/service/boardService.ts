import { boardRepository } from "../respository/boardRepository.js";
import type { Note } from "@prisma/client";

const MAX_NOTES_PER_IP = parseInt(process.env.MAX_NOTES_PER_IP || "5", 10);

export const boardService = {
  async getBoard() {
    const board = await boardRepository.getBoard();
    return {
      background: board.background,
      notes: board.notes.map((n: Note) => ({
        id: String(n.id),
        x: n.x,
        y: n.y,
        description: n.description,
        color: n.color,
      })),
    };
  },

  async getNoteIds(): Promise<number[]> {
    return await boardRepository.getNoteIds();
  },

  async addNote(data: {
    x: number;
    y: number;
    description: string;
    color: string;
    ipAddress: string;
  }) {
    const count = await boardRepository.countNotesByIp(data.ipAddress);
    if (count >= MAX_NOTES_PER_IP) {
      throw new Error(
        `IP limit reached: maximum ${MAX_NOTES_PER_IP} notes per IP address`
      );
    }

    const note = await boardRepository.addNote(data);
    return {
      id: String(note.id),
      x: note.x,
      y: note.y,
      description: note.description,
      color: note.color,
    };
  },

  async deleteNotesByIds(ids: number[]) {
    return await boardRepository.deleteNotesByIds(ids);
  },

  async deleteAllNotes() {
    return await boardRepository.deleteAllNotes();
  },

  async updateBoardBackground(url: string) {
    return await boardRepository.updateBoardBackground(url);
  },

  async updateBoardBackgroundAndDeleteNotes(url: string, noteIds: number[]) {
    return await boardRepository.updateBoardBackgroundAndDeleteNotes(url, noteIds);
  }
};