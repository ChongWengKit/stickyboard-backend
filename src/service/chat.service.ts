import { Groq } from "groq-sdk";
import { embeddingService } from "./embedding.service.js";
import { boardRepository } from "../respository/board.repository.js";
import {
  MAX_NOTE_DESCRIPTION_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_NOTES_PER_IP,
  isValidChatMessage,
  sanitizeHistoryMessages,
} from "../../util/validation.js";

let groq: any = null;

const QUERY_REWRITE_PROMPT = `You rewrite user questions into a short, keyword-focused search query for a sticky notes search system, and classify the request intent.

Return a JSON object with exactly two keys:
- "query": the rewritten keyword search query
- "type": either "broad" or "specific"

RULES:
1. Only use conversation history if the current question clearly depends on it — e.g. it uses a pronoun or reference like "that one", "the food one", "what about X", "and the second one", or is otherwise incomplete without prior context.
2. If the question is understandable on its own, do NOT use the history at all. Return it unchanged (or lightly cleaned — see rule 3), even if the topic is similar to previous messages.
3. Keep the output SHORT and keyword-like — strip greetings, filler phrases ("are there any", "I was wondering if", "can you tell me", "what can i"), and politeness words. Preserve the core nouns/topics only.
4. Translate conversational intent or implied needs into searchable keywords (e.g., convert "what can i buy" or "what do I need to get" into items like "buy shopping groceries").
5. Never add words, context, or assumptions that aren't clearly implied by the history or the question itself. Do not paraphrase into a longer or more formal sentence than necessary.
6. Do not change singular/plural or word forms unnecessarily.

Set "type":
- "broad" ONLY if the user wants an overview or aggregate of the whole board / all notes — e.g. summaries, recaps, "what's on the board", "list all my notes", "give me an overview of everything".
- "specific" for any other request about a particular topic, item, task, or detail.

Return ONLY the JSON object, nothing else — no markdown fences, no explanation.

Examples:
History: (none)
Follow-up: "what can i buy"
Output: {"query": "buy shopping groceries", "type": "specific"}

History: (none)
Follow-up: "give me the summary of all the notes board"
Output: {"query": "summary board", "type": "broad"}

History: (none)
Follow-up: "what's on the board right now"
Output: {"query": "board", "type": "broad"}

History:
User: what tasks do I have
Assistant: You have a grocery task and a travel task.
Follow-up: "the food one"
Output: {"query": "food task", "type": "specific"}`;

const SYSTEM_PROMPT = `You are an assistant for a sticky notes board. Answer ONLY using the notes given to you below. Do not use outside knowledge.

BOARD LIMITS AND RULES (know these so you can answer questions about them):
- Users can add at most ${MAX_NOTES_PER_IP} notes per IP address.
- Each note's description/text can be at most ${MAX_NOTE_DESCRIPTION_LENGTH} characters.
- Notes have a color chosen from a hex color picker (e.g. #ffffff, #ff0000) — not explicitly limited, but always a valid hex color.
- Chat messages (questions) can be at most ${MAX_CHAT_MESSAGE_LENGTH} characters.
- If the user asks about these limits, answer using the exact numbers above.

HOW TO ANSWER:
1. Read every note given to you, fully, before answering.
2. If the question asks for "any", "all", or a list of things, find EVERY matching detail in the notes — even small ones. List them all. Do not skip any.
3. If the relevant details all come from ONE note, describe it as one note. Only say "another note" if the details truly come from two different notes.
4. If nothing in the notes answers the question, say so plainly. Do not guess or add details that aren't written in the notes.
5. Describe notes naturally and neutrally — say "one note says...", "a note on the board mentions...", or "the notes show...". Do NOT say "your notes" or "your task" — you don't know who wrote each note, and the board may be shared by multiple people.
6. Do not mention note IDs, scores, "context", "JSON", or how you work.
7. If the question is about your capabilities (e.g. "what can you do?", "what can the bot do?", "what are you?"), explain that you can answer questions about the sticky notes on the board — you can find, summarize, and list information from the notes. Do NOT refuse to answer.
8. If the question is clearly not about the sticky notes board and not about your capabilities (e.g. general knowledge, current events, personal advice), reply exactly: "I can only answer questions about the sticky notes board."
9. Keep every answer SHORT. For a whole-board summary, use a compact bullet list — one short line per note, keywords only, no filler sentences, no repeating a note's text back at length. Aim for under ~1500 characters total. Only go longer when the user explicitly asks for detail.
Be brief but complete — every bullet earns its place.`;


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
    if (!isValidChatMessage(question)) {
      throw new Error("VALIDATION_ERROR");
    }
    if (!Array.isArray(history)) {
      throw new Error("VALIDATION_ERROR");
    }
    const sanitizedHistory = sanitizeHistoryMessages(history);
    const { query: searchQuery, type } = await rewriteQuery(
      question,
      sanitizedHistory
    );
    let similarNotes;
    if (type === "broad") {
      const allNotes = await boardRepository.getAllNotes();
      similarNotes = allNotes.map((n) => ({
        id: n.id,
        description: n.description,
        similarity: 1,
      }));
    } else {
      const embedding = await embeddingService.generateEmbedding(searchQuery);
      similarNotes = await boardRepository.searchSimilarNotes(embedding, undefined, searchQuery);
    }

    const context =
      similarNotes.length > 0
        ? `${type === "broad" ? "All notes currently on the sticky board" : "Relevant sticky notes"}:\n${similarNotes.map((n, i) => `${i + 1}. "${n.description}"`).join("\n")}`
        : "No relevant sticky notes found.";

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    messages.push({
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${context}`,
    });

    const recentHistory = sanitizedHistory.slice(-MAX_HISTORY_MESSAGES);
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

interface RewrittenQuery {
  query: string;
  type: "broad" | "specific";
}

function parseRewriteCompletion(
  raw: string | undefined,
  fallbackQuery: string
): RewrittenQuery {
  if (raw) {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = fenced ? fenced[1] : trimmed;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const p = parsed as Partial<RewrittenQuery>;
        const query =
          typeof p.query === "string" && p.query.trim()
            ? p.query.trim()
            : fallbackQuery;
        const type = p.type === "broad" ? "broad" : "specific";
        return { query, type };
      }
    } catch {
    }
  }
  return { query: fallbackQuery, type: "specific" };
}

async function rewriteQuery(
  question: string,
  history: Message[]
): Promise<RewrittenQuery> {
  if (history.length === 0) {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: GENERATION_MODEL,
      messages: [
        { role: "system", content: QUERY_REWRITE_PROMPT },
        { role: "user", content: `History: (none)\n\nFollow-up: ${question}` },
      ],
      temperature: 0,
    });

    const rewritten = response.choices?.[0]?.message?.content?.trim();
    return parseRewriteCompletion(rewritten, question);
  }

  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES); 
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

  return parseRewriteCompletion(rewritten, question);
}
