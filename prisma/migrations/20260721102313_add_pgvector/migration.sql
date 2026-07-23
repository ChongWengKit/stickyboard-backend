CREATE EXTENSION IF NOT EXISTS "vector";

ALTER TABLE "Note" ADD COLUMN     "embedding" vector(768);
