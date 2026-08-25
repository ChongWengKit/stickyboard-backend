import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface StoredChatMessage {
  id: number;
  ipAddress: string;
  role: string;
  ciphertext: string;
  iv: string;
  tag: string;
  createdAt: Date;
}

export const chatRepository = {
  async createMessage(data: {
    ipAddress: string;
    role: string;
    ciphertext: string;
    iv: string;
    tag: string;
  }): Promise<StoredChatMessage> {
    return await prisma.chatMessage.create({ data });
  },

  async getMessagesByIp(ipAddress: string): Promise<StoredChatMessage[]> {
    return await prisma.chatMessage.findMany({
      where: { ipAddress },
      orderBy: { createdAt: "desc" },
      take: 200
    });

  },
async getHistoryByIp(ipAddress: string): Promise<StoredChatMessage[]> {
    return await prisma.chatMessage.findMany({
      where: { ipAddress },
      orderBy: { createdAt: "desc" },
      take:5
    });

  },
  async deleteAllByIp(ipAddress: string) {
    return await prisma.chatMessage.deleteMany({ where: { ipAddress } });
  },
};
