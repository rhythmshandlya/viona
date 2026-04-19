import { eq, desc } from 'drizzle-orm';
import { db, conversations, conversationMessages } from '../db/index.js';

// Mirror of `packages/api/src/agent/conversation-store.ts`. Subset used by the
// arrangement orchestrator (Task 11 / 13):
//   - getOrCreateConversation: resolves/creates the project's conversation row
//   - getConversationMessages: reads history (used to pull the first user prompt)
//   - addMessage: inserts pipeline / assistant messages

export async function getOrCreateConversation(projectId: string) {
  const existing = await db.query.conversations.findFirst({
    where: eq(conversations.projectId, projectId),
    orderBy: desc(conversations.createdAt),
  });

  if (existing) return existing;

  const [conversation] = await db.insert(conversations).values({
    projectId,
  }).returning();

  return conversation;
}

export async function getConversationMessages(conversationId: string, limit?: number) {
  if (limit) {
    const rows = await db.query.conversationMessages.findMany({
      where: eq(conversationMessages.conversationId, conversationId),
      orderBy: desc(conversationMessages.createdAt),
      limit,
    });
    return rows.reverse();
  }
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

  await db.update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return message;
}
