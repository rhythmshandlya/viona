# Shot Boundary Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect camera angle changes in uploaded videos using existing head tracking data, align them with transcript segments, and expose to the Planner for shot-aware scene planning.

**Architecture:** Inline shot detection signals (face bbox displacement, HSV frame diff, confidence drop) added to `detect_head.py`'s existing frame loop. Transcript alignment in `workspace-init.ts` produces `shot-boundaries.json`. New MCP tool `get_shot_boundaries` exposes this to the Planner agent, whose prompt is updated to prefer shot boundaries as scene transition points.

**Tech Stack:** Python (OpenCV, NumPy — already deps), TypeScript (Node.js), MCP SDK, Zod

**Spec:** `docs/superpowers/specs/2026-03-22-shot-boundary-detection-design.md`

---

### Task 1: Add shot detection signals to `detect_head.py`

**Files:**
- Modify: `packages/worker/scripts/detect_head.py:267-402` (the `process_video` function)

- [ ] **Step 1: Add HSV diff + face signal computation inside the frame loop**

In `process_video()`, after the existing face/body detection block (after line 380 `result['frames'].append(frame_data)`), add shot signal computation. The key changes:

1. Before the `while` loop (after line 309), initialize tracking state:

```python
# Shot detection state
prev_hsv = None
prev_face_center = None  # (cx, cy) normalized by frame diagonal
prev_face_area = None    # bbox area in pixels
prev_confidence = 0.0
frame_diagonal = np.sqrt(width ** 2 + height ** 2)
raw_shot_boundaries = []  # collected during loop, merged after
```

2. Inside the `if frame_idx % interval == 0:` block (after line 321), right after `rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)`, compute HSV:

```python
            # HSV conversion for shot detection (reuses already-decoded frame)
            hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
```

3. After `result['frames'].append(frame_data)` (line 380), add the shot signal scoring:

```python
            # --- Shot boundary detection ---
            shot_signals = []
            hsv_score = 0.0
            bbox_score = 0.0
            size_score = 0.0
            confidence_score = 0.0

            # HSV frame diff
            if prev_hsv is not None:
                diff = cv2.absdiff(hsv_frame, prev_hsv).astype(np.float32)
                # Weighted: H=1.0, S=1.0, V=0.5
                weighted = diff[:, :, 0] * 1.0 + diff[:, :, 1] * 1.0 + diff[:, :, 2] * 0.5
                hsv_diff = float(np.mean(weighted))
                hsv_score = min(1.0, hsv_diff / 60.0)
                if hsv_diff > 35:
                    shot_signals.append('hsv_diff')

            prev_hsv = hsv_frame.copy()

            # Face-based signals (only when both frames have valid face)
            cur_face_center = None
            cur_face_area = None
            if bbox is not None:
                cx = bbox['x'] + bbox['width'] / 2.0
                cy = bbox['y'] + bbox['height'] / 2.0
                cur_face_center = (cx, cy)
                cur_face_area = bbox['width'] * bbox['height']

            if cur_face_center is not None and prev_face_center is not None:
                # Bbox displacement
                dx = cur_face_center[0] - prev_face_center[0]
                dy = cur_face_center[1] - prev_face_center[1]
                displacement = np.sqrt(dx ** 2 + dy ** 2) / frame_diagonal
                bbox_score = min(1.0, displacement / 0.5)
                if displacement > 0.25:
                    shot_signals.append('bbox_jump')

                # Face size ratio
                if prev_face_area and prev_face_area > 0:
                    size_ratio_change = abs(1.0 - cur_face_area / prev_face_area)
                    size_score = min(1.0, size_ratio_change / 0.8)
                    if size_ratio_change > 0.4:
                        shot_signals.append('size_change')

            prev_face_center = cur_face_center
            prev_face_area = cur_face_area

            # Confidence drop
            if prev_confidence >= 0.5 and confidence < 0.5:
                confidence_score = 1.0
                shot_signals.append('confidence_drop')
            elif prev_confidence < 0.5 and confidence >= 0.5:
                confidence_score = 1.0
                shot_signals.append('confidence_rise')
            prev_confidence = confidence

            # Combined score
            face_combined = 0.4 * bbox_score + 0.3 * size_score + 0.3 * confidence_score
            combined_score = max(hsv_score, face_combined)

            if combined_score > 0.6 and shot_signals:
                raw_shot_boundaries.append({
                    'frame': frame_idx,
                    'timestamp_ms': timestamp_ms,
                    'score': round(combined_score, 3),
                    'signals': shot_signals,
                })
```

- [ ] **Step 2: Add shot boundary merging after the frame loop**

After `cap.release()` (line 388), before the metadata update block, add merging:

```python
    # Merge adjacent shot boundaries within 500ms
    merged_shots = []
    for shot in raw_shot_boundaries:
        if merged_shots and (shot['timestamp_ms'] - merged_shots[-1]['timestamp_ms']) < 500:
            # Keep the one with higher score
            if shot['score'] > merged_shots[-1]['score']:
                merged_shots[-1] = shot
        else:
            merged_shots.append(shot)

    result['shots'] = merged_shots
```

- [ ] **Step 3: Update metadata with shot count**

After the existing metadata block (line 398), add:

```python
    result['metadata']['shots_detected'] = len(merged_shots)
```

- [ ] **Step 4: Test with the project's video**

Run the script against an actual video to verify it detects shot boundaries:

```bash
cd packages/worker/scripts
python detect_head.py /path/to/test-video.mp4 --output /tmp/test_tracking.json
```

Check the output JSON for a `"shots"` array. Inspect `score` and `signals` values.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/scripts/detect_head.py
git commit -m "feat(worker): add inline shot boundary detection to detect_head.py"
```

---

### Task 2: Update `InitPayload` type and write `shot-boundaries.json`

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:21-59` (InitPayload type) and `344-349` (head tracking write block)

- [ ] **Step 1: Add `shots` field to `InitPayload.headTracking` type**

In `packages/sandbox/src/workspace-init.ts`, after line 51 (`}>;` — the closing of the `frames` array type), add the `shots` field at the same level as `frames` (before line 52's `};` which closes the `headTracking` object):

```typescript
    shots?: Array<{
      frame: number;
      timestamp_ms: number;
      score: number;
      signals: string[];
    }>;
```

The full `headTracking` field should now have `video`, `settings`, `metadata`, `frames`, and `shots`.

- [ ] **Step 2: Add transcript alignment function**

Before the `initWorkspaceInDir` function (before line 213), add:

```typescript
interface ShotBoundary {
  timestamp_ms: number;
  frame: number;
  score: number;
  signals: string[];
  aligned: boolean;
  snappedTo_ms?: number;
  segmentBefore?: string;
  segmentAfter?: string;
}

interface ShotBoundariesFile {
  shots: ShotBoundary[];
  summary: {
    totalShots: number;
    averageShotDurationMs: number;
    alignedCount: number;
    isMultiCam: boolean;
  };
}

function alignShotsWithTranscript(
  shots: NonNullable<InitPayload['headTracking']>['shots'],
  transcript: NonNullable<InitPayload['transcript']>,
  videoDurationMs: number,
): ShotBoundariesFile {
  if (!shots || shots.length === 0) {
    return {
      shots: [],
      summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
    };
  }

  const segments = transcript.segments;
  // Collect all segment boundaries (startMs and endMs)
  const boundaries: Array<{ ms: number; type: 'start' | 'end'; segIdx: number }> = [];
  for (let i = 0; i < segments.length; i++) {
    boundaries.push({ ms: segments[i].startMs, type: 'start', segIdx: i });
    boundaries.push({ ms: segments[i].endMs, type: 'end', segIdx: i });
  }
  boundaries.sort((a, b) => a.ms - b.ms);

  const SNAP_WINDOW_MS = 500;
  let alignedCount = 0;

  const alignedShots: ShotBoundary[] = shots.map((shot) => {
    // Find nearest segment boundary within snap window
    let nearest: typeof boundaries[0] | null = null;
    let nearestDist = Infinity;
    for (const b of boundaries) {
      const dist = Math.abs(b.ms - shot.timestamp_ms);
      if (dist < nearestDist && dist <= SNAP_WINDOW_MS) {
        nearestDist = dist;
        nearest = b;
      } else if (dist === nearestDist && nearest && b.type === 'end') {
        // Tie-break: prefer endMs (natural sentence completion)
        nearest = b;
      }
    }

    // Find segmentBefore and segmentAfter
    let segmentBefore: string | undefined;
    let segmentAfter: string | undefined;
    const ts = nearest ? nearest.ms : shot.timestamp_ms;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].endMs <= ts + 100) segmentBefore = segments[i].text;
      if (segments[i].startMs >= ts - 100 && !segmentAfter) segmentAfter = segments[i].text;
    }

    if (nearest) {
      alignedCount++;
      return {
        timestamp_ms: shot.timestamp_ms,
        frame: shot.frame,
        score: shot.score,
        signals: shot.signals,
        aligned: true,
        snappedTo_ms: nearest.ms,
        segmentBefore,
        segmentAfter,
      };
    }

    return {
      timestamp_ms: shot.timestamp_ms,
      frame: shot.frame,
      score: shot.score,
      signals: shot.signals,
      aligned: false,
      segmentBefore,
      segmentAfter,
    };
  });

  const totalShots = alignedShots.length;
  const averageShotDurationMs = Math.round(videoDurationMs / (totalShots + 1));
  const shotsPerMinute = totalShots / (videoDurationMs / 60000);
  const isMultiCam = totalShots > 2 && shotsPerMinute > 1.0;

  return {
    shots: alignedShots,
    summary: { totalShots, averageShotDurationMs, alignedCount, isMultiCam },
  };
}
```

- [ ] **Step 3: Write `shot-boundaries.json` in `initWorkspaceInDir`**

After the head tracking write block (line 344-349), add:

```typescript
  // Write shot boundaries (aligned with transcript) if shots data exists
  if (payload.headTracking?.shots && payload.transcript) {
    const videoDurationMs = payload.headTracking.video?.duration_ms
      || payload.projectMeta?.durationMs
      || 0;
    const shotBoundaries = alignShotsWithTranscript(
      payload.headTracking.shots,
      payload.transcript,
      videoDurationMs,
    );
    await writeFile(
      join(baseDir, 'docs', 'shot-boundaries.json'),
      JSON.stringify(shotBoundaries, null, 2),
    );
    logger.info({ totalShots: shotBoundaries.summary.totalShots, isMultiCam: shotBoundaries.summary.isMultiCam }, 'Shot boundaries written');
  } else {
    // Write empty fallback
    await writeFile(
      join(baseDir, 'docs', 'shot-boundaries.json'),
      JSON.stringify({
        shots: [],
        summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
      }, null, 2),
    );
  }
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): align shot boundaries with transcript in workspace-init"
```

---

### Task 3: Add `get_shot_boundaries` MCP tool

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:66-73` (HeadTrackingData type) and after line 1040 (new tool registration)

- [ ] **Step 1: Update `HeadTrackingData` type**

In `packages/mcp-servers/src/asset-server.ts`, add `shots` to the `HeadTrackingData` interface (after line 72, before the closing `}`):

```typescript
  shots?: Array<{
    frame: number;
    timestamp_ms: number;
    score: number;
    signals: string[];
  }>;
```

- [ ] **Step 2: Register `get_shot_boundaries` tool**

After the `get_speaker_grid` deprecated alias block (after line 1040), add the new tool:

```typescript
// ---------------------------------------------------------------------------
// Shot boundaries tool
// ---------------------------------------------------------------------------

server.registerTool(
  "get_shot_boundaries",
  {
    description:
      "Get detected camera angle changes (shot boundaries) in the source video. " +
      "Returns cut points aligned with transcript segment boundaries, with " +
      "surrounding transcript text for context. Use this when planning scenes " +
      "to align scene transitions with natural camera cuts. " +
      "If isMultiCam is true, prefer shot boundaries as scene transition points.",
    inputSchema: {},
  },
  async () => {
    try {
      const shotPath = path.join(WORKSPACE, "docs", "shot-boundaries.json");
      let shotData: any;
      try {
        shotData = JSON.parse(await readFile(shotPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              shots: [],
              summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
              message: "No shot boundary data available. Plan scenes using transcript timing only.",
            }),
          }],
        };
      }

      // Build human-readable summary
      const summary = shotData.summary || {};
      const lines: string[] = [];
      if (summary.totalShots === 0) {
        lines.push("No camera cuts detected — single continuous take.");
      } else {
        const label = summary.isMultiCam ? "multi-cam" : "single-cam with cuts";
        lines.push(`Shot Boundaries (${summary.totalShots} detected, ${label}):`);
        lines.push(`  Average shot duration: ${Math.round((summary.averageShotDurationMs || 0) / 1000)}s`);
        lines.push(`  Transcript-aligned: ${summary.alignedCount || 0}/${summary.totalShots}`);
        lines.push("");

        for (let i = 0; i < (shotData.shots || []).length; i++) {
          const s = shotData.shots[i];
          const timeStr = formatMs(s.timestamp_ms);
          const snapStr = s.aligned && s.snappedTo_ms != null
            ? ` → snapped ${formatMs(s.snappedTo_ms)}`
            : "";
          lines.push(`  #${i + 1}  ${timeStr}${snapStr} (score ${s.score}) [${s.signals.join(", ")}]`);
          if (s.segmentBefore || s.segmentAfter) {
            const before = s.segmentBefore ? truncate(s.segmentBefore, 50) : "...";
            const after = s.segmentAfter ? truncate(s.segmentAfter, 50) : "...";
            lines.push(`       "${before}" → "${after}"`);
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: lines.join("\n") + "\n\n---\n\n" + JSON.stringify(shotData),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error reading shot boundaries: ${errorMessage(err)}` }],
        isError: true,
      };
    }
  }
);

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = ms % 1000;
  return `${min}:${String(sec).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
```

- [ ] **Step 3: Update tool description in server header comment**

At the top of the file (line 11), add `get_shot_boundaries` to the tools list in the doc comment:

```
 *   get_shot_boundaries  - detected camera cuts aligned with transcript
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat(mcp): add get_shot_boundaries tool to asset server"
```

---

### Task 4: Update Planner prompt

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md:207-229`

- [ ] **Step 1: Fix the `<excluded_from_plan>` contradiction**

In `packages/sandbox/src/prompts/planner/system.md` at line 210, change:

```
- **Multi-angle cuts** — not part of the scene plan
```

to:

```
- **Multi-angle switching logic** — the Planner does not control which camera angle plays; it uses detected shot boundaries as scene transition hints only
```

- [ ] **Step 2: Add `get_shot_boundaries` step to the `<task>` list**

At line 221 (after step 6 "Read the manifest for canvas dimensions..."), insert a new step 7:

```
7. Call `get_shot_boundaries` — check for camera angle changes. If `isMultiCam: true`, use shot boundaries as preferred scene transition points.
```

Renumber existing steps 7-10 to 8-11.

- [ ] **Step 3: Add "Shot Boundary Awareness" section**

After the `</task>` tag (after the renumbered step 11), before the "Template Registry" section (line 231), add:

```markdown
## Shot Boundaries (Camera Cuts)

Before planning scenes, call `get_shot_boundaries` to check if the source video
has camera angle changes.

### If `isMultiCam: true`:
- **Prefer** aligning scene boundaries with shot boundaries — camera cuts are
  natural transition points for changing display mode or scene type.
- **Never** split a single camera shot across two scenes with different display
  modes (e.g., don't switch from Overlay to Stacked mid-shot).
- Use `segmentBefore`/`segmentAfter` text to understand topic transitions at
  each camera switch.
- Short shots (<3 seconds) between longer shots are likely cutaway/b-roll —
  consider keeping them within the surrounding scene rather than creating a
  separate scene for them.

### If `isMultiCam: false` or no shots:
- Plan as normal using transcript content and timing.

These are guidelines, not hard constraints. Creative direction takes precedence.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "feat(planner): add shot boundary awareness to scene planning"
```

---

### Task 5: Update orchestrator Phase 3 dispatch

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:91-106`

- [ ] **Step 1: Add shot boundaries to Planner dispatch context**

At line 96, in the "Pass to Planner" section, add shot boundaries to the list:

```
- Content type, user's creative brief, canvas dimensions, theme, constraints
- Shot boundary data (call `get_shot_boundaries` to check for multi-cam footage)
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(orchestrator): include shot boundaries in Phase 3 planner dispatch"
```

---

### Task 6: Update workspace CLAUDE.md

**Files:**
- Modify: `packages/sandbox/template/.claude/CLAUDE.md:10` (workspace layout section)

- [ ] **Step 1: Add `shot-boundaries.json` to workspace layout docs**

In the workspace layout section, after the `speaker-grid.json` line (line 10), add:

```
  shot-boundaries.json           # Camera cut points with transcript context (use get_shot_boundaries tool)
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/CLAUDE.md
git commit -m "docs(sandbox): document shot-boundaries.json in workspace CLAUDE.md"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Verify detect_head.py runs without errors**

```bash
cd packages/worker/scripts
python detect_head.py <any-test-video> --output /tmp/shot_test.json
```

Check the output has a `"shots"` array. If no camera cuts exist in the test video, the array should be empty.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/sandbox
npx tsc --noEmit
```

```bash
cd packages/mcp-servers
npx tsc --noEmit
```

- [ ] **Step 3: Verify MCP tool loads**

```bash
cd packages/mcp-servers
echo '{}' > /tmp/test-shots.json
node dist/asset-server.js --workspace /tmp 2>&1 | head -5
```

- [ ] **Step 4: Final commit with all fixes**

If any compilation or runtime issues were found, fix and commit:

```bash
git add -A
git commit -m "fix: resolve shot boundary detection build issues"
```
