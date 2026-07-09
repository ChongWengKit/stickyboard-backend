import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrigger = vi.fn();

vi.mock("pusher", () => {
  return {
    default: class {
      trigger = mockTrigger;
    },
  };
});

const { triggerNoteAdded } = await import("../../src/service/pusherService.js");

describe("pusherService", () => {
  beforeEach(() => {
    mockTrigger.mockReset();
  });

  it("should trigger a note-added event with note data", async () => {
    mockTrigger.mockResolvedValue(undefined);

    const note = { id: "1", x: 100, y: 200, description: "Test", color: "green" };
    await triggerNoteAdded(note);

    expect(mockTrigger).toHaveBeenCalledWith("board", "note-added", note);
  });

  it("should not throw when pusher trigger fails", async () => {
    mockTrigger.mockRejectedValue(new Error("Pusher connection failed"));

    const note = { id: "2", x: 50, y: 50, description: "Failing note", color: "red" };
    await expect(triggerNoteAdded(note)).resolves.toBeUndefined();
  });
});