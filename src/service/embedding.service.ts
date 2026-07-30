import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-embedding-001";

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY is not configured in environment variables"
      );
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export const embeddingService = {
  async generateEmbedding(text: string): Promise<number[]> {
    const client = getClient();
    const response = await client.models.embedContent({
      model: MODEL,
      contents: text,
    });

    if (!response.embeddings?.[0]?.values) {
      throw new Error("Failed to generate embedding");
    }

    return response.embeddings[0].values;
  },
};