# Creative Director Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a conversational AI agent (Creative Director) that lives in the editor's assistant panel and orchestrates visual generation and editing through natural dialogue with streaming responses and inline widgets.

**Architecture:** Server-side agent on Fastify using Claude API with tool use, streaming responses to the frontend via SSE. The agent is a conversational layer that delegates to the existing generation (`claude_visual_generator.py`) and editing (`edit-visuals.ts`) pipelines. Conversations persist in PostgreSQL.

**Tech Stack:** Anthropic SDK (Claude API with tools), Fastify SSE streaming, Drizzle ORM (PostgreSQL), Zustand (frontend state), React (widget components)

**Design Doc:** `docs/plans/2026-02-15-creative-director-agent-design.md`

---

### Task 1: Add Anthropic SDK Dependency

**Files:**
- Modify: `packages/api/package.json`

**Step 1: Install the Anthropic SDK**

Run: `cd packages/api && pnpm add @anthropic-ai/sdk`

**Step 2: Add ANTHROPIC_API_KEY to config**

Modify: `packages/api/src/config.ts`

Add to the config object:
```typescript
anthropic: {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
},
```

**Step 3: Update .env.example**

Modify: `.env.example`

Add:
```
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

**Step 4: Commit**

```bash
git add packages/api/package.json packages/api/src/config.ts .env.example pnpm-lock.yaml
git commit -m "chore: add Anthropic SDK dependency for Creative Director agent"
```

---

### Task 2: Database Schema — Conversation Tables

**Files:**
- Modify: `packages/api/src/db/schema.ts`

**Step 1: Add conversation tables to schema**

Add after the existing `visuals` table definition in `packages/api/src/db/schema.ts`:

```typescript
// Conversations for Creative Director agent
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'user' | 'assistant'
  content: jsonb('content').notNull(), // Array of MessageContent blocks
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
```

**Step 2: Generate migration**

Run: `cd packages/api && pnpm drizzle-kit generate`

Check the generated migration file in `packages/api/src/db/migrations/` and verify it creates the two tables.

**Step 3: Run migration**

Run: `cd packages/api && pnpm drizzle-kit push`

**Step 4: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/src/db/migrations/
git commit -m "feat: add conversation tables for Creative Director agent"
```

---

### Task 3: Conversation Store — CRUD Operations

**Files:**
- Create: `packages/api/src/agent/conversation-store.ts`

**Step 1: Create the agent directory**

Run: `mkdir -p packages/api/src/agent`

**Step 2: Write the conversation store**

Create `packages/api/src/agent/conversation-store.ts`:

```typescript
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
```

**Step 3: Verify Drizzle relations are set up**

Check `packages/api/src/db/schema.ts` for a `relations` export. If using `db.query.*`, the tables need to be registered in the Drizzle client. Verify `packages/api/src/db/index.ts` exports the schema properly.

**Step 4: Commit**

```bash
git add packages/api/src/agent/conversation-store.ts
git commit -m "feat: add conversation store for CRUD operations"
```

---

### Task 4: Agent System Prompt Builder

**Files:**
- Create: `packages/api/src/agent/agent-system-prompt.ts`

**Step 1: Write the system prompt builder**

Create `packages/api/src/agent/agent-system-prompt.ts`:

```typescript
interface ProjectContext {
  projectId: string;
  title: string | null;
  canvasWidth: number;
  canvasHeight: number;
  durationMs: number | null;
  fps: number;
  hasTranscript: boolean;
  hasVisuals: boolean;
  sceneCount: number;
}

export function buildSystemPrompt(ctx: ProjectContext): string {
  return `You are the Creative Director for Viona — an AI that helps users create and refine visual animations for their talking-head explainer videos.

PROJECT CONTEXT:
- Project: ${ctx.title || 'Untitled'}
- Canvas: ${ctx.canvasWidth}x${ctx.canvasHeight}
- Duration: ${ctx.durationMs ? (ctx.durationMs / 1000).toFixed(1) + 's' : 'unknown'}
- FPS: ${ctx.fps}
- Transcript: ${ctx.hasTranscript ? 'available' : 'not available'}
- Existing visuals: ${ctx.hasVisuals ? `yes (${ctx.sceneCount} scenes)` : 'none'}

YOUR ROLE:
You help users plan, generate, and refine AI-generated visual animations that illustrate their video content. You're creative, concise, and opinionated — like a real creative director.

CAPABILITIES (via tools):
- Analyze transcript sections to understand what the user is explaining
- Show interactive widgets (theme picker, layout picker) for user preferences
- Propose a scene-by-scene visual plan for user approval
- Trigger visual generation using the approved plan
- Make targeted edits to specific scenes
- Answer questions about existing visuals

BEHAVIOR RULES:
1. Be concise. You're a director, not a lecturer. Keep responses short and actionable.
2. When the user selects a timeline range, use analyze_transcript to understand the content before suggesting anything.
3. For new generation: gather preferences using widgets (theme, layout), then propose a scene plan. Wait for approval before generating.
4. For edits: if the request is clear, just do it. If ambiguous, ask ONE clarifying question.
5. Never expose technical details (Remotion, BullMQ, TypeScript, etc.) to the user. Speak in terms of "scenes", "animations", "visuals", "styles".
6. When showing a scene plan, be specific about what each scene will visualize — use concrete descriptions, not generic labels.
7. After generation completes, briefly describe what was created and invite feedback.

STYLE PRESETS (for reference when discussing themes):
- minimal: Clean geometric shapes, monochrome palette, subtle animations
- modern: Vibrant gradients, smooth transitions, purple-to-blue palette
- playful: Bright colors, bouncy animations, energetic feel
- bold: High contrast, large text, impactful animations
- classic: Muted tones, elegant typography, professional feel

LAYOUT OPTIONS:
- pip: Picture-in-Picture — visuals fullscreen, video as small overlay
- split-horizontal: Side-by-side — video and visuals next to each other
- split-vertical: Stacked — video and visuals above/below each other`;
}
```

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "feat: add Creative Director system prompt builder"
```

---

### Task 5: Agent Tool Definitions

**Files:**
- Create: `packages/api/src/agent/agent-tools.ts`

**Step 1: Write tool definitions and executors**

Create `packages/api/src/agent/agent-tools.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, visuals, transcripts } from '../db/schema.js';
import { queueGenerateVisualsJob, queueEditVisualsJob } from '../services/queue.js';
import { nanoid } from 'nanoid';

// Tool definitions for Claude API
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'analyze_transcript',
    description: 'Read the transcript text and word-level timestamps for a specific time range of the video. Use this to understand what the user is explaining in a section before suggesting visuals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startMs: { type: 'number', description: 'Start time in milliseconds' },
        endMs: { type: 'number', description: 'End time in milliseconds' },
      },
      required: ['startMs', 'endMs'],
    },
  },
  {
    name: 'get_current_visuals',
    description: 'Get a list of all existing visual scenes for this project, including their timing, descriptions, and IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_scene_details',
    description: 'Get detailed information about a specific scene, including its description, timing, and visual elements.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sceneId: { type: 'number', description: 'The scene number (1-indexed)' },
      },
      required: ['sceneId'],
    },
  },
  {
    name: 'show_widget',
    description: 'Show an interactive widget in the chat for the user to make a selection. Use this to collect preferences like theme/style, layout mode, or confirmations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: {
          type: 'string',
          enum: ['theme_picker', 'layout_picker', 'confirmation'],
          description: 'The type of widget to show',
        },
        message: {
          type: 'string',
          description: 'Optional message to display with the widget',
        },
      },
      required: ['kind'],
    },
  },
  {
    name: 'propose_plan',
    description: 'Present a scene-by-scene visual plan for the user to approve or modify before generation begins. Each scene should have a time range and description of what will be visualized.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startMs: { type: 'number' },
              endMs: { type: 'number' },
              title: { type: 'string', description: 'Short scene title' },
              description: { type: 'string', description: 'What this scene will visualize' },
            },
            required: ['startMs', 'endMs', 'title', 'description'],
          },
        },
      },
      required: ['scenes'],
    },
  },
  {
    name: 'generate_visuals',
    description: 'Start generating visuals using the approved plan. This triggers the generation pipeline. Only call this after the user has approved the plan and selected a theme and layout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stylePreset: {
          type: 'string',
          enum: ['minimal', 'modern', 'playful', 'bold', 'classic'],
        },
        layoutMode: {
          type: 'string',
          enum: ['pip', 'split-horizontal', 'split-vertical'],
        },
        styleGuide: {
          type: 'string',
          description: 'Additional style guidance from the conversation',
        },
      },
      required: ['stylePreset', 'layoutMode'],
    },
  },
  {
    name: 'edit_visuals',
    description: 'Make a targeted edit to existing visuals. Can target a specific scene or the entire composition. Use this when the user wants to change something about existing visuals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the edit to make',
        },
        sceneId: {
          type: 'number',
          description: 'Target specific scene (1-indexed). Omit for auto-detection.',
        },
        elementName: {
          type: 'string',
          description: 'Target a specific element within a scene',
        },
      },
      required: ['prompt'],
    },
  },
];

// Tool executor context
interface ToolContext {
  projectId: string;
  sendSSE: (event: string, data: unknown) => void;
}

// Execute a tool call and return the result
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  switch (toolName) {
    case 'analyze_transcript':
      return analyzeTranscript(ctx.projectId, toolInput as { startMs: number; endMs: number });

    case 'get_current_visuals':
      return getCurrentVisuals(ctx.projectId);

    case 'get_scene_details':
      return getSceneDetails(ctx.projectId, toolInput as { sceneId: number });

    case 'show_widget': {
      const { kind, message } = toolInput as { kind: string; message?: string };
      const widgetId = nanoid(8);
      ctx.sendSSE('widget', { id: widgetId, kind, message });
      return JSON.stringify({ widgetId, status: 'shown', waitingForUserResponse: true });
    }

    case 'propose_plan': {
      const { scenes } = toolInput as { scenes: Array<{ startMs: number; endMs: number; title: string; description: string }> };
      const widgetId = nanoid(8);
      ctx.sendSSE('widget', {
        id: widgetId,
        kind: 'scene_plan',
        scenes,
        requiresApproval: true,
      });
      return JSON.stringify({ widgetId, status: 'shown', waitingForApproval: true });
    }

    case 'generate_visuals':
      return triggerGeneration(ctx.projectId, toolInput as {
        stylePreset: string;
        layoutMode: string;
        styleGuide?: string;
      }, ctx);

    case 'edit_visuals':
      return triggerEdit(ctx.projectId, toolInput as {
        prompt: string;
        sceneId?: number;
        elementName?: string;
      }, ctx);

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function analyzeTranscript(projectId: string, input: { startMs: number; endMs: number }) {
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.projectId, projectId),
  });

  if (!transcript || !transcript.words) {
    return JSON.stringify({ error: 'No transcript available. The user needs to transcribe the video first.' });
  }

  const words = (transcript.words as Array<{ word: string; startMs: number; endMs: number }>)
    .filter(w => w.startMs >= input.startMs && w.endMs <= input.endMs);

  const text = words.map(w => w.word).join(' ');

  return JSON.stringify({
    text,
    wordCount: words.length,
    startMs: input.startMs,
    endMs: input.endMs,
    durationMs: input.endMs - input.startMs,
  });
}

async function getCurrentVisuals(projectId: string) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual || !visual.timestamps) {
    return JSON.stringify({ scenes: [], message: 'No visuals generated yet.' });
  }

  const scenes = (visual.timestamps as Array<{ startMs: number; endMs: number; type: string; description: string }>)
    .map((s, i) => ({
      sceneId: i + 1,
      startMs: s.startMs,
      endMs: s.endMs,
      title: s.type,
      description: s.description,
    }));

  return JSON.stringify({
    compositionId: visual.compositionId,
    sceneCount: scenes.length,
    scenes,
    stylePreset: visual.stylePreset,
  });
}

async function getSceneDetails(projectId: string, input: { sceneId: number }) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual || !visual.timestamps) {
    return JSON.stringify({ error: 'No visuals found.' });
  }

  const timestamps = visual.timestamps as Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
    elements?: Array<{ id: string; name: string; type: string }>;
  }>;

  const scene = timestamps[input.sceneId - 1];
  if (!scene) {
    return JSON.stringify({ error: `Scene ${input.sceneId} not found. There are ${timestamps.length} scenes.` });
  }

  return JSON.stringify({
    sceneId: input.sceneId,
    ...scene,
  });
}

async function triggerGeneration(
  projectId: string,
  input: { stylePreset: string; layoutMode: string; styleGuide?: string },
  ctx: ToolContext,
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return JSON.stringify({ error: 'Project not found.' });
  }

  // Calculate visual dimensions based on layout
  const canvasWidth = (project.videoSettings as any)?.canvasWidth || 1080;
  const canvasHeight = (project.videoSettings as any)?.canvasHeight || 1920;

  let dimensions = { width: canvasWidth, height: canvasHeight };
  if (input.layoutMode === 'split-horizontal') {
    dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
  } else if (input.layoutMode === 'split-vertical') {
    dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
  }

  // Create job record
  const [job] = await db.insert(jobs).values({
    projectId,
    type: 'generate-visuals',
    status: 'pending',
  }).returning();

  // Queue the job
  await queueGenerateVisualsJob({
    projectId,
    jobId: job.id,
    stylePreset: input.stylePreset as any,
    layoutMode: input.layoutMode as any,
    dimensions,
    styleGuide: input.styleGuide,
  });

  ctx.sendSSE('progress', { percent: 5, message: 'Starting visual generation...' });

  return JSON.stringify({
    jobId: job.id,
    status: 'queued',
    message: 'Visual generation started. Progress will stream in the chat.',
  });
}

async function triggerEdit(
  projectId: string,
  input: { prompt: string; sceneId?: number; elementName?: string },
  ctx: ToolContext,
) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual) {
    return JSON.stringify({ error: 'No visuals to edit. Generate visuals first.' });
  }

  // Create job record
  const [job] = await db.insert(jobs).values({
    projectId,
    type: 'edit-visuals',
    status: 'pending',
  }).returning();

  // Queue the edit job
  await queueEditVisualsJob({
    projectId,
    jobId: job.id,
    compositionId: visual.compositionId,
    prompt: input.prompt,
    sceneId: input.sceneId,
    elementName: input.elementName,
  });

  ctx.sendSSE('progress', { percent: 5, message: 'Starting edit...' });

  return JSON.stringify({
    jobId: job.id,
    status: 'queued',
    message: 'Edit job started. Progress will stream in the chat.',
  });
}
```

**Step 2: Verify imports**

Check that `transcripts` table exists in schema and `queueEditVisualsJob` exists in queue service. The `jobs` table import may also be needed — verify exact import names in schema.ts.

**Step 3: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat: add agent tool definitions and executors"
```

---

### Task 6: Agent Router — SSE Streaming Endpoint

**Files:**
- Create: `packages/api/src/agent/agent-router.ts`
- Modify: `packages/api/src/index.ts` (register route)

**Step 1: Write the agent router**

Create `packages/api/src/agent/agent-router.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { buildSystemPrompt } from './agent-system-prompt.js';
import { toolDefinitions, executeTool } from './agent-tools.js';
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  deleteConversation,
  getConversationWithMessages,
} from './conversation-store.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, visuals, transcripts, jobs } from '../db/schema.js';
import Redis from 'ioredis';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

export async function agentRoutes(fastify: FastifyInstance) {
  // POST /projects/:id/agent/chat — SSE streaming chat
  fastify.post(
    '/projects/:id/agent/chat',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      const body = request.body as {
        message: string;
        context?: {
          selectedTimeRange?: { startMs: number; endMs: number };
          selectedSceneId?: number;
          selectedElement?: { name: string; sceneId: number };
        };
        widgetResponse?: { widgetId: string; value: unknown };
      };

      // Load project
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Build project context for system prompt
      const visual = await db.query.visuals.findFirst({
        where: eq(visuals.projectId, projectId),
      });
      const transcript = await db.query.transcripts.findFirst({
        where: eq(transcripts.projectId, projectId),
      });

      const timestamps = visual?.timestamps as Array<any> | null;

      const systemPrompt = buildSystemPrompt({
        projectId,
        title: project.title,
        canvasWidth: (project.videoSettings as any)?.canvasWidth || 1080,
        canvasHeight: (project.videoSettings as any)?.canvasHeight || 1920,
        durationMs: project.durationMs,
        fps: project.fps || 30,
        hasTranscript: !!transcript,
        hasVisuals: !!visual,
        sceneCount: timestamps?.length || 0,
      });

      // Get or create conversation
      const conversation = await getOrCreateConversation(projectId);
      const previousMessages = await getConversationMessages(conversation.id);

      // Build user message content
      let userMessageText = body.message;
      if (body.context?.selectedTimeRange) {
        userMessageText += `\n\n[User has selected timeline range: ${body.context.selectedTimeRange.startMs}ms - ${body.context.selectedTimeRange.endMs}ms]`;
      }
      if (body.context?.selectedSceneId) {
        userMessageText += `\n\n[User has selected scene ${body.context.selectedSceneId}]`;
      }
      if (body.context?.selectedElement) {
        userMessageText += `\n\n[User has selected element "${body.context.selectedElement.name}" in scene ${body.context.selectedElement.sceneId}]`;
      }
      if (body.widgetResponse) {
        userMessageText += `\n\n[User responded to widget ${body.widgetResponse.widgetId}: ${JSON.stringify(body.widgetResponse.value)}]`;
      }

      // Save user message
      await addMessage(conversation.id, 'user', [{ type: 'text', text: userMessageText }]);

      // Build Claude messages from conversation history
      const claudeMessages: Anthropic.MessageParam[] = previousMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: convertStoredContentToClaudeFormat(m.content),
      }));

      // Add current user message
      claudeMessages.push({
        role: 'user',
        content: userMessageText,
      });

      // Set up SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const sendSSE = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const toolCtx = { projectId, sendSSE };

      try {
        // Agentic loop: keep calling Claude until no more tool_use
        let currentMessages = claudeMessages;
        let fullAssistantContent: unknown[] = [];

        while (true) {
          // Stream Claude's response
          const stream = anthropic.messages.stream({
            model: config.anthropic.model,
            max_tokens: 4096,
            system: systemPrompt,
            tools: toolDefinitions,
            messages: currentMessages,
          });

          let assistantContentBlocks: Anthropic.ContentBlock[] = [];
          let hasToolUse = false;

          // Stream text chunks as they arrive
          stream.on('text', (text) => {
            sendSSE('text', { content: text });
          });

          const response = await stream.finalMessage();
          assistantContentBlocks = response.content;
          fullAssistantContent = [...fullAssistantContent, ...assistantContentBlocks];

          // Check for tool use
          const toolUseBlocks = assistantContentBlocks.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );

          if (toolUseBlocks.length === 0) {
            // No more tool calls — we're done
            break;
          }

          hasToolUse = true;

          // Execute tools and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            const result = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              toolCtx,
            );

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result,
            });

            // For generate/edit tools, monitor job progress
            if (toolUse.name === 'generate_visuals' || toolUse.name === 'edit_visuals') {
              const resultData = JSON.parse(result);
              if (resultData.jobId) {
                await monitorJobProgress(resultData.jobId, sendSSE);
              }
            }
          }

          // Continue the conversation with tool results
          currentMessages = [
            ...currentMessages,
            { role: 'assistant' as const, content: assistantContentBlocks },
            { role: 'user' as const, content: toolResults },
          ];
        }

        // Save assistant response
        const textContent = fullAssistantContent
          .filter((block: any) => block.type === 'text')
          .map((block: any) => ({ type: 'text', text: block.text }));
        await addMessage(conversation.id, 'assistant', textContent);

        sendSSE('done', { conversationId: conversation.id });
      } catch (error: any) {
        sendSSE('error', { message: error.message || 'An error occurred' });
      } finally {
        reply.raw.end();
      }
    }
  );

  // GET /projects/:id/agent/conversation — Get conversation history
  fastify.get(
    '/projects/:id/agent/conversation',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      const conversation = await getConversationWithMessages(projectId);

      if (!conversation) {
        return { conversationId: null, messages: [] };
      }

      return conversation;
    }
  );

  // DELETE /projects/:id/agent/conversation — Clear conversation
  fastify.delete(
    '/projects/:id/agent/conversation',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { id: projectId } = request.params as { id: string };
      await deleteConversation(projectId);
      return { success: true };
    }
  );
}

// Monitor a BullMQ job and stream progress via SSE
async function monitorJobProgress(jobId: string, sendSSE: (event: string, data: unknown) => void) {
  const redis = new Redis(config.redis.url);
  const channel = `job:${jobId}:progress`;

  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (!job) {
        clearInterval(checkInterval);
        redis.disconnect();
        resolve();
        return;
      }

      sendSSE('progress', {
        percent: job.progress,
        message: job.progressMessage || `Processing... ${job.progress}%`,
      });

      if (job.status === 'complete' || job.status === 'failed') {
        clearInterval(checkInterval);
        redis.disconnect();

        if (job.status === 'failed') {
          sendSSE('progress', { percent: 100, message: 'Generation failed', error: true });
        } else {
          sendSSE('progress', { percent: 100, message: 'Complete!' });
        }
        resolve();
      }
    }, 2000);

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      redis.disconnect();
      resolve();
    }, 600000);
  });
}

// Convert stored message content to Claude API format
function convertStoredContentToClaudeFormat(content: unknown): string | Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => ({
        type: 'text' as const,
        text: block.text,
      }));
  }
  return JSON.stringify(content);
}
```

**Step 2: Register the route**

Modify `packages/api/src/index.ts`. Find the route registration section and add:

```typescript
import { agentRoutes } from './agent/agent-router.js';

// Add after existing route registrations:
await fastify.register(agentRoutes, { prefix: '/api' });
```

**Step 3: Commit**

```bash
git add packages/api/src/agent/agent-router.ts packages/api/src/index.ts
git commit -m "feat: add agent router with SSE streaming endpoint"
```

---

### Task 7: Frontend API Client Methods

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add agent API methods to ApiClient class**

Add to the `ApiClient` class in `apps/web/src/lib/api.ts`:

```typescript
// Agent chat — returns an EventSource-like interface for SSE
async chatWithAgent(
  projectId: string,
  body: {
    message: string;
    context?: {
      selectedTimeRange?: { startMs: number; endMs: number };
      selectedSceneId?: number;
      selectedElement?: { name: string; sceneId: number };
    };
    widgetResponse?: { widgetId: string; value: unknown };
  },
): Promise<ReadableStream<Uint8Array>> {
  const url = `${this.baseUrl}/api/projects/${projectId}/agent/chat`;
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  return response.body;
}

// Get conversation history
async getConversation(projectId: string): Promise<{
  conversationId: string | null;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: unknown;
    createdAt: string;
  }>;
}> {
  return this.request(`/api/projects/${projectId}/agent/conversation`);
}

// Clear conversation
async clearConversation(projectId: string): Promise<{ success: boolean }> {
  return this.request(`/api/projects/${projectId}/agent/conversation`, {
    method: 'DELETE',
  });
}
```

**Step 2: Add SSE parser utility**

Create `apps/web/src/lib/sse-parser.ts`:

```typescript
export interface SSEEvent {
  event: string;
  data: unknown;
}

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim();
        } else if (line === '' && currentEvent && currentData) {
          try {
            yield { event: currentEvent, data: JSON.parse(currentData) };
          } catch {
            yield { event: currentEvent, data: currentData };
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/sse-parser.ts
git commit -m "feat: add agent API client methods and SSE parser"
```

---

### Task 8: Frontend Widget Components

**Files:**
- Create: `apps/web/src/features/editor-v2/components/agent-widgets/ThemePicker.tsx`
- Create: `apps/web/src/features/editor-v2/components/agent-widgets/LayoutPicker.tsx`
- Create: `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx`
- Create: `apps/web/src/features/editor-v2/components/agent-widgets/ConfirmationWidget.tsx`
- Create: `apps/web/src/features/editor-v2/components/agent-widgets/index.ts`

**Step 1: Create widget directory**

Run: `mkdir -p apps/web/src/features/editor-v2/components/agent-widgets`

**Step 2: Create ThemePicker widget**

Create `apps/web/src/features/editor-v2/components/agent-widgets/ThemePicker.tsx`:

```tsx
import React from 'react';

const themes = [
  { id: 'minimal', label: 'Minimal', description: 'Clean, geometric, monochrome', colors: ['#1a1a2e', '#e2e8f0', '#94a3b8'] },
  { id: 'modern', label: 'Modern', description: 'Vibrant gradients, purple-blue', colors: ['#0f0f23', '#8b5cf6', '#3b82f6'] },
  { id: 'playful', label: 'Playful', description: 'Bright, bouncy, energetic', colors: ['#fef3c7', '#f59e0b', '#ec4899'] },
  { id: 'bold', label: 'Bold', description: 'High contrast, impactful', colors: ['#0f172a', '#ef4444', '#f8fafc'] },
  { id: 'classic', label: 'Classic', description: 'Muted, elegant, professional', colors: ['#1e293b', '#d4c5a9', '#8b9dc3'] },
];

interface ThemePickerProps {
  onSelect: (themeId: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

export function ThemePicker({ onSelect, disabled, selectedValue }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 my-2">
      {themes.map(theme => (
        <button
          key={theme.id}
          onClick={() => !disabled && onSelect(theme.id)}
          disabled={disabled}
          className={`p-3 rounded-lg border text-left transition-all ${
            selectedValue === theme.id
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 hover:border-white/20 bg-white/5'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex gap-1 mb-1.5">
            {theme.colors.map((color, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="text-sm font-medium text-white">{theme.label}</div>
          <div className="text-xs text-white/50">{theme.description}</div>
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Create LayoutPicker widget**

Create `apps/web/src/features/editor-v2/components/agent-widgets/LayoutPicker.tsx`:

```tsx
import React from 'react';

const layouts = [
  {
    id: 'pip',
    label: 'Picture-in-Picture',
    description: 'Visuals fullscreen, video as overlay',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded relative">
        <div className="absolute bottom-1 right-1 w-4 h-4 bg-white/40 rounded-sm" />
      </div>
    ),
  },
  {
    id: 'split-horizontal',
    label: 'Side by Side',
    description: 'Video and visuals next to each other',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded flex">
        <div className="w-1/2 bg-white/20" />
        <div className="w-1/2 bg-white/10" />
      </div>
    ),
  },
  {
    id: 'split-vertical',
    label: 'Stacked',
    description: 'Video and visuals above/below',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded flex flex-col">
        <div className="h-1/2 bg-white/20" />
        <div className="h-1/2 bg-white/10" />
      </div>
    ),
  },
];

interface LayoutPickerProps {
  onSelect: (layoutId: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

export function LayoutPicker({ onSelect, disabled, selectedValue }: LayoutPickerProps) {
  return (
    <div className="flex gap-2 my-2">
      {layouts.map(layout => (
        <button
          key={layout.id}
          onClick={() => !disabled && onSelect(layout.id)}
          disabled={disabled}
          className={`flex-1 p-3 rounded-lg border text-center transition-all ${
            selectedValue === layout.id
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 hover:border-white/20 bg-white/5'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex justify-center mb-2">{layout.icon}</div>
          <div className="text-xs font-medium text-white">{layout.label}</div>
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Create ScenePlanCard widget**

Create `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx`:

```tsx
import React from 'react';

interface Scene {
  startMs: number;
  endMs: number;
  title: string;
  description: string;
}

interface ScenePlanCardProps {
  scenes: Scene[];
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  approved?: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ScenePlanCard({ scenes, onApprove, onReject, disabled, approved }: ScenePlanCardProps) {
  return (
    <div className="my-2 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-white/5 border-b border-white/10">
        <span className="text-sm font-medium text-white">Scene Plan</span>
        <span className="text-xs text-white/40 ml-2">{scenes.length} scenes</span>
      </div>

      <div className="divide-y divide-white/5">
        {scenes.map((scene, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-white/40">
                {formatTime(scene.startMs)} - {formatTime(scene.endMs)}
              </span>
              <span className="text-sm font-medium text-white">{scene.title}</span>
            </div>
            <div className="text-xs text-white/60">{scene.description}</div>
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors"
          >
            Approve & Generate
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 border border-white/20 hover:border-white/40 text-white/70 text-sm rounded-md transition-colors"
          >
            Revise
          </button>
        </div>
      )}

      {approved && (
        <div className="px-3 py-2 bg-green-500/10 border-t border-green-500/20 text-green-400 text-xs text-center">
          Plan approved
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create ConfirmationWidget**

Create `apps/web/src/features/editor-v2/components/agent-widgets/ConfirmationWidget.tsx`:

```tsx
import React from 'react';

interface ConfirmationWidgetProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  confirmed?: boolean;
}

export function ConfirmationWidget({ message, onConfirm, onCancel, disabled, confirmed }: ConfirmationWidgetProps) {
  if (confirmed !== undefined) {
    return (
      <div className={`my-2 px-3 py-2 rounded-lg text-xs ${
        confirmed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      }`}>
        {confirmed ? 'Confirmed' : 'Declined'}
      </div>
    );
  }

  return (
    <div className="my-2 p-3 border border-white/10 rounded-lg bg-white/5">
      <p className="text-sm text-white/80 mb-2">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="px-3 py-1.5 border border-white/20 hover:border-white/40 text-white/70 text-sm rounded-md transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    </div>
  );
}
```

**Step 6: Create index barrel export**

Create `apps/web/src/features/editor-v2/components/agent-widgets/index.ts`:

```typescript
export { ThemePicker } from './ThemePicker';
export { LayoutPicker } from './LayoutPicker';
export { ScenePlanCard } from './ScenePlanCard';
export { ConfirmationWidget } from './ConfirmationWidget';
```

**Step 7: Commit**

```bash
git add apps/web/src/features/editor-v2/components/agent-widgets/
git commit -m "feat: add inline chat widget components for agent"
```

---

### Task 9: Rewrite AIAssistantPanel — Streaming Chat with Widgets

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

This is the largest task. The existing file is ~600 lines and gets significantly rewritten to support SSE streaming, widget rendering, and conversation persistence.

**Step 1: Read the current AIAssistantPanel.tsx fully**

Read `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` to understand exact current structure, imports, and props interface.

**Step 2: Rewrite the component**

Replace the content of `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` with the new streaming chat implementation:

```tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { parseSSEStream, SSEEvent } from '@/lib/sse-parser';
import { useVideoSettings, useAIEditingContext, useEditorActions } from '../store/use-editor-store';
import { ThemePicker, LayoutPicker, ScenePlanCard, ConfirmationWidget } from './agent-widgets';

// Message content block types
interface TextBlock {
  type: 'text';
  text: string;
}

interface WidgetBlock {
  type: 'widget';
  widget: {
    id: string;
    kind: 'theme_picker' | 'layout_picker' | 'scene_plan' | 'confirmation';
    message?: string;
    scenes?: Array<{ startMs: number; endMs: number; title: string; description: string }>;
    requiresApproval?: boolean;
  };
  response?: unknown; // User's response to this widget
}

interface ProgressBlock {
  type: 'progress';
  percent: number;
  message: string;
  error?: boolean;
}

type MessageBlock = TextBlock | WidgetBlock | ProgressBlock;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: MessageBlock[];
  createdAt: string;
}

interface AIAssistantPanelProps {
  projectId: string;
  onEditComplete?: () => void;
  className?: string;
}

export function AIAssistantPanel({ projectId, onEditComplete, className = '' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const videoSettings = useVideoSettings();
  const aiContext = useAIEditingContext();
  const { reloadVisuals, clearSelection } = useEditorActions();

  // Load conversation history on mount
  useEffect(() => {
    loadConversation();
  }, [projectId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversation() {
    try {
      const data = await api.getConversation(projectId);
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setMessages(data.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }],
          createdAt: m.createdAt,
        })));
      }
    } catch {
      // No conversation yet — that's fine
    }
  }

  const sendMessage = useCallback(async (
    messageText: string,
    widgetResponse?: { widgetId: string; value: unknown },
  ) => {
    if (isStreaming) return;
    if (!messageText.trim() && !widgetResponse) return;

    setIsStreaming(true);
    setInput('');

    // Add user message to UI
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text: messageText }],
      createdAt: new Date().toISOString(),
    };

    // Only show user message if it's text (not a widget response with empty text)
    if (messageText.trim()) {
      setMessages(prev => [...prev, userMessage]);
    }

    // Add streaming assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const context = aiContext ? {
        selectedSceneId: aiContext.sceneId,
        selectedElement: aiContext.element ? {
          name: aiContext.element.name,
          sceneId: aiContext.element.sceneId,
        } : undefined,
      } : undefined;

      const stream = await api.chatWithAgent(projectId, {
        message: messageText,
        context,
        widgetResponse,
      });

      for await (const event of parseSSEStream(stream)) {
        handleSSEEvent(event, assistantId);
      }

      // Reload visuals if generation/edit completed
      if (onEditComplete) {
        onEditComplete();
      }
    } catch (error: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: [...m.content, { type: 'text', text: `Something went wrong: ${error.message}` }],
            }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, projectId, aiContext, onEditComplete]);

  function handleSSEEvent(event: SSEEvent, assistantId: string) {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'text': {
        const { content } = data as { content: string };
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;

          const lastBlock = m.content[m.content.length - 1];
          if (lastBlock?.type === 'text') {
            // Append to existing text block
            return {
              ...m,
              content: [
                ...m.content.slice(0, -1),
                { type: 'text', text: lastBlock.text + content },
              ],
            };
          }
          // Start new text block
          return {
            ...m,
            content: [...m.content, { type: 'text', text: content }],
          };
        }));
        break;
      }

      case 'widget': {
        const widget = data as WidgetBlock['widget'];
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: [...m.content, { type: 'widget', widget }] }
            : m
        ));
        break;
      }

      case 'progress': {
        const progress = data as ProgressBlock;
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;

          const lastBlock = m.content[m.content.length - 1];
          if (lastBlock?.type === 'progress') {
            // Update existing progress block
            return {
              ...m,
              content: [
                ...m.content.slice(0, -1),
                { type: 'progress', ...progress },
              ],
            };
          }
          // Add new progress block
          return {
            ...m,
            content: [...m.content, { type: 'progress', ...progress }],
          };
        }));
        break;
      }

      case 'done': {
        const { conversationId: newConvId } = data as { conversationId: string };
        setConversationId(newConvId);
        break;
      }

      case 'error': {
        const { message } = data as { message: string };
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: [...m.content, { type: 'text', text: `Error: ${message}` }] }
            : m
        ));
        break;
      }
    }
  }

  function handleWidgetResponse(widgetId: string, value: unknown) {
    // Mark widget as responded in UI
    setMessages(prev => prev.map(m => ({
      ...m,
      content: m.content.map(block =>
        block.type === 'widget' && block.widget.id === widgetId
          ? { ...block, response: value }
          : block
      ),
    })));

    // Send response to agent
    sendMessage(`Selected: ${JSON.stringify(value)}`, { widgetId, value });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleClearConversation() {
    await api.clearConversation(projectId);
    setMessages([]);
    setConversationId(null);
  }

  function renderBlock(block: MessageBlock, messageId: string, blockIndex: number) {
    switch (block.type) {
      case 'text':
        return (
          <div key={`${messageId}-${blockIndex}`} className="text-sm text-white/90 whitespace-pre-wrap">
            {block.text}
          </div>
        );

      case 'widget':
        return renderWidget(block, messageId, blockIndex);

      case 'progress':
        return (
          <div key={`${messageId}-${blockIndex}`} className="my-2">
            <div className="flex items-center gap-2 mb-1">
              {block.percent < 100 && !block.error && (
                <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-xs text-white/60">{block.message}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  block.error ? 'bg-red-500' : 'bg-purple-500'
                }`}
                style={{ width: `${block.percent}%` }}
              />
            </div>
          </div>
        );
    }
  }

  function renderWidget(block: WidgetBlock, messageId: string, blockIndex: number) {
    const { widget, response } = block;
    const disabled = !!response || isStreaming;

    switch (widget.kind) {
      case 'theme_picker':
        return (
          <ThemePicker
            key={`${messageId}-${blockIndex}`}
            onSelect={(themeId) => handleWidgetResponse(widget.id, themeId)}
            disabled={disabled}
            selectedValue={response as string}
          />
        );

      case 'layout_picker':
        return (
          <LayoutPicker
            key={`${messageId}-${blockIndex}`}
            onSelect={(layoutId) => handleWidgetResponse(widget.id, layoutId)}
            disabled={disabled}
            selectedValue={response as string}
          />
        );

      case 'scene_plan':
        return (
          <ScenePlanCard
            key={`${messageId}-${blockIndex}`}
            scenes={widget.scenes || []}
            onApprove={() => handleWidgetResponse(widget.id, { approved: true })}
            onReject={() => handleWidgetResponse(widget.id, { approved: false, feedback: 'Please revise' })}
            disabled={disabled}
            approved={response ? (response as any).approved : undefined}
          />
        );

      case 'confirmation':
        return (
          <ConfirmationWidget
            key={`${messageId}-${blockIndex}`}
            message={widget.message || 'Proceed?'}
            onConfirm={() => handleWidgetResponse(widget.id, true)}
            onCancel={() => handleWidgetResponse(widget.id, false)}
            disabled={disabled}
            confirmed={response as boolean | undefined}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className={`flex flex-col h-full bg-[#0a0a0f] border-l border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Creative Director</span>
          {aiContext && (
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
              {aiContext.displayName}
            </span>
          )}
        </div>
        <button
          onClick={handleClearConversation}
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-white/40 mb-1">Hi! I'm your Creative Director.</p>
            <p className="text-xs text-white/30">
              Select a section of your timeline and tell me what visuals you'd like.
            </p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`${message.role === 'user' ? 'ml-8' : 'mr-4'}`}
          >
            <div
              className={`rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-purple-600/20 border border-purple-500/20'
                  : 'bg-white/5'
              }`}
            >
              {message.content.map((block, i) => renderBlock(block, message.id, i))}
              {message.content.length === 0 && isStreaming && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse delay-100" />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse delay-200" />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Describe what you want...'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify the component integrates with Editor.tsx**

The existing Editor.tsx already renders `<AIAssistantPanel>` with `projectId` and `onEditComplete` props. The new component uses the same interface, so no changes needed in Editor.tsx.

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: rewrite AIAssistantPanel with streaming chat and widget support"
```

---

### Task 10: Integration Verification

**Step 1: Verify backend starts**

Run: `cd packages/api && pnpm dev`

Check for:
- No import errors
- Agent routes registered
- Migration applied successfully
- Config reads ANTHROPIC_API_KEY

**Step 2: Verify frontend builds**

Run: `cd apps/web && pnpm build`

Check for:
- No TypeScript errors
- All imports resolve
- Widget components render correctly

**Step 3: End-to-end smoke test**

1. Open the editor for a project with a transcript
2. Open the AI Assistant panel (right sidebar)
3. Type "What can you help me with?" — should get a streaming response
4. Select a timeline range and type "Create visuals for this section"
5. Verify theme picker widget appears
6. Select a theme — verify layout picker appears
7. Verify scene plan card appears with approve/reject buttons

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for Creative Director agent"
```

---

### Task 11: Edge Cases & Polish

**Step 1: Handle missing ANTHROPIC_API_KEY gracefully**

In `packages/api/src/agent/agent-router.ts`, add a check at the top of the chat endpoint:

```typescript
if (!config.anthropic.apiKey) {
  return reply.status(503).send({
    error: 'AI agent not configured. Set ANTHROPIC_API_KEY environment variable.',
  });
}
```

**Step 2: Add conversation message limit**

In `packages/api/src/agent/agent-router.ts`, before building Claude messages, limit the context window:

```typescript
// Keep only the last 50 messages to stay within context limits
const recentMessages = previousMessages.slice(-50);
```

**Step 3: Handle SSE connection cleanup on client disconnect**

In the agent router, detect when the client disconnects:

```typescript
request.raw.on('close', () => {
  // Client disconnected — abort any in-flight Claude API call
  if (abortController) {
    abortController.abort();
  }
});
```

**Step 4: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "fix: add edge case handling for agent (API key check, message limit, disconnect cleanup)"
```
