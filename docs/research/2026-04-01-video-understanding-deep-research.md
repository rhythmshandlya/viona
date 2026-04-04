# Video Understanding Layer: Deep Research
## Building Viona's Competitive Moat

> Compiled April 1, 2026 — Three parallel research tracks: academic papers, editing analysis, practical tools.
>
> **Goal**: Two capabilities that make Viona's agent far more capable than anything on the market:
> 1. **Full-context video understanding** — comprehend a video holistically (visual, audio, text, temporal)
> 2. **Reference video analysis** — reverse-engineer an already-edited video's craft (cuts, pacing, style, effects)

---

# Part 1: State-of-the-Art Video Understanding Models

## 1.1 Multimodal Video LLMs (2024-2026)

The landscape has exploded. Every major lab now has a Video LLM. The architecture pattern is converging: **vision encoder → projection/compression → LLM decoder**.

### Frontier Models

| Model | Org | Year | Key Innovation | Video-MME Score | Notes |
|-------|-----|------|---------------|-----------------|-------|
| **Gemini 2.5 Pro** | Google | 2025 | Native multimodal, 2M context, MoE | **84.8%** | Processes 6 hours of video natively. Best commercial option. |
| **Qwen2.5-VL-72B** | Alibaba | 2025 | Naive Dynamic Resolution + M-RoPE | 73.4% | Beats GPT-4o (66.8%). Dynamic FPS + absolute time alignment. |
| **InternVideo2.5** | OpenGVLab | 2025 | Hierarchical compression (LRC) | SOTA on 60+ tasks | 6x longer video inputs via clip-level → video-level compression. |
| **Apollo-7B** | Meta/Stanford | 2025 | Dual encoder (SigLIP + InternVideo2) | 70.9 MLVU | "Scaling Consistency" — design choices at 2-4B transfer to larger models. |
| **GPT-4.1** | OpenAI | 2025 | — | 72.0% (long) | No native video. Near-random on temporal reasoning benchmarks. |
| **Claude Opus 4.6** | Anthropic | 2026 | Best reasoning on frames | N/A (frame-based) | No native video. Excels at structured analysis of selected keyframes. |

### Key Architecture Trends

1. **Dual-encoder** — spatial specialist (SigLIP/CLIP) + temporal specialist (InternVideo2). Apollo proved this beats single-encoder.
2. **Dynamic resolution** — Qwen2.5-VL processes arbitrary resolutions as variable token counts. No more fixed-size preprocessing.
3. **Hierarchical compression** — VideoChat-Flash achieves ~1/50 compression ratio (16 tokens/frame) with almost no accuracy loss. Processes 3+ hour videos.
4. **FPS-based sampling** — Apollo and LLaVA-Video sample at fixed FPS (e.g., 1 FPS) instead of uniform frame counts. Content-aware.

### Open-Source Leaders (Self-Hostable)

| Model | Size | VRAM | Best For | Why |
|-------|------|------|----------|-----|
| **Qwen3-VL** | 2B-235B | 24GB (8B) | Best overall | 1M context, temporal reasoning, event localization |
| **Eagle 2.5** | 8B | ~20GB | Best efficiency | GPT-4o quality at 8B params. 512 frame support. |
| **Tarsier2** | 7B | ~24GB | Best descriptions | Beats GPT-4o on captioning (+2.8% F1) |
| **InternVL3** | 1B-78B | Varies | Most versatile | Video + GUI + 3D + tool use |
| **LLaVA-OneVision 1.5** | 0.5B-72B | Varies | Full reproducibility | Training code + data + weights all open |

### Token Efficiency Strategies

This is the critical engineering problem — videos are massive token consumers.

| Strategy | Compression | Example | Trade-off |
|----------|------------|---------|-----------|
| **Hierarchical compression** | ~50x | VideoChat-Flash (HiCo) | Best balance of quality/efficiency |
| **Token pruning** | >80% reduction | PruneVid | Training-free but loses some detail |
| **Dual-stream (Slow-Fast)** | 2-4x | SlowFast-LLaVA | Low-FPS detail + high-FPS motion |
| **Dynamic resolution** | Variable | Qwen2-VL, Oryx | On-demand — same model handles both |
| **Query-adaptive sampling** | Variable | VideoTree, AKS | Only loads frames relevant to the question |
| **Memory banks** | Streaming | MovieChat, MA-LMM | Processes frames online, stores compressed |

---

## 1.2 Temporal Reasoning — The Hardest Problem

**Current Video LLMs have a critical weakness**: even billion-parameter models struggle with explicit temporal reasoning. GPT-4o performs **near random chance** on temporal benchmarks.

### Why It Matters for Viona
Understanding "what happens when" is essential for both capabilities — you can't understand a video's content without temporal awareness, and you can't analyze editing decisions without knowing when cuts happen relative to content beats.

### Emerging Solutions

| Approach | Paper | Key Idea |
|----------|-------|----------|
| **Temporal attention in vision encoder** | Stacked Temporal Attention (2025) | Forces temporal awareness at the visual level, not just in the LLM |
| **Thinking-with-videos** | VideoTemp-o3 (2025) | Model actively localizes query-relevant intervals, then densely samples within them |
| **Special temporal tokens** | Grounded-VideoLLM (EMNLP 2025) | Dedicated temporal tokens in unified embedding space |
| **Time gating** | TG-Vid (EMNLP 2024) | Gated spatial + temporal attention + gated MLP |
| **Multi-round temporal focus** | SlowFocus (NeurIPS 2024) | Transforms inference into dialogue with temporal awareness |

### The Agentic Pattern
The most promising direction: **models that actively seek information rather than passively consuming all frames**. VideoTemp-o3 and VideoTree both work by first identifying which segments matter, then zooming in. This mirrors how professional editors review footage.

---

## 1.3 Long-Form Video Understanding

### Memory-Based Approaches

| Model | Venue | Approach | Capacity | Key Number |
|-------|-------|----------|----------|------------|
| **VideoChat-Flash** | ICLR 2026 | Hierarchical Compression (HiCo) | 3+ hours | 99.1% needle-in-haystack at 10K frames |
| **MovieChat** | CVPR 2024 | Short-term + long-term memory banks | >10K frames | Pioneered the memory paradigm |
| **MA-LMM** | CVPR 2024 | Online processing with causal attention | Streaming | Each frame only sees past — streaming-friendly |
| **LongVILA** | NVIDIA/MIT | Multi-Modal Sequence Parallelism | 2048 frames | 99.8% at 6000 frames (>1M tokens) |
| **Large World Model** | UC Berkeley | Blockwise RingAttention | 1M tokens | Theoretically unlimited context |

### Streaming / Real-Time

| Model | Year | Capability |
|-------|------|-----------|
| **VideoLLM-online** | CVPR 2024 | First streaming Video LLM. 5-10 FPS on 3090. |
| **StreamBridge** | 2025 | Converts offline Video-LLMs to streaming via memory buffer |
| **StreamingVLM** | 2025 | Finetuned Qwen2.5-VL for infinite streaming inference |
| **VideoChat-Online** | CVPR 2025 | Hierarchical memory for real-time processing |

---

## 1.4 Video Tokenization

### Neural Video Tokenizers

| Model | Org | Compression | Key Innovation |
|-------|-----|------------|---------------|
| **MAGVIT-v2** | Google (ICLR 2024) | High | Lookup-free quantization. LLMs with MAGVIT-v2 beat diffusion models. |
| **Cosmos Tokenizer** | NVIDIA | **2048x total** | 8-16x spatial × 4-8x temporal. State-of-the-art compression. |
| **VidTok** | Microsoft | High | Best open-source. Supports discrete + continuous, causal + noncausal. |

### Frame Sampling as Tokenization

Rather than VQ-tokenizing raw video, most Video LLMs use **frame sampling + vision encoder** as their tokenization:

- **Uniform**: Fixed N frames evenly spaced — simple baseline
- **FPS-based**: Fixed frames/second (1 FPS) — Apollo, LLaVA-Video
- **Adaptive keyframe (AKS)**: Content-aware selection — CVPR 2025
- **Query-adaptive**: Select frames relevant to the question — VideoTree, VideoTemp-o3
- **MaxInfo**: Max volume on token embeddings — training-free, competitive

**Key finding** (2025): Uniform-FPS performs best overall on Video-MME, but adaptive strategies win on temporal perception and reasoning tasks.

---

## 1.5 Benchmarks

| Benchmark | Venue | What It Tests | Key Insight |
|-----------|-------|--------------|-------------|
| **Video-MME** | CVPR 2025 | Full-spectrum (11s to 1hr), MCQ | Gold standard. Performance drops with duration for all models. |
| **MVBench** | CVPR 2024 | 20 temporal perception tasks | Tests if models truly perceive temporal dynamics vs single-frame shortcuts. |
| **EgoSchema** | NeurIPS 2023 | 3-min egocentric clips, 5000 MCQs | Even billion-param models <33%. Humans ~76%. Hardest benchmark. |
| **MLVU** | CVPR 2025 | Multi-task long video understanding | Multiple task types probing different comprehension aspects. |
| **LongVideoBench** | NeurIPS 2024 | Up to 1hr, 6678 human MCQs | "Referring reasoning" — challenges even GPT-4o and Gemini. |
| **VEU-Bench** | CVPR 2025 | 19 tasks on video editing understanding | **Critical**: Current Vid-LLMs fail badly at understanding editing craft. |
| **StreamingBench** | 2025 | Online/real-time understanding | 900 videos, 18 tasks, 4500 QA pairs. |

---

# Part 2: Understanding Edited/Produced Videos

This is where Viona's moat lives. **No existing product can reverse-engineer an edited video's craft.**

## 2.1 Shot Boundary Detection

**Status: Essentially solved for hard cuts.**

| Tool | F1 Score | Technique | Best For |
|------|----------|-----------|----------|
| **TransNetV2** | >95% (hard cuts) | 3D CNN with DDCNN cells | De facto standard. Fast, accurate, PyTorch. |
| **AutoShot** | +4.2% over TransNetV2 | Neural Architecture Search | Best numbers. Introduced SHOT dataset for short-form. |
| **PySceneDetect** | Good (hard cuts) | Histogram diff, no ML | 83K+ weekly downloads. CLI + Python. No GPU needed. |
| **FFmpeg** | Basic | Histogram scene score | Fastest but least accurate. Good for pre-filtering. |

**Gradual transitions** (dissolves, wipes, fades): Still ~85% F1. Improving but not solved.

## 2.2 Video Editing Pattern Recognition

**Status: Active research frontier. Current Vid-LLMs fail badly (VEU-Bench).**

| Dataset/Paper | What It Provides | Key Number |
|---------------|-----------------|------------|
| **MovieCuts** (ECCV 2022) | 174K clips labeled with 10 professional cut types | Best model: 47.7% mAP — still open problem |
| **AVE** (ECCV 2022) | 196K shots with cinematography labels from 5.6K movie scenes | Foundation for AI-assisted editing research |
| **Edit3K** (2024) | 3,094 editing components across 619K videos | First large-scale atomic editing component dataset |
| **VEU-Bench** (CVPR 2025) | 19 fine-grained editing understanding tasks | Current Vid-LLMs **worse than random** on some tasks |
| **"From Shots to Stories"** (2025) | First LLM-based editing understanding | L-Storyboard: shots as structured language for LLM reasoning |
| **Cinemetrics** | 10K+ films with shot timing data | Pacing data: mean shot length dropped from 13.0s (1945) to 4.3s (2005) |

### Pacing & Rhythm Findings
- Shot length distributions follow a **Dagum distribution** (not normal/log-normal)
- The **1/f pattern** in shot sequences correlates with viewer attention and engagement
- Cinemetrics provides polynomial trendlines showing pacing fluctuations within films

## 2.3 Reference Video Style Transfer (Edit Cloning)

**Status: Nascent. No production-ready tool exists.**

| Paper | Year | Approach | Applicability |
|-------|------|----------|---------------|
| **Automatic NLE Transfer** | CVPR 2021W | Extract framing/content/speed/lighting, transfer via CV matching | Tested on 3,872 shots. Only direct "edit like this" paper. |
| **RL-Based Video Editing** | ACM MM 2023 | VLM extracts features → RL agent makes editing decisions | Most promising direction. Learns editing preferences from demos. |
| **MatchDiffusion** | ICCV 2025 | Training-free match-cut generation via diffusion | Generates cinematic match cuts from text prompts. |
| **HIVE** | 2025 | Long-to-short: highlight + character extraction + narrative | DramaAD benchmark: 800+ episodes, 500 pro-edited clips. |

**This is Viona's biggest opportunity.** "Edit like this reference" is something every creator wants and nobody can deliver.

## 2.4 Visual Effects & Motion Graphics Detection

| Capability | Status | Best Tool/Paper |
|-----------|--------|----------------|
| **Text overlays / lower thirds** | Mature | CRAFT + DBNet + transformer OCR pipeline |
| **Transition type classification** | ~85% | TransNetV2 detects; Edit3K classifies type |
| **Ken Burns / zoom-pan** | Doable | Optical flow analysis (uniform flow = camera move, divergent = zoom) |
| **Motion graphics / animation** | Early-stage | Edit3K animation category; VEU-Bench tests reasoning |
| **Fine-grained VFX classification** | Open research | No production solution |

## 2.5 Audio-Visual Alignment

| System | Venue | What It Does | Key Number |
|--------|-------|-------------|------------|
| **HarmonySet** | CVPR 2025 | 48K video-music pairs: rhythm, emotion, theme | Gold standard. 92% human consensus. |
| **AutoMatch** | 2023 | 87K tracks for beat matching | 83% F1 at hit@2 for beat-sync prediction |
| **MVAA** | ACM MM 2025 | Beat-aligned video editing via diffusion | Edits video motion to match music rhythm |
| **DiVAS** | CVPR 2024 (Disney) | Transformer lip-sync detection | 45ms precision. Handles noise, makeup, multi-speaker. |
| **Audio Match Cutting** | ICASSP 2024 | Self-supervised audio transitions between shots | Automates finding where audio from two shots can blend |

### Practical Beat-Sync Pipeline
1. Extract beats with librosa/madmom
2. Score cut points against beats (AutoMatch-style)
3. Keyframe insertion at beat-aligned timestamps (MVAA-style)
4. Verify alignment (DIFF-FOLEY Align Acc metric)

## 2.6 Cinematography Understanding

| Feature | Best Model | Accuracy | Method |
|---------|-----------|----------|--------|
| **Shot scale** (CU/MS/FS/LS) | MovieShots-trained | ~90% | CNN classification on MovieNet's 46K shots |
| **Camera movement** (pan/tilt/zoom/dolly) | DGME-T | 86% | Optical flow + Swin Transformer |
| **Shot type classification** | Multi-Task Camera | High efficiency | Hard parameter sharing, mobile-deployable |
| **Composition / saliency** | AIM 2024 winners | SOTA | Transformer-based saliency maps |

### Camera Movement Detection Methods
| Movement | Detection |
|----------|-----------|
| Static | Low optical flow magnitude |
| Pan | Uniform horizontal flow |
| Tilt | Uniform vertical flow |
| Zoom | Radial flow divergence/convergence |
| Dolly/Track | Parallax in optical flow |
| Handheld | High-frequency flow variation |

## 2.7 Short-Form Video Engagement Signals

From **SnapUGC** (ECCV 2024, 90K Snapchat videos) and industry analysis:

- **Video quality does NOT predict engagement** — MOS doesn't correlate with watch time
- **First 3 seconds are critical** — 63% of top performers hook in the opening
- **40-60% completion** is the algorithmic promotion threshold
- **Pattern interrupts work** — opening with silence gets 40% higher completion
- **Cross-modal attention fusion** (visual + audio + text) is the current best approach for engagement prediction
- **TikTok scans for editing originality** (Sep 2025 update) — unique patterns signal original content

---

# Part 3: Practical Implementation Stack

## 3.1 The Layered Architecture

The key insight from all research: **do not send raw video to expensive APIs**. Build cheap metadata layers first.

### Layer 1: Free Extraction (CPU, ~$0/video, ~30s for 10min video)

```python
# Scene boundaries
from scenedetect import detect, AdaptiveDetector
scenes = detect('video.mp4', AdaptiveDetector())

# Keyframe extraction (1 per scene)
for i, (start, end) in enumerate(scenes):
    mid = (start.get_seconds() + end.get_seconds()) / 2
    os.system(f'ffmpeg -ss {mid} -i video.mp4 -frames:v 1 frame_{i}.png')

# Transcription with word-level timestamps
from faster_whisper import WhisperModel
model = WhisperModel("large-v3", device="cuda")
segments, info = model.transcribe("video.mp4", word_timestamps=True)

# Audio features (tempo, beats, energy)
import librosa
y, sr = librosa.load('video.mp4')
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)

# Color palette per scene
from colorthief import ColorThief
palettes = [ColorThief(f'frame_{i}.png').get_palette(6) for i in range(len(scenes))]
```

### Layer 2: Embedding & Indexing (GPU, ~$0.01/video)

```python
# CLIP embeddings per keyframe
from transformers import CLIPModel, CLIPProcessor
clip = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")

# Store in vector DB for semantic search
# LanceDB for embedded, FAISS for speed, Milvus for scale
```

### Layer 3: Deep Understanding (API, ~$0.04-$1/video)

| Provider | Approach | Cost (5min video) | Strength |
|----------|----------|-------------------|----------|
| **Gemini 2.5 Pro** | Native video, low res | $0.04 | Cheapest. Native audio+visual. 6hr capacity. |
| **Gemini 2.5 Pro** | Native video, default | $0.11 | Better detail, still cheap. |
| **GPT-4o** | 30 keyframes, low detail | $0.006 | Cheapest per-frame option. |
| **Claude Sonnet** | 30 keyframes, 512px | $0.03 | Best reasoning on frames. |

**Winner for raw video analysis**: Gemini — native video + longest context + lowest cost.
**Winner for reasoning about selected moments**: Claude — best instruction following + structured analysis.

### Layer 4: Video RAG Architecture

```
INGESTION:
  Video → FFmpeg (keyframes) + Whisper (transcript) + CLIP (embeddings)
        + PySceneDetect (scenes) + librosa (audio) + ColorThief (palettes)
  → Unified index: vector DB + text index + metadata store

RETRIEVAL:
  Query → CLIP text encoder (visual search) + text embedding (transcript search)
        → Hybrid ranking (Reciprocal Rank Fusion)
  → Top-K segments with keyframes + transcript + metadata

GENERATION:
  LLM receives: retrieved keyframes + transcript context + metadata + question
  → Grounded answer with timestamps
```

## 3.2 Open-Source Model Selection for Self-Hosting

| Need | Model | Size | VRAM | Why |
|------|-------|------|------|-----|
| Best overall | **Qwen3-VL-8B** | 8B | ~24GB | 1M context, temporal reasoning |
| Best efficiency | **Eagle 2.5-8B** | 8B | ~20GB | GPT-4o quality at 8B params |
| Best descriptions | **Tarsier2-7B** | 7B | ~24GB | Beats GPT-4o on captioning |
| Edge deployment | **Qwen3-VL-2B** | 2B | ~8GB | Smallest viable video model |

## 3.3 Commercial APIs for Enrichment

| API | Best For | Cost | Self-Host |
|-----|----------|------|-----------|
| **Twelve Labs** | Semantic video search | $0.033/min+ | No |
| **Google Video Intelligence** | Structured labels (20K+) | $0.10/min | No |
| **AWS Rekognition** | Security/moderation | $0.10/min | No |
| **Mixpeek** | Multimodal search (video+docs) | Custom | No |

---

# Part 4: Strategic Recommendations for Viona

## 4.1 Capability 1: Full-Context Video Understanding

**Architecture**: Multi-layer extraction pipeline feeding into an agentic reasoning loop.

### Proposed Pipeline
1. **Ingest** — FFmpeg + PySceneDetect + faster-whisper + librosa + CLIP
2. **Index** — Scene-level chunks in LanceDB (frame embeddings + transcript + metadata)
3. **Understand** — Gemini 2.5 Pro for initial full-video analysis (cheapest native video)
4. **Deep-dive** — Claude Opus for targeted reasoning on selected moments (best structured analysis)
5. **RAG** — Hybrid retrieval (visual + text) for answering specific questions about the video

### What Makes This a Moat
- No competitor does the **cheap metadata layer first** → most send raw frames to expensive APIs
- The **agentic seeking pattern** (VideoTemp-o3 style) — model identifies what matters before zooming in
- **Video RAG** over the user's own content library is a retention flywheel

## 4.2 Full Video Decomposition — Extracting Everything

The goal: given a reference video, produce a document so detailed that a skilled editor could **recreate the video's style from scratch** without ever watching it. Seven extraction layers, each with specific tools.

---

### Layer 1: Scene Detection & Structure

**What**: Detect every scene change, classify each scene type, understand the sequence.

| What to Extract | Best Tool | Accuracy | How |
|----------------|-----------|----------|-----|
| Hard cuts | **TransNetV2** | >95% F1 | 3D CNN, PyTorch, near real-time |
| Gradual transitions (dissolves, wipes) | **TransNetV2 / AutoShot** | ~85% F1 | AutoShot +4.2% over TransNetV2 via NAS |
| Scene boundaries (simpler) | **PySceneDetect** | Good (hard cuts) | No GPU. `AdaptiveDetector()`. 83K weekly downloads. |
| Scene type (talking head / screencast / b-roll / title card / product shot / animation / split-screen / PiP) | **SigLIP2 zero-shot** or **Gemini** | ~85% | CLIP-style classification with text labels, or send keyframes to LLM |
| Layout (full-frame / centered / side-by-side / grid / PiP / asymmetric) | **Florence-2** | Good | Microsoft's 0.77B model: object detection + region captioning + OCR in one pass |
| PiP detection | **OpenCV contour analysis** | ~90% | Find small rectangles (5-25% frame area) with different content |
| Split screen | **Hough line transform** | ~90% | Detect strong vertical/horizontal dividing lines |

**Output per scene**:
```jsonc
{
  "index": 0,
  "start_s": 0.0,
  "end_s": 3.2,
  "duration_s": 3.2,
  "type": "talking_head",          // talking_head | screencast | b_roll | title_card | product_shot | animation | split_screen | pip
  "layout": "centered_subject",    // full_frame | centered | side_by_side | grid | pip | asymmetric
  "transition_in": "hard_cut",     // hard_cut | dissolve | wipe | fade_from_black | jump_cut | whip_pan
  "transition_out": "hard_cut"
}
```

---

### Layer 2: Caption & Text Analysis

**What**: How are captions presented? Style, animation, frequency, positioning.

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Burned-in text detection | **PaddleOCR v5** (PP-OCRv5) | 0.93 avg confidence. Best overall. GPU recommended but CPU works. |
| Text regions + bounding boxes | **PaddleOCR** or **CRAFT** | CRAFT gives character-level heatmaps (97.8% precision) but archived. PaddleOCR is actively maintained. |
| Text content (OCR) | **PaddleOCR** | 100+ languages. Handles diverse fonts/sizes/backgrounds. |
| Caption position | **Bounding box math** | Bottom 33% = subtitles/lower-third. Center = title. Top = header. Direct from OCR coords. |
| Caption size | **Box height / frame height** | Small <3%, Medium 3-6%, Large 6-10%, XL >10% |
| Font style (serif/sans/bold/handwritten) | **FontCLIP** | CLIP fine-tuned on 2383 font categories. Crop text region → font similarity scores. |
| Text color + stroke/shadow | **OpenCV pixel analysis** | Crop bbox, adaptive threshold → binary mask, extract median text pixel color. Dilate mask 1-3px + XOR = outline detection. Shift mask 2-4px + dark pixel check = shadow detection. |
| Background treatment (solid box / transparent / blur / none) | **OpenCV variance analysis** | Low variance in non-text pixels = solid box. Laplacian comparison inside vs outside = blur. Color match with surroundings = no background. |
| Caption frequency | **Sample at 2fps + PaddleOCR on bottom 40%** | Count frames with text. >85% = always-on, 50-85% = frequent, 20-50% = emphasis-only, <20% = hooks-only. |

#### Word-by-Word Animated Caption Detection (MrBeast/Hormozi style)

**No off-the-shelf tool exists.** But detectable with this pipeline:

1. Get per-word bounding boxes via PaddleOCR across consecutive frames
2. Track dominant color of each word across ~30 frames around appearance
3. If words change color **sequentially** (word 0 before word 1 before word 2) → karaoke/highlight animation
4. Correlate with **WhisperX** per-word timestamps — if visual color changes align with spoken word timing → confirmed word-by-word sync
5. Classify other patterns: bbox count increasing over time = typewriter, pixel intensity ramp = fade, bbox size oscillation = bounce, bbox position shift = slide

**Output per caption instance**:
```jsonc
{
  "start_s": 2.1,
  "end_s": 4.8,
  "text": "Did you know that 80% of startups fail?",
  "position": "center",
  "size": "large",
  "font_style": "bold_sans_serif",
  "color": "#FFFFFF",
  "has_stroke": true,
  "stroke_color": "#000000",
  "has_shadow": true,
  "background": "none",
  "animation": "word_by_word_highlight",  // static | word_highlight | typewriter | fade_in | bounce | slide_up | slide_left
  "highlight_color": "#FFD700",
  "synced_to_speech": true
}
```

---

### Layer 3: Motion Graphics & Visual Aesthetics

**What**: Is it kinetic text or static overlays? What animation styles? What's the overall aesthetic?

#### Animation Detection

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Static vs animated text | **PaddleOCR + bbox tracking** | Track text bounding boxes across 10-15 frames. Near-zero position/scale variance = static. Measurable displacement = animated. |
| Animation type classification | **RAFT / SEA-RAFT optical flow** | Compute dense optical flow, classify the flow field pattern per element |
| Scale/zoom animation | Optical flow | Radial divergence from element center = zoom in, convergence = zoom out |
| Slide animation | Optical flow | Uniform directional vectors = slide. Direction tells slide-left/right/up/down. |
| Bounce/elastic | Bbox tracking | Position oscillation with decaying amplitude over frames |
| Rotation | Optical flow | Circular flow pattern around element center |
| Parallax | Optical flow | Non-uniform magnitude across frame depth (foreground moves faster) |
| Camera movement (pan/tilt/zoom/dolly) | **CameraBench model** (Qwen2.5-VL fine-tuned) | NeurIPS 2025 Spotlight. Full taxonomy. Matches structure-from-motion accuracy. |
| Particle effects | **Background subtraction + connected components** | Many small components of similar size, random distribution, short lifespans = particles |

#### Aesthetic Classification

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Overall style (minimalist/maximalist/flat/glassmorphism/retro/modern) | **Gemini or Claude on keyframes** | LLMs are best for holistic aesthetic judgment. ~85-90% accuracy. |
| Color palette style (neon/pastel/monochrome/warm/cool) | **K-means clustering on pixels → HSL analysis** | Extract 5-6 dominant colors, classify by saturation (high = neon, low = pastel), lightness, and hue distribution |
| Visual density / complexity | **OpenCV edge density** | Canny edges → edge pixel ratio. <0.02 = minimal (title card), >0.25 = busy. |
| Text density | **PaddleOCR bbox area / frame area** | Percentage of frame covered by text |
| Color consistency across scenes | **K-means per scene → Delta E comparison** | Extract palette per scene, convert to CIELAB, compute Delta E. <15 = consistent. |
| Font consistency | **LLM on multiple frames** | Send 5-8 frames to Claude: "Are the fonts consistent?" ~80-85% accuracy. Computational approaches only ~60-70%. |
| Brand system detection | **LLM** | "Does this video use a consistent visual template?" Best done holistically. |

#### Background Analysis

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Background type (solid / gradient / footage / abstract / blur / green screen) | **Segmentation + analysis** | SAM 2 or MediaPipe for foreground separation, then analyze background region |
| Solid color | Pixel std dev on background | Very low standard deviation = solid |
| Gradient | Local vs global variance ratio | Low local variance + high global variance = gradient |
| Blur/bokeh | Laplacian variance | Very low Laplacian = blurred background |
| Green screen / composited | HSV thresholding | Dominant green hue in background region |
| Animated background | Frame differencing on background region | High inter-frame difference in background while foreground is stable |

**Output per scene**:
```jsonc
{
  "scene_index": 0,
  "aesthetic": "modern_minimalist",
  "background": "gradient_dark",
  "background_colors": ["#0a0a2e", "#1a1a4e"],
  "dominant_palette": ["#FFFFFF", "#FFD700", "#0a0a2e"],
  "palette_style": "high_contrast_neon",
  "visual_density": 0.12,
  "text_density": 0.08,
  "elements": [
    {
      "type": "kinetic_text",
      "animation": "scale_up_with_bounce",
      "duration_s": 0.6
    },
    {
      "type": "lower_third",
      "animation": "slide_in_left",
      "persistent": true
    }
  ],
  "camera_movement": "slow_zoom_in"
}
```

---

### Layer 4: Audio — Music, SFX, Speech, Sync

**What**: What music plays, where, what sound effects, how does audio sync with visuals?

#### Source Separation (split the audio first)

| Task | Best Tool | Why |
|------|-----------|-----|
| Separate vocals / music / drums / bass | **Demucs v4** (`htdemucs_ft`) | 9.0 dB SDR vs Spleeter's 5.9 dB. Spleeter is dead (no updates since 2019). Clean Python API. |

```python
from demucs.api import Separator
separator = Separator(model="htdemucs_ft")
origin, separated = separator.separate_audio_file("video_audio.wav")
# separated["vocals"], separated["drums"], separated["bass"], separated["other"]
```

#### Music Analysis (on separated music stem)

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| BPM / tempo | **madmom** `RNNBeatProcessor` | Neural network beat tracking. Top-ranked in MIREX. |
| Beat timestamps | **madmom** `DBNBeatTrackingProcessor` | Per-beat timestamps for sync correlation |
| Downbeats (bar positions) | **madmom** `RNNDownBeatProcessor` + DBN | Bar-level structure |
| Energy curve | **librosa** `rms()` | Smoothed RMS energy over time |
| Energy changes (drops/builds/crescendos) | **librosa** RMS derivative | Positive derivative = build, negative = decay, sudden large negative = drop |
| Structural segments (intro/verse/chorus/bridge) | **MSAF** or **All-In-One** | Segment music into functional parts |
| Genre / mood / energy | **Essentia** TF models | 100+ pretrained models. Arousal/valence, 400+ genre categories, danceability, mood clusters. |
| Where music plays | **librosa** RMS thresholding on music stem | Detect presence/absence of music across timeline. Background throughout? Intro/outro only? Drops at key moments? |

#### Sound Effect Detection

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| SFX classification (whoosh, pop, click, ding, impact, bass hit) | **PANNs** (pretrained on AudioSet, 527 classes) | `SoundEventDetection` gives per-frame probabilities for every AudioSet class. Relevant classes: "Whoosh/swoosh/swish", "Ding", "Clicking", "Burst/pop", "Bang", "Thump/thud", "Generic impact sounds" |
| SFX timestamps | **PANNs** frame-level output | Each 100ms frame gets probabilities per class. Threshold at 0.3-0.5. |
| Higher accuracy alternative | **BEATs** (Microsoft) | mAP 0.501 vs PANNs' 0.439. Harder to install. |

#### Speech Analysis

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Transcript + word timestamps | **faster-whisper** large-v3 | We already use this. ±0.5s accuracy for 95% of words. |
| Precise word alignment | **WhisperX** | wav2vec2 forced alignment. Sub-100ms word boundaries. + speaker diarization. |
| Speaking pace (WPM) | **Whisper word timestamps** | Count words / duration per segment. Typical: 130-170 WPM. Fast: >180. Slow: <120. |
| Pause detection | **Whisper word timestamps** | Gaps between consecutive words. >0.5s = deliberate pause. >1.5s = section break. |
| Vocal energy / delivery | **Parselmouth** (Praat wrapper) | Pitch contour, intensity, jitter, HNR. Classify: whisper (low intensity + high HNR) / normal / high-energy (high intensity + wide pitch range). |

#### Audio-Visual Sync Scoring

| What to Measure | How |
|----------------|-----|
| **Beat-cut correlation** | For each visual cut, find nearest beat timestamp. If within ±80ms → "synced". Score = synced_cuts / total_cuts. |
| **SFX-transition correlation** | Do whoosh/impact sounds coincide with scene transitions? |
| **Text reveal-beat correlation** | Do text overlays appear on beat timestamps? |
| **Volume ducking** | Compare music stem RMS during speech-active vs speech-inactive regions. Well-mixed: 40-70% music reduction during speech (7-10 LU). |
| **Music energy-visual energy correlation** | Correlate music RMS curve with visual motion intensity. High correlation = tight audio-visual sync. |

**Output**:
```jsonc
{
  "music": {
    "bpm": 128,
    "genre": "electronic_pop",
    "mood": "energetic_uplifting",
    "energy_curve": [/* per-second RMS values */],
    "structure": [
      {"type": "intro", "start_s": 0, "end_s": 8},
      {"type": "verse", "start_s": 8, "end_s": 32},
      {"type": "chorus", "start_s": 32, "end_s": 48}
    ],
    "presence": "throughout",
    "drops": [{"time_s": 15.2, "intensity": 0.9}],
    "builds": [{"start_s": 12.0, "end_s": 15.2}]
  },
  "sfx": [
    {"type": "whoosh", "time_s": 3.1, "confidence": 0.87, "synced_to": "scene_transition"},
    {"type": "pop", "time_s": 5.4, "confidence": 0.72, "synced_to": "text_reveal"}
  ],
  "speech": {
    "wpm_avg": 162,
    "wpm_range": [134, 198],
    "delivery": "high_energy",
    "pause_pattern": "short_frequent",
    "total_speech_s": 84,
    "total_silence_s": 16
  },
  "sync": {
    "beat_cut_correlation": 0.78,
    "sfx_transition_correlation": 0.65,
    "volume_ducking_db": -8.2,
    "overall_av_sync": "tight"
  }
}
```

---

### Layer 5: Color & Visual Identity

**What**: Color story over time, palette consistency, mood arc.

| What to Extract | Best Tool | How |
|----------------|-----------|-----|
| Dominant colors per scene | **K-means** (k=5-6) on keyframe pixels | Or **ColorThief** (`fast-colorthief` for speed) |
| Color palette style | **HSL analysis of centroids** | High saturation = neon/vibrant. Low saturation + high lightness = pastel. Low saturation + low lightness = muted. Narrow hue range = monochrome. |
| Color temperature | **Avg hue analysis** | Warm (reds/oranges/yellows, hue 0-60°) vs Cool (blues/greens, hue 180-270°) |
| Color story / mood arc | **Palette sequence over time** | Track how dominant hues shift scene-to-scene. "Warm → cool → warm" = common narrative arc. |
| Brand color consistency | **Delta E across scenes** | Convert to CIELAB, compute Delta E between matched colors. <15 = consistent brand palette. |
| Contrast ratio | **WCAG formula on text vs background** | High contrast = bold/punchy. Low contrast = soft/editorial. |

**Output**:
```jsonc
{
  "overall_palette": ["#0a0a2e", "#FFD700", "#FFFFFF", "#e94560", "#1a1a4e"],
  "palette_style": "dark_with_neon_accents",
  "temperature": "cool_dominant_with_warm_accents",
  "consistency_score": 0.87,
  "mood_arc": "neutral → energetic → reflective",
  "per_scene_palettes": [
    {"scene": 0, "colors": ["#0a0a2e", "#FFFFFF"], "temperature": "cool"},
    {"scene": 1, "colors": ["#e94560", "#FFD700"], "temperature": "warm"}
  ]
}
```

---

### Layer 6: Pacing & Rhythm

**What**: How fast is the editing? What's the rhythm pattern? How does pacing change over the video's arc?

| What to Extract | How |
|----------------|-----|
| Shot count | Count scene boundaries |
| Average shot length | Total duration / shot count |
| Shot length distribution | Histogram with 0.5s buckets |
| Cuts per minute | shot_count / (duration / 60) |
| Pacing curve | Plot shot lengths over time → shows acceleration/deceleration |
| Pacing style | Classify: constant (low variance), accelerating (decreasing lengths), decelerating, wave (periodic), chaotic (high variance) |
| Hook pacing vs body pacing | Compare avg shot length in first 5s vs rest |
| Beat-sync rhythm | % of cuts that land on music beats |

**Output**:
```jsonc
{
  "shot_count": 42,
  "duration_s": 97,
  "avg_shot_length_s": 2.31,
  "cuts_per_minute": 26.0,
  "shortest_shot_s": 0.4,
  "longest_shot_s": 8.1,
  "pacing_style": "accelerating_then_steady",
  "hook_pacing": {"avg_shot_length_s": 1.2, "cuts_per_minute": 42},
  "body_pacing": {"avg_shot_length_s": 2.8, "cuts_per_minute": 21},
  "beat_sync_rate": 0.78,
  "shot_length_distribution": {
    "0-1s": 8, "1-2s": 14, "2-3s": 11, "3-4s": 5, "4-5s": 2, "5s+": 2
  },
  "pacing_curve": [/* shot_length values over time */]
}
```

---

### Layer 7: LLM Synthesis — The Creative Brief

**What**: Take ALL the structured data from Layers 1-6 and have Claude/Gemini write a human-readable creative brief.

**Model**: Claude Opus for reasoning quality. Send the full structured JSON + 5-8 representative keyframes.

**Prompt structure**:
```
You are a professional video editor analyzing a reference video.
You've been given detailed computational analysis of the video.
Write a creative brief that captures the video's EDITING STYLE
so precisely that another editor could recreate it without ever
seeing the original.

Cover: pacing & rhythm, visual aesthetic, caption style,
animation approach, audio design, color story, hook technique,
and overall production philosophy.

[attach: structured JSON from all layers + keyframes]
```

**Expected output** (natural language, not JSON):
> **Pacing**: Fast-paced with 2.3s average cuts (26 cuts/min). The hook is especially rapid (1.2s avg in first 5 seconds) then settles into a steadier rhythm. 78% of cuts land on music beats — this editor cuts to the music, not to the speech.
>
> **Captions**: Always-on bold sans-serif captions, centered, white with black stroke. Word-by-word highlight animation in gold (#FFD700) synced to speech timing. Large size (~8% frame height). No background box — the stroke provides readability.
>
> **Visual style**: Dark minimalist — deep navy backgrounds (#0a0a2e) with neon accent colors. Clean, uncluttered frames. Text-forward design where kinetic typography carries 60% of the visual storytelling.
>
> **Animations**: Scale-up with elastic bounce for text reveals. Slide-in from left for supporting points. No particle effects, no organic shapes — everything is geometric and deliberate. Slow zoom-in on talking head shots (Ken Burns style).
>
> **Audio**: 128 BPM electronic pop throughout. Whoosh SFX on every scene transition. Pop/click SFX on text reveals. Music ducks 8dB during speech. There's a build section at 12-15s leading to a bass drop that coincides with the key statistic reveal.
>
> **Color story**: Cool-dominant with warm accents. The palette is consistent across all scenes (Delta E 12 — tight brand system). Gold (#FFD700) is used exclusively for emphasis/highlights. Red (#e94560) appears only during urgency/warning moments.
>
> **Hook technique**: Opens with a question in kinetic text ("Did you know...?") + rapid zoom into speaker's face + high-energy vocal delivery (198 WPM in first 3 seconds). Pattern interrupt: 0.4s of silence before the question.

---

### Complete Pipeline Summary

```
Reference Video
    │
    ├─ FFmpeg ──────────────── extract audio, extract frames at 2fps
    │
    ├─ LAYER 1: Structure
    │   ├─ PySceneDetect ───── scene boundaries
    │   ├─ SigLIP2 / Gemini ── scene type classification
    │   └─ Florence-2 ──────── layout detection
    │
    ├─ LAYER 2: Captions
    │   ├─ PaddleOCR v5 ────── text detection + OCR + bounding boxes
    │   ├─ FontCLIP ─────────── font style classification
    │   ├─ OpenCV ──────────── color/stroke/shadow/background analysis
    │   └─ Bbox tracking ───── animation type detection (word-highlight, typewriter, bounce, slide)
    │
    ├─ LAYER 3: Motion & Aesthetics
    │   ├─ RAFT/SEA-RAFT ───── optical flow for animation classification
    │   ├─ CameraBench model ─ camera movement detection
    │   ├─ K-means + HSL ───── color palette + style classification
    │   ├─ OpenCV Canny ────── visual density / complexity
    │   └─ SAM 2 ──────────── foreground/background separation + bg type
    │
    ├─ LAYER 4: Audio
    │   ├─ Demucs v4 ────────── source separation (vocals/music/drums/bass)
    │   ├─ madmom ──────────── beat tracking + downbeats
    │   ├─ librosa ─────────── energy curve, onset detection
    │   ├─ Essentia ─────────── genre/mood/energy classification
    │   ├─ PANNs ───────────── sound effect detection (whoosh/pop/ding/impact)
    │   ├─ faster-whisper ──── transcript + word timestamps
    │   └─ Parselmouth ──────── vocal delivery analysis (pitch/intensity)
    │
    ├─ LAYER 5: Color
    │   ├─ K-means / ColorThief  per-scene palette
    │   ├─ HSL analysis ──────── palette style classification
    │   └─ Delta E comparison ── consistency scoring
    │
    ├─ LAYER 6: Pacing (pure math on Layer 1 output)
    │   ├─ Shot length stats ── avg, distribution, curve
    │   ├─ Beat-sync scoring ── cuts vs beat timestamps
    │   └─ Hook vs body split ─ pacing comparison
    │
    └─ LAYER 7: LLM Synthesis
        └─ Claude Opus ──────── structured data + keyframes → creative brief

Total cost: ~$0.15-0.30 per reference video
Total time: ~2-5 minutes (mostly Demucs + LLM)
GPU needed: Yes (Demucs, PaddleOCR, RAFT, PANNs) — or offload to worker
```

### Tool Installation Summary

```bash
# Core
pip install scenedetect[opencv] faster-whisper librosa colorthief

# OCR & Text
pip install paddlepaddle paddleocr

# Audio
pip install demucs madmom essentia-tensorflow parselmouth

# Vision
pip install open-clip-torch transformers  # SigLIP2, FontCLIP, Florence-2
pip install raft-optical-flow             # or install from RAFT repo

# Sound effects
pip install panns-inference               # PANNs AudioSet classifier

# Optional
pip install whisperx                      # better word alignment + diarization
```

---

# Part 5: Reference Video RAG — Feeding the Planner

## 5.1 The Idea

Ingest well-edited videos from the internet, break them down into structured editing blueprints, store in a RAG system. When the Director/Planner agent plans a new video, it pulls relevant editing patterns and applies them to the plan.

**Flow**: `Reference videos → Decomposition → Blueprints → RAG index → Planner queries at planning time → Better scene plans`

## 5.2 Prior Art: Tools That Do Partial Versions

| Tool | What It Does | What We Can Learn |
|------|-------------|-------------------|
| **HookMaster** (tryhookmaster.com) | Waitlist-only. Claims frame-by-frame analysis + "Style Match" (deconstruct reference into editing blueprint) + one-click fixes | The "editing blueprint" as a structured artifact is the right abstraction. Timestamped per-second annotations. |
| **Hook (askhook.com)** | 300+ variable analysis of short-form videos, trend scouting | Multi-variable analysis framework. What signals to extract. |
| **HookLens** | Frame-by-frame analysis, persona detection, script rewrites | Frame-level annotation approach. Geographic/audience fit scoring. |
| **Pixorld** | 7-signal hook analysis, hook rewriting | Concise signal taxonomy for quick scoring. |

None of these store decomposed blueprints in a retrievable knowledge base. They're all single-video analysis tools. The RAG layer is what makes this useful for a planner.

## 5.3 What an Editing Blueprint Should Contain

A blueprint is a structured JSON/markdown document extracted from a single reference video. It captures the **editing craft**, not just the content.

```jsonc
{
  "source": { "url": "...", "title": "...", "platform": "youtube", "duration_s": 127 },
  "pacing": {
    "avg_shot_length_s": 2.3,
    "shot_count": 55,
    "shot_length_distribution": [/* histogram buckets */],
    "pacing_curve": [/* shot_length over time — shows acceleration/deceleration */],
    "cuts_per_minute": 26.1
  },
  "shots": [
    {
      "index": 0,
      "start_s": 0.0, "end_s": 1.8,
      "scale": "close-up",           // MovieShots taxonomy
      "camera_movement": "static",    // pan/tilt/zoom/dolly/handheld/static
      "dominant_colors": ["#1a1a2e", "#e94560"],
      "has_text_overlay": true,
      "text_content": "DID YOU KNOW?",
      "has_face": true,
      "motion_intensity": 0.7,        // 0-1 scale from optical flow
      "audio_type": "speech+music",
      "beat_aligned_cut": true         // does the cut land on a music beat?
    }
    // ... per shot
  ],
  "audio_visual_sync": {
    "beat_cut_correlation": 0.82,      // how often cuts land on beats
    "speech_pause_cuts": 14,           // cuts that happen at speech pauses
    "music_energy_curve": [/* energy over time */]
  },
  "hook": {
    "duration_s": 3.0,
    "technique": "question + motion",  // LLM-classified hook type
    "elements": ["text_overlay", "face", "fast_zoom"]
  },
  "transitions": {
    "hard_cuts": 48,
    "dissolves": 3,
    "jump_cuts": 4,
    "whip_pans": 0
  },
  "color_story": {
    "palette_over_time": [/* per-scene palettes */],
    "mood_arc": "warm → cool → warm"  // LLM-synthesized
  },
  "llm_summary": "Fast-paced explainer with close-up talking head alternating with kinetic text overlays. Cuts sync to music beats at 82% rate. Hook uses question text + rapid zoom-in. Pacing accelerates in middle section (1.5s avg) then slows for conclusion (3.2s avg)."
}
```

## 5.4 Decomposition Pipeline

How we extract a blueprint from a raw video:

### Stage 1: Cheap Extraction (~$0, ~30s per 5min video)
| Step | Tool | Output |
|------|------|--------|
| Scene boundaries | PySceneDetect (AdaptiveDetector) | Shot start/end timestamps |
| Keyframe per shot | FFmpeg `-ss` at shot midpoint | Representative frame per shot |
| Transcript | faster-whisper large-v3 | Word-level timestamps |
| Beats & tempo | librosa `beat_track()` | Beat timestamps, BPM |
| Audio energy | librosa `rms()` | Energy curve over time |
| Color palettes | ColorThief per keyframe | Dominant colors per shot |
| Motion vectors | mv-extractor or FFmpeg scene scores | Motion intensity per shot |

### Stage 2: ML Classification (~$0.01, GPU)
| Step | Tool | Output |
|------|------|--------|
| Shot scale | MovieShots-trained classifier | CU/MS/FS/LS per shot |
| Camera movement | DGME-T or optical flow heuristics | pan/tilt/zoom/dolly/static per shot |
| Face detection | MediaPipe or MTCNN | Face presence + position per frame |
| Text overlay detection | CRAFT + DBNet → OCR | On-screen text content + position |
| Frame embeddings | CLIP ViT-L/14 | 768-dim vector per keyframe |

### Stage 3: LLM Synthesis (~$0.05-0.15)
| Step | Model | Output |
|------|-------|--------|
| Hook classification | Gemini/Claude on first 3s frames + transcript | Hook technique type |
| Style summary | Claude on full metadata bundle | Natural language editing description |
| Mood/emotion arc | Gemini on color + audio + transcript | Emotional progression |
| Beat-sync scoring | Computed: % of cuts within ±100ms of a beat | Correlation score |

### Total cost per reference video: ~$0.05-0.20

## 5.5 RAG Architecture for Blueprints

### Storage
```
blueprints/
  ├── {video_id}.json          # Full structured blueprint
  ├── embeddings/
  │   ├── style_embedding.npy  # CLIP-averaged visual style vector
  │   └── pacing_embedding.npy # Encoded pacing fingerprint
  └── keyframes/
      ├── shot_00.jpg
      ├── shot_01.jpg
      └── ...
```

### Index (LanceDB or Postgres + pgvector)
| Column | Type | What It Enables |
|--------|------|----------------|
| `id` | uuid | Primary key |
| `style_embedding` | vector(768) | "Find videos that look like this" |
| `pacing_fingerprint` | vector(64) | "Find videos with similar rhythm" |
| `avg_shot_length` | float | Filter by pacing speed |
| `cuts_per_minute` | float | Filter by editing intensity |
| `dominant_technique` | enum | Filter by hook/editing style |
| `platform` | enum | Filter by TikTok/YouTube/Reels |
| `category` | text | "explainer", "product", "vlog", etc. |
| `llm_summary` | text | Full-text search on style descriptions |
| `blueprint_json` | jsonb | The full structured blueprint |

### Retrieval at Planning Time
When the Director agent plans a new video, it queries the blueprint RAG:

1. **By category**: "Find explainer video blueprints" → filter by category
2. **By visual style**: Embed a mood board / style description with CLIP → ANN search on `style_embedding`
3. **By pacing**: "Fast-paced, 2s average shots" → filter on `avg_shot_length` + `cuts_per_minute`
4. **By technique**: "Videos with beat-synced cuts" → filter on `beat_cut_correlation > 0.7`
5. **Hybrid**: Text search on `llm_summary` + vector similarity, ranked with RRF

The planner receives 3-5 relevant blueprints and uses them as reference when writing the scene plan:
- Shot length targets from the reference's pacing curve
- Transition types and frequency
- Hook technique to emulate
- Color palette direction
- Audio-visual sync strategy

## 5.6 Open Questions for Further Research

1. **Ingestion source**: How do we get reference videos? YouTube-DL? User uploads? Curated library?
2. **Copyright**: Storing keyframes from copyrighted videos — fair use for internal analysis, but what about user-facing display?
3. **Scale**: How many reference videos do we need for useful retrieval? 100? 1000? 10000?
4. **Blueprint quality**: How do we validate that extracted blueprints are accurate? Human review? A/B testing of plans that use them?
5. **Pacing fingerprint encoding**: What's the best way to encode a shot-length distribution as a fixed-size vector for ANN search?
6. **Planner integration**: How does the Director prompt consume blueprints? Inline JSON? Natural language summary? Both?
7. **Feedback loop**: When a video performs well, can we auto-ingest its blueprint back into the RAG to reinforce good patterns?

---

# Key Sources

## Academic Papers
- [Video Understanding with LLMs: A Survey](https://arxiv.org/html/2312.17432v5)
- [From Seconds to Hours: Long Video Understanding Survey](https://github.com/Vincent-ZHQ/Comprehensive-Long-Video-Understanding-Survey)
- [VEU-Bench (CVPR 2025)](https://arxiv.org/abs/2504.17828) — Critical for editing understanding
- [MovieCuts (ECCV 2022)](https://arxiv.org/abs/2109.05569) — Cut type taxonomy
- [VideoChat-Flash / HiCo (ICLR 2026)](https://arxiv.org/abs/2501.00574) — Best compression
- [Apollo (CVPR 2025)](https://arxiv.org/abs/2412.10360) — Dual encoder architecture
- [VideoTree (CVPR 2025)](https://arxiv.org/abs/2405.19209) — Query-adaptive frame selection
- [Video-RAG (NeurIPS 2025)](https://arxiv.org/abs/2411.13093) — Training-free video RAG
- [HarmonySet (CVPR 2025)](https://arxiv.org/abs/2503.01725) — Audio-visual alignment
- [SnapUGC (ECCV 2024)](https://arxiv.org/abs/2410.00289) — Engagement prediction
- [Qwen2.5-VL Technical Report](https://arxiv.org/pdf/2502.13923)
- [InternVideo2.5](https://arxiv.org/abs/2501.12386)
- [Tarsier2 (ByteDance)](https://github.com/bytedance/tarsier)
- [Eagle 2.5 (NVIDIA)](https://github.com/NVlabs/Eagle)
- [MAGVIT-v2 (ICLR 2024)](https://magvit.cs.cmu.edu/v2/)
- [Cosmos Tokenizer (NVIDIA)](https://github.com/NVIDIA/Cosmos-Tokenizer)
- [From Shots to Stories (2025)](https://arxiv.org/abs/2505.12237)
- [Edit3K (2024)](https://arxiv.org/abs/2403.16048)
- [DGME-T (2025)](https://arxiv.org/abs/2510.15725)
- [MVAA (ACM MM 2025)](https://arxiv.org/abs/2506.18881)
- [RL-Based Video Editing (2024)](https://arxiv.org/abs/2411.04942)

## Open-Source Tools
- [TransNetV2](https://github.com/soCzech/TransNetV2) — Shot boundary detection
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — Scene detection
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — Fast transcription
- [WhisperX](https://github.com/m-bain/whisperx) — Precise word timestamps + diarization
- [librosa](https://librosa.org) — Audio feature extraction
- [CLIP](https://github.com/openai/CLIP) — Frame embeddings
- [VideoPrism](https://github.com/google-deepmind/videoprism) — Video encoder
- [LanceDB](https://lancedb.com/) — Embedded vector DB
- [Token0](https://pypi.org/project/token0/) — Video frame optimization for LLMs
- [mv-extractor](https://github.com/LukasBommes/mv-extractor) — Motion vector extraction

## Curated Collections
- [Awesome Video Editing](https://github.com/wentianli/awesome-video-editing)
- [Awesome LLMs for Video Understanding](https://github.com/yunlong10/Awesome-LLMs-for-Video-Understanding)
- [Intelligent Cinematography Survey (2024)](https://arxiv.org/abs/2405.05039)
- [Cinemetrics](https://cinemetrics.uchicago.edu/) — 10K+ films with shot timing data
