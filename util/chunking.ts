/**
 * Splits text into chunks at sentence boundaries, with sentence-level overlap.
 * Each chunk is at most CHUNK_SIZE characters (soft limit — a single very long
 * sentence may exceed it, but gets word-split as a fallback).
 * Short text returns a single chunk.
 */

const CHUNK_SIZE = 200;
const OVERLAP_SENTENCES = 1; // number of trailing sentences carried into the next chunk

/**
 * Splits text into an array of sentences (keeps punctuation, trims whitespace).
 */
function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (matches) return matches.map((s) => s.trim()).filter(Boolean);
  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Fallback: splits an overly long single sentence by words, up to maxLen per piece.
 */
function splitLongSentence(sentence: string, maxLen: number): string[] {
  const words = sentence.split(" ");
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen && current) {
      parts.push(current.trim());
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current.trim());
  return parts;
}

export function chunkText(text: string): string[] {
  const trimmedText = text.trim();
  if (trimmedText.length <= CHUNK_SIZE) {
    return [trimmedText];
  }

  const rawSentences = splitIntoSentences(trimmedText);

  // Expand any single sentence that's already too long on its own
  const sentences: string[] = [];
  for (const s of rawSentences) {
    if (s.length > CHUNK_SIZE) {
      sentences.push(...splitLongSentence(s, CHUNK_SIZE));
    } else {
      sentences.push(s);
    }
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const addedLength = sentence.length + (current.length > 0 ? 1 : 0); // +1 for joining space

    if (currentLength + addedLength > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(" "));

      // carry the last N sentences forward as overlap for the next chunk
      current = current.slice(-OVERLAP_SENTENCES);
      currentLength = current.reduce((sum, s, i) => sum + s.length + (i > 0 ? 1 : 0), 0);
    }

    current.push(sentence);
    currentLength += sentence.length + (current.length > 1 ? 1 : 0);
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}