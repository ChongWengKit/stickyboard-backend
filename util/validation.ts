export const MAX_NOTE_DESCRIPTION_LENGTH = 500;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_MESSAGES = 5;
export const MAX_HISTORY_MESSAGE_LENGTH = 2000;
export const MAX_NOTES_PER_IP = parseInt(process.env.MAX_NOTES_PER_IP || "5", 10);

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

export function isValidNoteDescription(description: string): boolean {
  return (
    typeof description === "string" &&
    description.trim().length > 0 &&
    description.trim().length <= MAX_NOTE_DESCRIPTION_LENGTH
  );
}

export function isValidChatMessage(message: string): boolean {
  return (
    typeof message === "string" &&
    message.trim().length > 0 &&
    message.trim().length <= MAX_CHAT_MESSAGE_LENGTH
  );
}

export function isValidHistoryMessage(msg: unknown): boolean {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as { role?: unknown; content?: unknown };
  if (m.role !== "user" && m.role !== "assistant") return false;
  return (
    typeof m.content === "string" &&
    m.content.trim().length > 0 &&
    m.content.trim().length <= MAX_HISTORY_MESSAGE_LENGTH
  );
}

export type SanitizedHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function sanitizeHistoryMessages(
  history: unknown
): SanitizedHistoryMessage[] {
  if (!Array.isArray(history)) return [];
  const sanitized: SanitizedHistoryMessage[] = [];
  for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
    if (typeof msg !== "object" || msg === null) continue;
    const m = msg as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content !== "string") continue;
    const content = m.content.trim();
    if (content.length === 0) continue;
    sanitized.push({
      role: m.role,
      content: content.slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    });
  }
  return sanitized;
}