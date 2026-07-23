import { vi } from "vitest";

export function createMockPrisma() {
  return {
    board: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    note: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
}

export type MockPrismaClient = ReturnType<typeof createMockPrisma>;