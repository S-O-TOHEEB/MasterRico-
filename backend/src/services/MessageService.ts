import { AppDataSource } from "../config/database.js";
import { Conversation } from "../entities/Conversation.js";
import { Message } from "../entities/Message.js";

export interface MessageListResult {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
}

export class MessageService {
  private convoRepo = AppDataSource.getRepository(Conversation);
  private msgRepo = AppDataSource.getRepository(Message);

  /** Canonical ordering so (A,B) and (B,A) always resolve to the same row */
  private orderPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return this.convoRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.participantA", "a")
      .leftJoinAndSelect("c.participantB", "b")
      .where("c.participantAId = :userId OR c.participantBId = :userId", { userId })
      .orderBy("c.lastMessageAt", "DESC", "NULLS LAST")
      .addOrderBy("c.createdAt", "DESC")
      .getMany();
  }

  async startOrGetConversation(userId: string, recipientId: string): Promise<Conversation> {
    if (!recipientId) throw new Error("recipientId is required");
    if (userId === recipientId) throw new Error("Cannot start a conversation with yourself");

    const [participantAId, participantBId] = this.orderPair(userId, recipientId);
    const existing = await this.convoRepo.findOneBy({ participantAId, participantBId });
    if (existing) return existing;

    const created = this.convoRepo.create({ participantAId, participantBId });
    return this.convoRepo.save(created);
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<Conversation> {
    const convo = await this.convoRepo.findOneBy({ id: conversationId });
    if (!convo) throw new Error("Conversation not found");
    if (convo.participantAId !== userId && convo.participantBId !== userId) {
      throw new Error("You are not part of this conversation");
    }
    return convo;
  }

  async listMessages(
    userId: string, conversationId: string, page = 1, limit = 50
  ): Promise<MessageListResult> {
    await this.assertParticipant(conversationId, userId);

    const [messages, total] = await this.msgRepo.findAndCount({
      where: { conversationId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { messages: messages.reverse(), total, page, totalPages: Math.ceil(total / limit) };
  }

  async sendMessage(userId: string, conversationId: string, body: string): Promise<Message> {
    if (!body || !body.trim()) throw new Error("Message body is required");
    const convo = await this.assertParticipant(conversationId, userId);

    const message = this.msgRepo.create({ conversationId, senderId: userId, body: body.trim() });
    const saved = await this.msgRepo.save(message);

    convo.lastMessagePreview = body.trim().slice(0, 140);
    convo.lastMessageAt = new Date();
    await this.convoRepo.save(convo);

    return saved;
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where("conversationId = :conversationId AND senderId != :userId AND isRead = false", {
        conversationId,
        userId,
      })
      .execute();
  }
}
