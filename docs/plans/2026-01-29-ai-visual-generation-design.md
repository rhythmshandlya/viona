# AI Visual Generation Design

**Version:** 1.0
**Date:** January 29, 2026
**Status:** Draft

---

## Overview

Add AI-powered visual generation to Viona. Users upload a talking-head video, the system transcribes it, then Claude Code analyzes the transcript and generates contextual Remotion animations that overlay on the video.

**Core flow:**
```
Upload → Transcribe → Claude Code generates visuals → Bundle → Preview in editor
```

**Key differentiator:** Visuals are generated based on semantic understanding of what's being explained (processes, data, frameworks) - not generic stock footage.

---

## Architecture

### Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ REMOTION STUDIO (always running)                                    │
│ C:\Users\armaa\test                                                 │
│ localhost:3000                                                      │
└─────────────────────────────────────────────────────────────────────┘
        ↑                                          ↑
        │ writes files                             │ screenshots
        │                                          │
┌───────┴──────────────────────────────────────────┴──────────────────┐
│ CLAUDE CODE + MCP TOOLS                                             │
│                                                                     │
│ Input: transcript, style preset, projectId                          │
│                                                                     │
│ Loop:                                                               │
│   1. Analyze transcript → identify visual opportunities             │
│   2. Generate/edit components in src/<projectId>/                   │
│   3. Update Root.tsx to register composition                        │
│   4. Call MCP screenshot tool:                                      │
│      npx remotion still ./src/index.ts <ProjectId> shot.png --frame=X│
│   5. Evaluate screenshot visually                                   │
│   6. If not satisfied → refine and repeat                           │
│   7. If satisfied → signal done                                     │
│                                                                     │
│ Output: compositionId, metadata (duration, fps, visual timestamps)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Bundle & Registry Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ BUNDLE STEP                                                         │
│                                                                     │
│ 1. Claude signals done with metadata:                               │
│    { compositionId: "proj_abc123", durationInFrames: 300, fps: 30,  │
│      visuals: [{ startMs: 5000, endMs: 12000, type: "process" }] }  │
│                                                                     │
│ 2. Worker runs:                                                     │
│    const bundle = await bundle({                                    │
│      entryPoint: 'C:/Users/armaa/test/src/index.ts',                │
│      outDir: '/bundles/<projectId>'                                 │
│    });                                                              │
│                                                                     │
│ 3. Bundle stored and served statically:                             │
│    https://api.clipify.com/bundles/<projectId>/index.js             │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ COMPONENT REGISTRY (database table)                                 │
│                                                                     │
│ visuals:                                                            │
│   id               -> unique visual ID                              │
│   projectId        -> links to Viona project                      │
│   compositionId    -> "proj_abc123"                                 │
│   bundleUrl        -> "/bundles/<projectId>/index.js"               │
│   durationFrames   -> 300                                           │
│   fps              -> 30                                            │
│   width            -> 1920                                          │
│   height           -> 1080                                          │
│   timestamps       -> [{ startMs, endMs, type }]                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

Claude Code will have these MCP tools available:

```typescript
// Tool 1: Screenshot - visual feedback
screenshot(compositionId: string, frame: number): Promise<ImagePath>
// Wraps: npx remotion still ./src/index.ts <compositionId> /tmp/shot.png --frame=<frame>
// Returns: path to PNG that Claude can view

// Tool 2: Get composition metadata
getCompositionInfo(compositionId: string): Promise<{
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}>
// Wraps: npx remotion compositions ./src/index.ts --props='{}'
// Returns: composition details so Claude knows duration/fps

// Tool 3: Validate
validateProject(): Promise<{ success: boolean; errors?: string[] }>
// Wraps: npx remotion render ./src/index.ts <comp> --frames=0-1
// Returns: whether code compiles and renders without errors

// Tool 4: Get transcript
getTranscript(projectId: string): Promise<{
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
    words: Array<{ text: string; startMs: number; endMs: number }>
  }>
}>
// Fetches transcript from Viona API/database
// Returns: timestamped transcript for Claude to analyze
```

---

## Frontend Integration

### New Timeline Item Type

```typescript
// Add to store/types.ts
interface VisualItemData {
  visualId: string;        // References component registry
  compositionId: string;   // The Remotion composition ID
  bundleUrl: string;       // Cached from registry lookup
}

// Timeline item example:
{
  id: "item_xyz",
  type: "visual",
  startMs: 5000,
  endMs: 12000,
  data: {
    visualId: "vis_abc123",
    compositionId: "proj_abc123",
    bundleUrl: "/bundles/proj_abc123/index.js"
  }
}
```

### Timeline Structure

```
Timeline:
┌─────────────────────────────────────────────────────────────┐
│ Video    │ [talking_head.mp4                          ]     │
├──────────┼──────────────────────────────────────────────────┤
│ Visuals  │      [flowchart]     [bar_chart]                 │
├──────────┼──────────────────────────────────────────────────┤
│ Captions │ [cap1][cap2][cap3][cap4][cap5][cap6][cap7]       │
└─────────────────────────────────────────────────────────────┘
```

### Composition Changes

```tsx
// Composition.tsx - add visual rendering

const visualItems = items.filter(item => item.type === 'visual');

{visualItems.map((item) => (
  <Sequence from={...} durationInFrames={...}>
    <SplitLayout>
      {/* Left: talking head (50%) */}
      <VideoHalf>{/* existing video */}</VideoHalf>

      {/* Right: dynamic visual (50%) */}
      <VisualHalf>
        <DynamicVisualLoader
          bundleUrl={item.data.bundleUrl}
          compositionId={item.data.compositionId}
        />
      </VisualHalf>
    </SplitLayout>
  </Sequence>
))}
```

### Dynamic Bundle Loader

```tsx
// components/DynamicVisualLoader.tsx

interface Props {
  bundleUrl: string;
  compositionId: string;
  frame: number;
}

export function DynamicVisualLoader({ bundleUrl, compositionId, frame }: Props) {
  const [Component, setComponent] = useState<React.FC | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBundle() {
      try {
        const module = await import(/* webpackIgnore: true */ bundleUrl);
        const comp = module[compositionId] || module.default;
        setComponent(() => comp);
      } catch (err) {
        setError(`Failed to load visual: ${err.message}`);
      }
    }
    loadBundle();
  }, [bundleUrl, compositionId]);

  if (error) return <div className="error">{error}</div>;
  if (!Component) return <div className="loading">Loading visual...</div>;

  return <Component />;
}
```

---

## Backend Implementation

### Worker Processor

```typescript
// packages/worker/src/processors/generate-visuals.ts

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
}

export async function processGenerateVisualsJob(job: Job<GenerateVisualsJobData>) {
  const { projectId, jobId, stylePreset } = job.data;

  // 1. Fetch transcript from DB
  await publishJobProgress(jobId, 5, 'Loading transcript...');
  const transcript = await getTranscript(projectId);

  // 2. Invoke Claude Code via CLI
  await publishJobProgress(jobId, 10, 'Generating visuals...');

  const claudePrompt = buildPrompt(transcript, projectId, stylePreset);
  const result = await runClaudeCode(claudePrompt, {
    cwd: 'C:/Users/armaa/test',
    mcpTools: ['screenshot', 'getCompositionInfo', 'validateProject', 'getTranscript'],
  });

  // 3. Bundle the generated composition
  await publishJobProgress(jobId, 80, 'Bundling...');
  const bundleUrl = await bundleComposition(projectId);

  // 4. Register in database
  await publishJobProgress(jobId, 90, 'Registering...');
  await db.insert(visuals).values({
    id: nanoid(),
    projectId,
    compositionId: result.compositionId,
    bundleUrl,
    durationFrames: result.durationInFrames,
    fps: result.fps,
    timestamps: result.visuals,
  });

  // 5. Create timeline items for each visual
  for (const visual of result.visuals) {
    await createTimelineItem(projectId, 'visual', visual.startMs, visual.endMs, {
      visualId: result.compositionId,
      bundleUrl,
    });
  }

  await publishJobProgress(jobId, 100, 'Complete');
  await publishJobComplete(jobId, projectId);
}
```

### API Endpoint

```typescript
// packages/api/src/routes/projects.ts

app.post<{
  Params: { id: string };
  Body: { stylePreset: string }
}>(
  '/api/projects/:id/generate-visuals',
  async (request, reply) => {
    const { id } = request.params;
    const { stylePreset } = request.body;

    // Verify project exists and has transcript
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, id),
    });

    if (!transcript) {
      return reply.status(400).send({ error: 'Project has no transcript' });
    }

    // Create job record
    const jobId = nanoid();
    await db.insert(jobs).values({
      id: jobId,
      projectId: id,
      type: 'generate-visuals',
      status: 'pending',
      progress: 0,
    });

    // Update project status
    await db.update(projects)
      .set({ status: 'generating' })
      .where(eq(projects.id, id));

    // Queue the job
    await generateVisualsQueue.add('generate-visuals', {
      projectId: id,
      jobId,
      stylePreset,
    });

    return { jobId };
  }
);
```

---

## Database Schema

### New Table: visuals

```typescript
// packages/shared/src/db/schema.ts

export const visuals = pgTable('visuals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  compositionId: text('composition_id').notNull(),
  bundleUrl: text('bundle_url').notNull(),
  durationFrames: integer('duration_frames').notNull(),
  fps: integer('fps').notNull().default(30),
  width: integer('width').notNull().default(1920),
  height: integer('height').notNull().default(1080),
  timestamps: jsonb('timestamps').$type<Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
  }>>(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Migration

```sql
CREATE TABLE visuals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  composition_id TEXT NOT NULL,
  bundle_url TEXT NOT NULL,
  duration_frames INTEGER NOT NULL,
  fps INTEGER NOT NULL DEFAULT 30,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  timestamps JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Claude Code Prompt

```typescript
// packages/worker/src/prompts/generate-visuals.ts

export function buildPrompt(
  transcript: TranscriptSegment[],
  projectId: string,
  stylePreset: string
): string {
  return `
You are generating animated visuals for an educational video using Remotion.

## Project Setup
- Working directory: C:/Users/armaa/test
- Generate components in: src/${projectId}/
- Register composition in: src/Root.tsx
- Composition ID must be: "${projectId}"

## Transcript
${formatTranscript(transcript)}

## Style Preset: ${stylePreset}
${STYLE_GUIDELINES[stylePreset]}

## Your Task
1. Analyze the transcript for visual opportunities:
   - Processes/steps being explained
   - Data/statistics mentioned
   - Frameworks/models described
   - Comparisons being made
   - Key concepts that benefit from visualization

2. For each opportunity, create Remotion components that:
   - Sync with the transcript timestamps
   - Use smooth animations (spring, interpolate)
   - Follow the ${stylePreset} style guidelines
   - Are visually clear and educational

3. Iterate using the screenshot tool:
   - Capture frames at key moments
   - Evaluate if the visual communicates the concept
   - Refine until satisfied

4. When complete, output metadata:
   { compositionId, durationInFrames, fps, visuals: [{ startMs, endMs, type }] }

## Tools Available
- screenshot(compositionId, frame) - capture a frame as PNG
- getCompositionInfo(compositionId) - get duration/fps
- validateProject() - check for render errors
- getTranscript(projectId) - fetch transcript data

## Decision Making
Do NOT ask questions. Make reasonable decisions:
- If multiple visual types fit, choose the clearest one
- If data is ambiguous, use what's stated in transcript
- If unsure whether to visualize, err toward visualizing
- If something fails, try an alternative approach

You must complete the task without human input.

## Quality Checklist
- [ ] Animations are smooth, not jarring
- [ ] Text is readable (good contrast, size)
- [ ] Timing matches speech
- [ ] Visual supports comprehension, not decoration
`;
}
```

---

## Theme Selection UI

Modal triggered when user clicks "Generate Visuals":

```
┌─────────────────────────────────────────────────┐
│  Generate Visuals                          [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Choose a style for your visuals:               │
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Minimal │ │ Modern  │ │ Playful │           │
│  │ [thumb] │ │ [thumb] │ │ [thumb] │           │
│  └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐                       │
│  │  Bold   │ │ Classic │                       │
│  │ [thumb] │ │ [thumb] │                       │
│  └─────────┘ └─────────┘                       │
│                                                 │
│              [Cancel]  [Generate]               │
└─────────────────────────────────────────────────┘
```

Style presets with thumbnails help content creators visualize output before generating.

---

## File Structure

### Test Directory (Remotion Project)

```
C:\Users\armaa\test\
├── src/
│   ├── index.ts                        # Entry point
│   ├── Root.tsx                        # Claude adds composition here
│   └── <projectId>/                    # Claude generates here
│       ├── index.tsx                   # Main composition
│       ├── constants.ts                # Colors, timing
│       ├── scenes/                     # Scene components
│       └── components/                 # Reusable parts
```

### Viona Changes

```
C:\Users\armaa\Documents\cllipify\
├── packages/
│   ├── api/src/routes/
│   │   └── projects.ts                 # + POST /generate-visuals
│   ├── worker/src/
│   │   ├── processors/
│   │   │   └── generate-visuals.ts     # New processor
│   │   ├── prompts/
│   │   │   └── generate-visuals.ts     # Claude prompt
│   │   └── index.ts                    # + new queue
│   └── shared/src/db/
│       └── schema.ts                   # + visuals table
├── apps/web/src/
│   ├── features/editor-v2/
│   │   ├── player/
│   │   │   ├── Composition.tsx         # + visual rendering
│   │   │   └── DynamicVisualLoader.tsx # New component
│   │   ├── store/
│   │   │   └── types.ts                # + VisualItemData
│   │   └── timeline/
│   │       └── ...                     # + Visuals track
│   └── lib/
│       └── api.ts                      # + generateVisuals()
```

---

## Layout

For MVP, visuals render in a 50/50 split layout:

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│   Talking Head      │   Generated         │
│   (50%)             │   Visual (50%)      │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

Future: User-selectable templates (PiP, full-screen, etc.)

---

## Open Questions

1. **Bundle caching** - How long to keep generated bundles? Cleanup strategy?
2. **Error recovery** - What if Claude fails mid-generation?
3. **Iteration limits** - Max iterations before forcing completion?
4. **Cost tracking** - How to track/limit Claude API usage per user?

---

## Implementation Order

1. MCP tools for Claude (screenshot, getCompositionInfo, etc.)
2. Database schema + migration
3. Worker processor + Claude prompt
4. API endpoint
5. Frontend: DynamicVisualLoader component
6. Frontend: Visuals track in timeline
7. Frontend: Theme selection modal
8. Integration testing

---

## Success Criteria

- [ ] User can upload video, transcribe, and generate visuals
- [ ] Claude iterates using screenshot feedback until satisfied
- [ ] Generated visuals appear in timeline on Visuals track
- [ ] 50/50 split preview works in editor
- [ ] Export includes composited visuals
