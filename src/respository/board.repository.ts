import { PrismaClient } from "@prisma/client";
import redis from "../../util/redis.js";

const prisma = new PrismaClient();

const BOARD_CACHE_KEY = "board:data";
const BOARD_CACHE_TTL = 30;

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "any", "all", "there", "this", "that", "these", "those",
  "what", "how", "when", "where", "who", "why", "which",
  "i", "me", "my", "you", "your", "it", "its",
  "of", "in", "on", "at", "to", "for", "with", "and", "or", "but",
]);
export function buildOrTsQuery(cleaned: string): string {
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .join(" | ");
}
export function prepareQueryForSearchSimilarNotes(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ");
}

export const boardRepository = {
  async searchSimilarNotes(
    embedding: number[],
    threshold: number = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.6"),
    question?: string
  ): Promise<{ id: number; description: string; similarity: number }[]> {
    const vectorStr = `[${embedding.join(",")}]`;
    const cleanedQuestion = question ? prepareQueryForSearchSimilarNotes(question) : "";

    const chunkResults = await prisma.$queryRawUnsafe<{ noteId: number; similarity: number }[]>(
      `SELECT "noteId", MAX(1 - (embedding <=> $1::vector)) AS similarity
       FROM "NoteChunk"
       WHERE 1 - (embedding <=> $1::vector) > $2
       GROUP BY "noteId"
       ORDER BY similarity DESC
       LIMIT 20`,
      vectorStr,
      threshold
    );

    const noteIds = chunkResults.map((r) => r.noteId);
    let vectorResults: { id: number; description: string; similarity: number }[] = [];
    if (noteIds.length > 0) {
      const notes = await prisma.note.findMany({
        where: { id: { in: noteIds } },
        select: { id: true, description: true },
      });
      const noteMap = new Map(notes.map((n) => [n.id, n.description]));
      vectorResults = chunkResults
        .filter((r) => noteMap.has(r.noteId))
        .map((r) => ({
          id: r.noteId,
          description: noteMap.get(r.noteId)!,
          similarity: r.similarity,
        }));
    }
    let ftsResults: { id: number; description: string; similarity: number }[] = [];
    ftsResults = await prisma.$queryRawUnsafe(
      `SELECT id, description, ts_rank_cd(to_tsvector('english', description), to_tsquery('english', $1), 32) AS similarity
   FROM "Note"
   WHERE to_tsvector('english', description) @@ to_tsquery('english', $1)
   ORDER BY similarity DESC
   LIMIT 20`,
      buildOrTsQuery(cleanedQuestion)
    );

    const k = 60;
    const rankMap = new Map<number, { id: number; description: string; rrfScore: number }>();

    vectorResults.forEach((r, i) => {
      rankMap.set(r.id, { id: r.id, description: r.description, rrfScore: 1 / (k + i + 1) });
    });

    ftsResults.forEach((r, i) => {
      const existing = rankMap.get(r.id);
      if (existing) {
        existing.rrfScore += 1 / (k + i + 1);
      } else {
        rankMap.set(r.id, { id: r.id, description: r.description, rrfScore: 1 / (k + i + 1) });
      }
    });

    const results = Array.from(rankMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        description: r.description,
        similarity: r.rrfScore,
      }));

    return results;
  },

  async insertChunks(chunks: { noteId: number; content: string; embedding: number[] }[]) {
    if (chunks.length === 0) return;
    for (const chunk of chunks) {
      const embeddingStr = `[${chunk.embedding.join(",")}]`;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "NoteChunk" ("noteId", content, embedding)
         VALUES ($1, $2, $3::vector)`,
        chunk.noteId,
        chunk.content,
        embeddingStr
      );
    }
  },

  async deleteChunksByNoteId(noteId: number) {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "NoteChunk" WHERE "noteId" = $1`,
      noteId
    );
  },

  async deleteChunksByNoteIds(noteIds: number[]) {
    if (noteIds.length === 0) return;
    await prisma.$queryRawUnsafe(
      `DELETE FROM "NoteChunk" WHERE "noteId" = ANY($1::int[])`,
      noteIds
    );
  },

  async deleteAllChunks() {
    await prisma.$queryRawUnsafe(`DELETE FROM "NoteChunk"`);
  },

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

    const [note] = await prisma.$queryRawUnsafe<
      { id: number; description: string; color: string; x: number; y: number; ipAddress: string; boardId: number }[]
    >(
      `INSERT INTO "Note" (x, y, description, color, "ipAddress", "boardId")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, description, color, x, y, "ipAddress", "boardId"`,
      data.x,
      data.y,
      data.description,
      data.color,
      data.ipAddress,
      1
    );

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