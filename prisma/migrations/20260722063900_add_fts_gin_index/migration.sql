CREATE INDEX IF NOT EXISTS idx_note_description_fts ON "Note"
USING gin (to_tsvector('simple', description));