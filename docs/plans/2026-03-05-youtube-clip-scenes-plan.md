# YouTube Clip Scenes - End-to-End Implementation Plan

## Executive Summary

Enable scenes to BE YouTube clips (not just contain them). The AI should autonomously decide when a scene should show a YouTube clip, search for relevant videos, and render them with frame overlays.

---

## Current State

### What EXISTS (Ready to Use)
| Component | Status | Location |
|-----------|--------|----------|
| youtube-clip template | ✅ Complete | `packages/templates/src/templates/youtube-clip/` |
| Frame styles (phone, laptop, browser, polaroid, film) | ✅ Complete | Template index.tsx |
| YouTube search API | ✅ Complete | `/api/youtube/search` |
| YouTube stream proxy | ✅ Complete | `/api/youtube/proxy/:tokenId` |
| Clip extraction service | ✅ Complete | `YouTubeClipService` |
| YouTubeClipModal UI | ✅ Complete | `apps/web/src/components/youtube-clip-modal.tsx` |
| ContextPanel controls | ✅ Complete | Handles youtube-clip template props |

### What's MISSING (To Implement)
| Gap | Impact |
|-----|--------|
| Director can't decide "scene = youtube-clip" | AI never chooses YouTube clip as scene type |
| No `search_youtube` agent tool | AI can't search YouTube autonomously |
| Animator doesn't know youtube-clip template | Can't generate youtube-clip scenes |
| Modal not integrated in editor | Users can't manually add clips |
| No scene.type = "youtube-clip" flow | System treats videos as metadata only |

---

## Implementation Plan

### Phase 1: Director - YouTube Clip Scene Decisions

**Goal:** Director can decide "Scene 3 should be a YouTube clip showing X"

#### 1.1 Update Director Prompt

**File:** `packages/worker/src/agents/prompts/director.py`

Add to scene type decision logic:
```python
## YouTube Clip Scenes

When a scene's purpose is to SHOW real footage (not explain with graphics), use a YouTube clip scene:

**When to use youtube-clip scenes:**
- Demonstrating a product, app, or interface
- Showing real-world examples or footage
- Referencing external content (news, tutorials, reactions)
- "Show don't tell" moments where footage > animation

**Scene structure for youtube-clip:**
```json
{
  "id": 3,
  "name": "AI Submit Demo",
  "type": "youtube-clip",
  "videoSearch": "AI code submit demo",
  "frameStyle": "browser",  // phone | laptop | browser | polaroid | film
  "visual": "Show YouTube clip of AI submit feature in a browser frame",
  "frames": [180, 360]
}
```

**DO NOT use youtube-clip when:**
- Explaining concepts that need custom graphics
- Data visualization or statistics
- Abstract ideas better shown with animation
```

#### 1.2 Update scenes.json Schema

Add `type` field support:
```json
{
  "type": "youtube-clip",      // NEW: scene type
  "videoSearch": "search query",
  "frameStyle": "browser",
  "trimHint": "show the part where..."
}
```

---

### Phase 2: Agent Tool - YouTube Search

**Goal:** AI agent can search YouTube and select videos autonomously

#### 2.1 Add search_youtube Tool

**File:** `packages/api/src/agent/agent-tools.ts`

```typescript
tool(
  'search_youtube',
  'Search YouTube for video clips to embed in scenes. Use when planning scenes that should show real footage.',
  {
    query: z.string().describe('Search query for YouTube'),
    maxResults: z.number().min(1).max(5).default(3),
    videoDuration: z.enum(['short', 'medium', 'long', 'any']).default('medium'),
  },
  async ({ query, maxResults, videoDuration }) => {
    const results = await youtubeSearchService.searchVideos(query, {
      maxResults,
      videoDuration,
      videoDefinition: 'high',
    });

    return {
      results: results.map(r => ({
        videoId: r.videoId,
        title: r.title,
        url: r.url,
        duration: r.duration,
        thumbnail: r.thumbnail.url,
        channel: r.channelTitle,
      })),
    };
  }
)
```

#### 2.2 Add select_youtube_clip Tool

```typescript
tool(
  'select_youtube_clip',
  'Select a YouTube video for a scene and specify the clip range',
  {
    sceneId: z.number(),
    videoId: z.string(),
    videoUrl: z.string(),
    title: z.string(),
    trimStart: z.number().default(0),
    trimEnd: z.number().default(30),
    frameStyle: z.enum(['none', 'phone', 'laptop', 'browser', 'polaroid', 'film']).default('browser'),
  },
  async ({ sceneId, videoId, videoUrl, title, trimStart, trimEnd, frameStyle }) => {
    // Store selection for scene
    return { success: true, sceneId, videoId, frameStyle };
  }
)
```

#### 2.3 Update System Prompt

**File:** `packages/api/src/agent/agent-system-prompt.ts`

```typescript
YOUTUBE CLIP SCENES:
You can create scenes that ARE YouTube clips (not just animations with embedded videos).

When to use YouTube clip scenes:
- Showing real product demos, app interfaces, tutorials
- Referencing external content (news clips, reactions, examples)
- "Show don't tell" - when real footage is better than graphics

Workflow:
1. Use search_youtube to find relevant videos
2. Use select_youtube_clip to choose video + trim range + frame style
3. The scene will render as the YouTube clip with a device frame overlay

Frame styles available:
- phone: iPhone mockup (for mobile app demos)
- laptop: MacBook display (for desktop software)
- browser: Chrome window (for web apps/sites)
- polaroid: Vintage photo style (for artistic effect)
- film: 35mm strip (for cinematic feel)
```

---

### Phase 3: Animator - Generate YouTube Clip Scenes

**Goal:** Animator creates youtube-clip template scenes when Director specifies type="youtube-clip"

#### 3.1 Update Animator Prompt

**File:** `packages/worker/src/agents/prompts/animator.py`

```python
## YouTube Clip Scenes

When a scene has `type: "youtube-clip"`, DO NOT generate animation code.
Instead, create a scene that uses the youtube-clip template:

**Output for youtube-clip scenes:**
```tsx
// scenes/Scene3.tsx - YouTube Clip Scene
import React from 'react';
import { AbsoluteFill } from 'remotion';
import YouTubeClip from '@viona/templates/youtube-clip';

export const Scene3: React.FC = () => {
  return (
    <AbsoluteFill>
      <YouTubeClip
        clipUrl={staticFile('assets/clips/scene3-youtube-clip.mp4')}
        frame="browser"
        trimStartSeconds={0}
        shadowIntensity="medium"
        backgroundColor="#0a0a0a"
      />
    </AbsoluteFill>
  );
};
```

**Frame selection based on content:**
- App/mobile demos → "phone"
- Software/desktop → "laptop"
- Websites/web apps → "browser"
- Artistic/personal → "polaroid"
- Cinematic/dramatic → "film"
```

#### 3.2 Update generate-visuals.ts

**File:** `packages/worker/src/processors/generate-visuals.ts`

Handle youtube-clip scenes differently:
```typescript
// When preparing scenes for Animator
for (const scene of scenesArray) {
  if (scene.type === 'youtube-clip') {
    // Mark scene as youtube-clip type
    scene.isYouTubeClip = true;
    scene.templateId = 'youtube-clip';
    scene.templateProps = {
      frame: scene.frameStyle || 'browser',
      clipUrl: '', // Filled during render
      sourceUrl: scene.videoUrl,
      trimStartSeconds: scene.trimStart || 0,
      trimEndSeconds: scene.trimEnd || 30,
    };
  }
}
```

---

### Phase 4: Frontend - Manual YouTube Clip Insertion

**Goal:** Users can manually search and add YouTube clips to scenes

#### 4.1 Add YouTube Button to Assets Panel

**File:** `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx`

```tsx
import { YouTubeClipModal } from '@/components/youtube-clip-modal';

// Add button in assets panel
<Button onClick={() => setShowYouTubeModal(true)}>
  <YoutubeIcon className="w-4 h-4 mr-2" />
  Add YouTube Clip
</Button>

<YouTubeClipModal
  open={showYouTubeModal}
  onClose={() => setShowYouTubeModal(false)}
  onClipAdded={(clip) => {
    // Add youtube-clip scene to timeline
    addVisualItem({
      type: 'visual',
      templateId: 'youtube-clip',
      templateProps: {
        clipUrl: clip.url,
        sourceUrl: clip.sourceUrl,
        frame: 'browser',
        trimStartSeconds: clip.trimStart,
        trimEndSeconds: clip.trimEnd,
      },
    });
  }}
/>
```

#### 4.2 Update YouTubeClipModal

**File:** `apps/web/src/components/youtube-clip-modal.tsx`

Add frame style selection:
```tsx
// Add frame style picker before extract button
<Select value={frameStyle} onValueChange={setFrameStyle}>
  <SelectItem value="none">No Frame</SelectItem>
  <SelectItem value="phone">Phone</SelectItem>
  <SelectItem value="laptop">Laptop</SelectItem>
  <SelectItem value="browser">Browser</SelectItem>
  <SelectItem value="polaroid">Polaroid</SelectItem>
  <SelectItem value="film">Film Strip</SelectItem>
</Select>
```

---

### Phase 5: Render Pipeline - YouTube Clip Handling

**Goal:** Export correctly renders youtube-clip scenes

#### 5.1 Update render.ts

**File:** `packages/worker/src/processors/render.ts`

Already implemented:
- Downloads clips to `public/assets/clips/scene{N}-youtube-clip.mp4`
- Copies to bundle's public directory
- Scene uses `staticFile()` to reference

#### 5.2 Verify Template Integration

Ensure youtube-clip template is bundled with compositions:
```typescript
// In workspace bundling, include youtube-clip template
import YouTubeClip from '@viona/templates/youtube-clip';
```

---

## Implementation Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 2: Agent Tools | HIGH | Medium | None |
| Phase 1: Director Prompt | HIGH | Low | Phase 2 |
| Phase 3: Animator | HIGH | Medium | Phase 1 |
| Phase 4: Frontend | MEDIUM | Low | None |
| Phase 5: Render | LOW | Low | Already done |

**Recommended Order:**
1. **Phase 2** - Add agent tools first (enables AI search)
2. **Phase 1** - Update Director to decide scene types
3. **Phase 3** - Update Animator to generate youtube-clip scenes
4. **Phase 4** - Wire up frontend modal
5. **Phase 5** - Verify render pipeline (mostly done)

---

## Success Criteria

### AI Autonomous Flow
1. User says: "Show a demo of the new AI submit feature"
2. Director plans: Scene 3 = youtube-clip, search "AI code submit demo"
3. Agent searches YouTube, selects best video
4. Animator generates youtube-clip scene with browser frame
5. Export downloads clip and renders with frame overlay

### User Manual Flow
1. User clicks "Add YouTube Clip" in Assets panel
2. YouTubeClipModal opens
3. User pastes URL, trims, selects frame style
4. Clip added to timeline as youtube-clip scene
5. ContextPanel shows all styling controls

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/worker/src/agents/prompts/director.py` | Add youtube-clip scene type decision logic |
| `packages/api/src/agent/agent-tools.ts` | Add search_youtube, select_youtube_clip tools |
| `packages/api/src/agent/agent-system-prompt.ts` | Document YouTube clip scene workflow |
| `packages/worker/src/agents/prompts/animator.py` | Handle youtube-clip scene generation |
| `packages/worker/src/processors/generate-visuals.ts` | Process youtube-clip scene type |
| `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx` | Add YouTube button + modal |
| `apps/web/src/components/youtube-clip-modal.tsx` | Add frame style selector |

---

## Estimated Effort

- Phase 1: 2-3 hours (prompt updates)
- Phase 2: 3-4 hours (agent tools)
- Phase 3: 2-3 hours (animator + processor)
- Phase 4: 1-2 hours (frontend wiring)
- Phase 5: 1 hour (verification)

**Total: ~10-13 hours**
