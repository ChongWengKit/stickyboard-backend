import { Groq } from "groq-sdk";
import { embeddingService } from "./embeddingService.js";
import { boardRepository } from "../respository/boardRepository.js";

let groq: any = null;

const MAX_HISTORY = 5;
const QUERY_REWRITE_PROMPT = `You rewrite user questions into short, keyword-focused search queries for a sticky notes search system.

RULES:
1. Only use conversation history if the current question clearly depends on it — e.g. it uses a pronoun or reference like "that one", "the food one", "what about X", "and the second one", or is otherwise incomplete without prior context.
2. If the question is understandable on its own, do NOT use the history at all. Return it unchanged (or lightly cleaned — see rule 3), even if the topic is similar to previous messages.
3. Keep the output SHORT and keyword-like — strip greetings, filler phrases ("are there any", "I was wondering if", "can you tell me"), and politeness words. Preserve the core nouns/topics only.
4. Never add words, context, or assumptions that aren't clearly implied by the history or the question itself. Do not paraphrase into a longer or more formal sentence than necessary.
5. Do not change singular/plural or word forms unnecessarily (e.g. don't turn "task" into "tasks").

Return ONLY the rewritten query, nothing else — no explanation, no punctuation like quotes around it.

Examples:
History: (none)
Follow-up: "are there any task"
Output: task

History:
User: what tasks do I have
Assistant: You have a grocery task and a travel task.
Follow-up: "the food one"
Output: food task

History:
User: what tasks do I have
Assistant: You have a grocery task and a travel task.
Follow-up: "any tasks about eating?"
Output: tasks eating
(Note: this question is standalone — it doesn't reference "the previous one" — so history is irrelevant here even though the topic overlaps.)`;

const SYSTEM_PROMPT = `You are an assistant for a sticky notes board. Answer ONLY using the notes given to you below. Do not use outside knowledge.

HOW TO ANSWER:
1. Read every note given to you, fully, before answering.
2. If the question asks for "any", "all", or a list of things, find EVERY matching detail in the notes — even small ones. List them all. Do not skip any.
3. If the relevant details all come from ONE note, describe it as one note. Only say "another note" if the details truly come from two different notes.
4. If nothing in the notes answers the question, say so plainly. Do not guess or add details that aren't written in the notes.
5. Describe notes naturally and neutrally — say "one note says...", "a note on the board mentions...", or "the notes show...". Do NOT say "your notes" or "your task" — you don't know who wrote each note, and the board may be shared by multiple people.
6. Do not mention note IDs, scores, "context", "JSON", or how you work.
7. If the question is not about the sticky notes board, reply exactly: "I can only answer questions about the sticky notes board."

Be complete first, brief second — a longer correct answer is better than a short incomplete one.`;

const GENERATION_MODEL = "openai/gpt-oss-20b";

function getClient(): any {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured in environment variables"
      );
    }
    groq = new (Groq as any)({ apiKey });
  }
  return groq!;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  answer: string;
  sources: { id: number; description: string; similarity: number }[];
}

export const chatService = {
  async chat(
    question: string,
    history: Message[] = []
  ): Promise<ChatResponse> {
    const searchQuery = await rewriteQuery(question, history);

    const embedding = await embeddingService.generateEmbedding(searchQuery);

    const similarNotes = await boardRepository.searchSimilarNotes(embedding, undefined, searchQuery);

    const context =
      similarNotes.length > 0
        ? `Relevant sticky notes:\n${similarNotes.map((n, i) => `${i + 1}. "${n.description}"`).join("\n")}`
        : "No relevant sticky notes found.";

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    messages.push({
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${context}`,
    });

    const recentHistory = history.slice(-MAX_HISTORY);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    messages.push({
      role: "user",
      content: question,
    });
    const client = getClient();
    const response = await client.chat.completions.create({
      model: GENERATION_MODEL,
      messages,
    });

    const answer = response.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return {
      answer,
      sources: similarNotes,
    };
  },
};

async function rewriteQuery(question: string, history: Message[]): Promise<string> {
  if (history.length === 0) return question;

  const recentHistory = history.slice(-4); 
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const client = getClient();
  const response = await client.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      { role: "system", content: QUERY_REWRITE_PROMPT },
      { role: "user", content: `History:\n${historyText}\n\nFollow-up: ${question}` },
    ],
    temperature: 0,
  });

  const rewritten = response.choices?.[0]?.message?.content?.trim();
  return rewritten && rewritten.length > 0 ? rewritten : question;
}
