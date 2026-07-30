const CHUNK_SIZE = 200;
const OVERLAP_SENTENCES = 1; 

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (matches) return matches.map((s) => s.trim()).filter(Boolean);
  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

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
    const addedLength = sentence.length + (current.length > 0 ? 1 : 0); 

    if (currentLength + addedLength > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(" "));

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