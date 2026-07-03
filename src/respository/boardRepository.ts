import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const boardRepository = {
  async getBoard() {
    return await prisma.board.upsert({
      where: { id: 1 },
      create: { id: 1, background: "" },
      update: {},
      include: { notes: true },
    });
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
    return await prisma.note.create({
      data: {
        x: data.x,
        y: data.y,
        description: data.description,
        color: data.color,
        ipAddress: data.ipAddress,
        boardId: 1,
      },
    });
  },

  async deleteNote(noteId: number) {
    return await prisma.note.delete({
      where: { id: noteId },
    });
  },

  async deleteNotesByIds(ids: number[]) {
    return await prisma.note.deleteMany({
      where: { id: { in: ids } },
    });
  },

  async deleteAllNotes() {
    return await prisma.note.deleteMany();
  },

  async updateBoardBackground(url: string) {
    return await prisma.board.update({
      where: { id: 1 },
      data: { background: url },
    });
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