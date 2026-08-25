import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

function getKey(): Buffer {
  const value = process.env.CHAT_ENCRYPTION_KEY;
  if (!value) {
    throw new Error(
      "CHAT_ENCRYPTION_KEY is not configured in environment variables"
    );
  }
  const clean = value.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
        throw new Error(
            "CHAT_ENCRYPTION_KEY must be exactly 64 hexadecimal characters"
        );
    }

    return Buffer.from(clean, "hex");
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
