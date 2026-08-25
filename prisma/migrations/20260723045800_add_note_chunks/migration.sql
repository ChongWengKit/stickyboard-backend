CREATE TABLE IF NOT EXISTS "NoteChunk" (
    id SERIAL PRIMARY KEY,
    "noteId" INTEGER NOT NULL REFERENCES "Note"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding halfvec(3072) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notechunk_embedding_hnsw
    ON "NoteChunk" USING hnsw (embedding halfvec_cosine_ops);