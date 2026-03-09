# Head & Body Tracking Pipeline

## Overview

A pipeline that analyzes talking-head videos and outputs frame-by-frame positions of the speaker's face and upper body. This enables smart placement of animations and captions without blocking the speaker.

## Goals

- Detect face position with key landmarks (eyes, nose, mouth, chin, forehead)
- Detect upper body (shoulders, hands for gesture awareness)
- Output JSON that frontend can use to calculate "safe zones" for placing graphics
- Run alongside WhisperX transcription (disabled by default via feature flag)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | MediaPipe Holistic | Face mesh + pose + hands in one pass, CPU-friendly, easy install |
| Processing | Server-side (worker) | Reuse existing Python infra, compute once and cache |
| Sampling | Every N frames (default 3) | Configurable, ~10 samples/sec at 30fps |
| Landmarks | 20 key face points + shoulders/hands | Sufficient for layout, not verbose |

---

## Phase 1: Standalone Script

**Goal:** Build and test the detection script independently before integration.

### Deliverables

1. `packages/worker/scripts/detect_head.py` - CLI detection script
2. Updated `packages/worker/requirements.txt` - add mediapipe

### CLI Interface

```bash
# Basic usage
python detect_head.py /path/to/video.mp4

# Custom interval
python detect_head.py /path/to/video.mp4 --interval 5

# Custom output path
python detect_head.py /path/to/video.mp4 --output /path/to/output.json

# Debug mode with visual overlay
python detect_head.py /path/to/video.mp4 --debug
```

### Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `input` | required | Path to input video file |
| `--interval` | 3 | Sample every N frames |
| `--output` | `{input}_tracking.json` | Output JSON path |
| `--debug` | false | Generate preview video with landmarks |
| `--min-confidence` | 0.5 | Skip frames below threshold |

### Output JSON Structure

```json
{
  "video": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "duration_ms": 125000,
    "total_frames": 3750
  },
  "settings": {
    "sample_interval": 3,
    "samples_count": 1250
  },
  "metadata": {
    "detection_rate": 0.94,
    "frames_processed": 1250,
    "frames_with_face": 1175,
    "frames_skipped": 75,
    "warnings": []
  },
  "frames": [
    {
      "frame": 0,
      "timestamp_ms": 0,
      "face": {
        "bbox": { "x": 480, "y": 120, "width": 320, "height": 400 },
        "landmarks": {
          "left_eye": { "x": 540, "y": 220 },
          "right_eye": { "x": 620, "y": 218 },
          "left_eye_outer": { "x": 510, "y": 222 },
          "right_eye_outer": { "x": 650, "y": 220 },
          "left_eye_inner": { "x": 560, "y": 221 },
          "right_eye_inner": { "x": 600, "y": 219 },
          "left_eyebrow_outer": { "x": 500, "y": 195 },
          "right_eyebrow_outer": { "x": 660, "y": 193 },
          "left_eyebrow_inner": { "x": 555, "y": 190 },
          "right_eyebrow_inner": { "x": 605, "y": 188 },
          "nose_tip": { "x": 580, "y": 300 },
          "nose_bridge": { "x": 580, "y": 250 },
          "mouth_center": { "x": 582, "y": 380 },
          "mouth_left": { "x": 540, "y": 378 },
          "mouth_right": { "x": 620, "y": 379 },
          "upper_lip": { "x": 580, "y": 370 },
          "lower_lip": { "x": 580, "y": 395 },
          "chin": { "x": 580, "y": 450 },
          "forehead": { "x": 580, "y": 150 },
          "left_cheek": { "x": 490, "y": 320 },
          "right_cheek": { "x": 670, "y": 318 }
        }
      },
      "body": {
        "left_shoulder": { "x": 380, "y": 520, "visible": true },
        "right_shoulder": { "x": 780, "y": 525, "visible": true },
        "left_hand": { "x": 200, "y": 700, "visible": true },
        "right_hand": { "x": 900, "y": 650, "visible": false }
      },
      "confidence": 0.94
    }
  ]
}
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No face in frame | Store `face: null`, continue processing |
| Multiple faces | Use largest face, log warning |
| Hands off-screen | Mark `visible: false` for that hand |
| Low confidence | Skip frame, interpolate from neighbors |
| Corrupted frame | Skip and log, continue |

### Exit Codes

- `0` - Success
- `1` - No faces detected in entire video
- `2` - Input file not found
- `3` - MediaPipe initialization failed

### Script Structure

```
detect_head.py (~200 lines)
├── Imports & constants
├── parse_arguments()
├── init_mediapipe()
├── extract_face_landmarks() → 20 key points from 468 mesh
├── extract_body_landmarks() → shoulders + hands
├── calculate_bbox() → bounding box from face outline
├── process_video() → main processing loop
├── generate_debug_video() → optional overlay visualization
└── main()
```

### Testing Checklist

- [ ] Process sample talking-head video
- [ ] Verify JSON structure matches spec
- [ ] Test `--debug` flag produces viewable overlay video
- [ ] Test with video where speaker looks away
- [ ] Test with video where hands gesture
- [ ] Test with no face (should exit with code 1)

---

## Phase 2: Pipeline Integration

**Goal:** Integrate into worker pipeline alongside WhisperX, controlled by feature flag.

### Deliverables

1. `packages/worker/src/processors/head_tracking.ts` - TypeScript wrapper
2. Feature flag `HEAD_TRACKING_ENABLED` (default: false)
3. Store tracking data with project in database/S3
4. Update Dockerfile if needed for mediapipe

### Integration Points

```
Upload Video
    ↓
Transcription Job Starts
    ↓
┌─────────────────────────────────────┐
│  Run in parallel:                   │
│  • WhisperX (transcription)         │
│  • detect_head.py (if flag enabled) │
└─────────────────────────────────────┘
    ↓
Store Results
    ↓
Editor Ready (with tracking data if available)
```

### TypeScript Wrapper

```typescript
// packages/worker/src/processors/head_tracking.ts

interface TrackingResult {
  video: VideoMetadata;
  settings: TrackingSettings;
  metadata: TrackingMetadata;
  frames: FrameData[];
}

export async function detectHeadPositions(
  videoPath: string,
  options?: { interval?: number }
): Promise<TrackingResult> {
  // Spawn Python script, parse JSON output
}
```

### Feature Flag

```bash
# Environment variable
HEAD_TRACKING_ENABLED=false  # default

# In config.ts
headTracking: {
  enabled: process.env.HEAD_TRACKING_ENABLED === 'true',
  sampleInterval: parseInt(process.env.HEAD_TRACKING_INTERVAL || '3', 10),
}
```

### Storage

- Store `{projectId}_tracking.json` in S3 alongside other project assets
- Load tracking data when editor opens
- Cache in project metadata for quick access

### P2 Tasks

- [ ] Create TypeScript wrapper
- [ ] Add feature flag to config
- [ ] Integrate into transcription processor
- [ ] Store results in S3
- [ ] Update Dockerfile with mediapipe
- [ ] Add tracking data to project API response
- [ ] Frontend: use tracking data for caption placement

---

## Dependencies

```txt
# Add to requirements.txt
mediapipe>=0.10.0
opencv-python>=4.8.0
numpy>=1.24.0
```

## Future Enhancements (Not in Scope)

- Real-time tracking in browser (TensorFlow.js)
- Multiple speaker tracking
- Face identification (who is speaking)
- Emotion detection for dynamic styling
