import { describe, it, expect } from "vitest";
import {
  MAX_NOTE_DESCRIPTION_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  isValidHexColor,
  isValidNoteDescription,
  isValidChatMessage,
  isValidHistoryMessage,
  sanitizeHistoryMessages,
} from "../../util/validation.js";

describe("validation util", () => {
  describe("isValidHexColor", () => {
    it("should accept 6-digit hex colors", () => {
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("#000000")).toBe(true);
      expect(isValidHexColor("#FF0000")).toBe(true);
      expect(isValidHexColor("#a1B2C3")).toBe(true);
    });

    it("should accept 3-digit hex colors", () => {
      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#000")).toBe(true);
      expect(isValidHexColor("#F00")).toBe(true);
    });

    it("should reject invalid colors", () => {
      expect(isValidHexColor("white")).toBe(false);
      expect(isValidHexColor("blue")).toBe(false);
      expect(isValidHexColor("#ffff")).toBe(false);
      expect(isValidHexColor("#fffffff")).toBe(false);
      expect(isValidHexColor("")).toBe(false);
      expect(isValidHexColor("#12")).toBe(false);
      expect(isValidHexColor("ffffff")).toBe(false);
      expect(isValidHexColor("#zzz")).toBe(false);
    });
  });

  describe("isValidNoteDescription", () => {
    it("should accept valid descriptions", () => {
      expect(isValidNoteDescription("Buy groceries")).toBe(true);
      expect(isValidNoteDescription("a".repeat(MAX_NOTE_DESCRIPTION_LENGTH))).toBe(true);
    });

    it("should reject empty or whitespace-only descriptions", () => {
      expect(isValidNoteDescription("")).toBe(false);
      expect(isValidNoteDescription("   ")).toBe(false);
    });

    it("should reject descriptions that are too long", () => {
      expect(isValidNoteDescription("a".repeat(MAX_NOTE_DESCRIPTION_LENGTH + 1))).toBe(false);
    });

    it("should reject non-string values", () => {
      expect(isValidNoteDescription(123 as any)).toBe(false);
      expect(isValidNoteDescription(null as any)).toBe(false);
      expect(isValidNoteDescription(undefined as any)).toBe(false);
    });
  });

  describe("isValidChatMessage", () => {
    it("should accept valid messages", () => {
      expect(isValidChatMessage("Hello")).toBe(true);
      expect(isValidChatMessage("a".repeat(MAX_CHAT_MESSAGE_LENGTH))).toBe(true);
    });

    it("should reject empty or whitespace-only messages", () => {
      expect(isValidChatMessage("")).toBe(false);
      expect(isValidChatMessage("   ")).toBe(false);
    });

    it("should reject messages that are too long", () => {
      expect(isValidChatMessage("a".repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toBe(false);
    });

    it("should reject non-string values", () => {
      expect(isValidChatMessage(123 as any)).toBe(false);
      expect(isValidChatMessage(null as any)).toBe(false);
      expect(isValidChatMessage(undefined as any)).toBe(false);
    });
  });

  describe("isValidHistoryMessage", () => {
    it("should accept valid history messages", () => {
      expect(isValidHistoryMessage({ role: "user", content: "Hello" })).toBe(true);
      expect(isValidHistoryMessage({ role: "assistant", content: "Hi there" })).toBe(true);
      expect(isValidHistoryMessage({ role: "user", content: "a".repeat(MAX_HISTORY_MESSAGE_LENGTH) })).toBe(true);
    });

    it("should reject messages with invalid roles", () => {
      expect(isValidHistoryMessage({ role: "system", content: "Hello" })).toBe(false);
      expect(isValidHistoryMessage({ role: "bot", content: "Hello" })).toBe(false);
      expect(isValidHistoryMessage({ content: "Hello" })).toBe(false);
    });

    it("should reject messages with empty or missing content", () => {
      expect(isValidHistoryMessage({ role: "user", content: "" })).toBe(false);
      expect(isValidHistoryMessage({ role: "user", content: "   " })).toBe(false);
      expect(isValidHistoryMessage({ role: "user" })).toBe(false);
    });

    it("should reject messages with content that is too long", () => {
      expect(isValidHistoryMessage({ role: "user", content: "a".repeat(MAX_HISTORY_MESSAGE_LENGTH + 1) })).toBe(false);
    });

    it("should reject non-object values", () => {
      expect(isValidHistoryMessage("hello")).toBe(false);
      expect(isValidHistoryMessage(42)).toBe(false);
      expect(isValidHistoryMessage(null)).toBe(false);
      expect(isValidHistoryMessage(undefined)).toBe(false);
    });
  });

  describe("sanitizeHistoryMessages", () => {
    it("should return [] for non-array input", () => {
      expect(sanitizeHistoryMessages("nope")).toEqual([]);
      expect(sanitizeHistoryMessages(42)).toEqual([]);
      expect(sanitizeHistoryMessages(null)).toEqual([]);
      expect(sanitizeHistoryMessages(undefined)).toEqual([]);
    });

    it("should keep only valid, non-empty messages in order", () => {
      const result = sanitizeHistoryMessages([
        { role: "user", content: "oldest" },
        { role: "system", content: "skip me" },
        { role: "user", content: "   " },
        { role: "user", content: 123 },
        { role: "assistant", content: "recent" },
      ]);
      expect(result).toEqual([
        { role: "user", content: "oldest" },
        { role: "assistant", content: "recent" },
      ]);
    });

    it("should clamp content to MAX_HISTORY_MESSAGE_LENGTH", () => {
      const long = "a".repeat(MAX_HISTORY_MESSAGE_LENGTH + 50);
      const result = sanitizeHistoryMessages([{ role: "user", content: long }]);
      expect(result).toHaveLength(1);
      expect(result[0].content.length).toBe(MAX_HISTORY_MESSAGE_LENGTH);
    });

    it("should keep only the most recent messages", () => {
      const many = Array.from({ length: 25 }, (_, i) => ({
        role: "user" as const,
        content: `msg-${i}`,
      }));
      const result = sanitizeHistoryMessages(many);
      expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
      expect(result[0].content).toBe("msg-20");
      expect(result[result.length - 1].content).toBe("msg-24");
    });
  });
});