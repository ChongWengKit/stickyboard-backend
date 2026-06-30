import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const boardRepository = {
  async getBoard() {
    const board = await prisma.board.findFirst({
      include: { notes: true },
    });
    if (!board) {
      return await prisma.board.create({
        data: { background: "" },
        include: { notes: true },
      });
    }
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

    return await prisma.note.create({
      data: {
        x: data.x,
        y: data.y,
        description: data.description,
        color: data.color,
        ipAddress: data.ipAddress,
        boardId: board.id,
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
    const board = await prisma.board.findFirst();
    if (!board) throw new Error("No board found");
    return await prisma.board.update({
      where: { id: board.id },
      data: { background: url },
    });
  },
};