import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt, generateEncryptionKey } from "../../util/crypto.js";

describe("crypto", () => {
  beforeEach(() => {
    process.env.CHAT_ENCRYPTION_KEY = "a".repeat(64);
  });

  it("should round-trip a message", () => {
    const payload = encrypt("hello world");
    expect(decrypt(payload)).toBe("hello world");
  });

  it("should produce different ciphertexts for the same plaintext (IV uniqueness)", () => {
    const a = encrypt("same message");
    const b = encrypt("same message");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("should not contain the plaintext in the encrypted payload", () => {
    const payload = encrypt("secret note content");
    expect(payload.ciphertext).not.toContain("secret note content");
  });

  it("should throw when the ciphertext is tampered with", () => {
    const payload = encrypt("important message");
    const raw = Buffer.from(payload.ciphertext, "base64");
    raw[0] = raw[0] ^ 0xff;
    const tampered = { ...payload, ciphertext: raw.toString("base64") };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should throw when the auth tag is tampered with", () => {
    const payload = encrypt("important message");
    const tamperedTag = {
      ...payload,
      tag: Buffer.from("00000000000000000000000000000000", "hex").toString("base64"),
    };
    expect(() => decrypt(tamperedTag)).toThrow();
  });

  it("should throw when CHAT_ENCRYPTION_KEY is missing", () => {
    delete process.env.CHAT_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow("CHAT_ENCRYPTION_KEY");
  });

  it("should generate a 64-char hex key", () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
