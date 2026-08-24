import { boardRepository } from "../respository/board.repository.js";
import { embeddingService } from "./embedding.service.js";
import { triggerNoteAdded } from "./pusher.service.js";
import { chunkText } from "../../util/chunking.js";
import {
  MAX_NOTES_PER_IP,
  isValidHexColor,
  isValidNoteDescription,
} from "../../util/validation.js";
import type { Note } from "@prisma/client";

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
    const required = [data.x, data.y, data.description, data.color, data.ipAddress];
    if (required.some((v) => v == null || v === "")) {
      throw new Error("VALIDATION_ERROR");
    }
    if (!isValidNoteDescription(data.description)) {
      throw new Error("VALIDATION_ERROR");
    }
    if (!isValidHexColor(data.color)) {
      throw new Error("VALIDATION_ERROR");
    }

    const count = await boardRepository.countNotesByIp(data.ipAddress);
    if (count >= MAX_NOTES_PER_IP) {
      throw new Error("IP_LIMIT_REACHED");
    }

    const cleanText = data.description.replace(/\n/g, " ");
    const chunks = chunkText(cleanText);
    const chunkEmbeddings = await Promise.all(
      chunks.map((chunk) => embeddingService.generateEmbedding(chunk))
    );
    const chunkData = chunks.map((content, i) => ({
      content,
      embedding: chunkEmbeddings[i],
    }));

    const note = await boardRepository.addNoteWithChunks(data, chunkData);

    const result = {
      id: String(note.id),
      x: note.x,
      y: note.y,
      description: note.description,
      color: note.color,
    };

    await triggerNoteAdded(result);

    return result;
  },

  async deleteNotesByIds(ids: number[]) {
    await boardRepository.deleteChunksByNoteIds(ids);
    return await boardRepository.deleteNotesByIds(ids);
  },

  async deleteAllNotes() {
    await boardRepository.deleteAllChunks();
    return await boardRepository.deleteAllNotes();
  },

  async updateBoardBackground(url: string) {
    return await boardRepository.updateBoardBackground(url);
  },

  async updateBoardBackgroundAndDeleteNotes(url: string, noteIds: number[]) {
    return await boardRepository.updateBoardBackgroundAndDeleteNotes(url, noteIds);
  }
};
