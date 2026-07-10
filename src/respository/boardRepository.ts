import { PrismaClient } from "@prisma/client";
import redis from "../../util/redis.js";

const prisma = new PrismaClient();

const BOARD_CACHE_KEY = "board:data";
const BOARD_CACHE_TTL = 30;

export const boardRepository = {
  async getBoard() {
    const cached = await redis.get(BOARD_CACHE_KEY);
    if (cached) {
      return cached as any;
    }

    const board = await prisma.board.findFirst({
      include: { notes: true },
    });
    if (!board) {
      const created = await prisma.board.upsert({
      where: { id: 1 },
      create: { id: 1, background: "" },
      update: {},
      include: { notes: true },
    });
      await redis.setex(BOARD_CACHE_KEY, BOARD_CACHE_TTL, created);
      return created;
    }

    await redis.setex(BOARD_CACHE_KEY, BOARD_CACHE_TTL, board);
    return board;
  },

  async getNoteIds(): Promise<number[]> {
    const notes = await prisma.note.findMany({ select: { id: true } });
    return notes.map((n) => n.id);
  },

  async countNotesByIp(ipAddress: string): Promise<number> {
    return await prisma.note.count({
      where: { ipAddress },
    });
  },

  async addNote(data: {
    x: number;
    y: number;
    description: string;
    color: string;
    ipAddress: string;
  }) {
    const board = await prisma.board.findFirst();
    if (!board) throw new Error("No board found");

    const note = await prisma.note.create({
      data: {
        x: data.x,
        y: data.y,
        description: data.description,
        color: data.color,
        ipAddress: data.ipAddress,
        boardId: 1,
      },
    });

    await redis.del(BOARD_CACHE_KEY);
    return note;
  },

  async deleteNote(noteId: number) {
    const result = await prisma.note.delete({
      where: { id: noteId },
    });

    await redis.del(BOARD_CACHE_KEY);
    return result;
  },

  async deleteNotesByIds(ids: number[]) {
    const result = await prisma.note.deleteMany({
      where: { id: { in: ids } },
    });

    await redis.del(BOARD_CACHE_KEY);
    return result;
  },

  async deleteAllNotes() {
    const result = await prisma.note.deleteMany();
    await redis.del(BOARD_CACHE_KEY);
    return result;
  },

  async updateBoardBackground(url: string) {
    const board = await prisma.board.findFirst();
    if (!board) throw new Error("No board found");
    const updated = await prisma.board.update({
      where: { id: 1 },
      data: { background: url },
    });

    await redis.del(BOARD_CACHE_KEY);
    return updated;
  },

  async updateBoardBackgroundAndDeleteNotes(url: string, noteIds: number[]) {
    return await prisma.$transaction(async (tx) => {
      await tx.board.update({
        where: { id: 1 },
        data: { background: url },
      });
      if (noteIds.length > 0) {
        await tx.note.deleteMany({
          where: { id: { in: noteIds } },
        });
      }
    });
  },
};