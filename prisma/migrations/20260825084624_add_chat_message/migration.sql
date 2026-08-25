CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_ipAddress_createdAt_idx" ON "ChatMessage"("ipAddress", "createdAt");
