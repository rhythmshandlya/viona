import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { conversations, conversationMessages } from '../db/schema.js';

export async function getOrCreateConversation(projectId: string) {
  // Find existing conversation for this project
  const existing = await db.query.conversations.findFirst({
    where: eq(conversations.projectId, projectId),
    orderBy: desc(conversations.createdAt),
  });

  if (existing) return existing;

  // Create new conversation
  const [conversation] = await db.insert(conversations).values({
    projectId,
  }).returning();

  return conversation;
}

export async function getConversationMessages(conversationId: string) {
  return db.query.conversationMessages.findMany({
    where: eq(conversationMessages.conversationId, conversationId),
    orderBy: conversationMessages.createdAt,
  });
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: unknown,
) {
  const [message] = await db.insert(conversationMessages).values({
    conversationId,
    role,
    content,
  }).returning();

  // Update conversation timestamp
  await db.update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return message;
}

export async function deleteConversation(projectId: string) {
  await db.delete(conversations)
    .where(eq(conversations.projectId, projectId));
}

export async function getConversationWithMessages(projectId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.projectId, projectId),
    orderBy: desc(conversations.createdAt),
  });

  if (!conversation) return null;

  const messages = await getConversationMessages(conversation.id);

  return {
    conversationId: conversation.id,
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
