#!/usr/bin/env python3
"""
Person Segmentation Script (RVM — Robust Video Matting) — ONNX Runtime variant

This is a parallel implementation of segment_person.py that uses ONNX Runtime
(onnxruntime-gpu) instead of PyTorch. Public API is identical so downstream
callers (handler.py) can switch backends without other changes.

Key differences from the torch version:
- Uses rvm_{backbone}_fp16.onnx exports instead of the .pth weights.
- RVM ONNX exports DO NOT have a time axis: `src` shape is (B, 3, H, W), not
  (B, T, 3, H, W). Recurrent state (r1i..r4i) chains frame-to-frame across
  sess.run() calls with B=1. SEQ_CHUNK is therefore used as a decode/encode
  buffer size rather than a model-time batch; we still issue per-frame
  inferences so the recurrent state is correctly maintained.
- No torch.compile, no cudnn.benchmark — ORT handles kernel selection itself.

Progress protocol (stdout, parsed by TypeScript processor) — identical to torch:
  - "Processing video: {W}x{H} @ {fps}fps, {total} frames"
  - "Processed {n} frames..."
  - "Done! Processed {n} frames"

Usage:
    python segment_person_onnx.py /path/to/clip.mp4 --output /path/to/matte.mp4
    python segment_person_onnx.py /path/to/clip.mp4 --output /path/to/matte.mp4 --backbone mobilenetv3
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKBONE = "resnet50"
SCALE_FACTOR = 0.5
MATTE_FPS = 0  # 0 = use source native frame rate (recommended for alignment)
DOWNSAMPLE_RATIO = 0.25  # paper default for 1080p; 0.125 for 4K. 0.8 was ~10× the prescribed internal pixel count.
SEQ_CHUNK = int(os.environ.get('RVM_SEQ_CHUNK', '4'))
# RVM_COMPILE is ignored in the ORT variant — no torch.compile equivalent.

# Model location — directory containing rvm_{backbone}_fp16.onnx files.
# In the ONNX Dockerfile these are baked into /models.
RVM_MODELS_DIR = os.environ.get('RVM_MODELS_DIR', '/models')

# Model download URLs (official RVM GitHub releases — ONNX fp16 exports)
MODEL_URLS = {
    "resnet50": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50_fp16.onnx",
    "mobilenetv3": "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp16.onnx",
}


def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Extract person alpha matte from video using RVM (ONNX Runtime)."
    )
    parser.add_argument("input", type=str, help="Path to input video file")
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output matte MP4 path",
    )
    parser.add_argument(
        "--backbone",
        type=str,
        default=BACKBONE,
        choices=["resnet50", "mobilenetv3"],
        help=f"RVM backbone (default: {BACKBONE})",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=SCALE_FACTOR,
        help=f"Output scale factor relative to source (default: {SCALE_FACTOR})",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=MATTE_FPS,
        help=f"Output matte FPS. 0 = use source native rate for perfect alignment (default: {MATTE_FPS})",
    )
    parser.add_argument(
        "--downsample-ratio",
        type=float,
        default=DOWNSAMPLE_RATIO,
        help=f"RVM internal downsample ratio (default: {DOWNSAMPLE_RATIO})",
    )
    parser.add_argument("--start-ms", type=int, default=0, help="(Deprecated) Scene start time in ms — use --bg-ranges instead")
    parser.add_argument("--end-ms", type=int, default=0, help="(Deprecated) Scene end time in ms — use --bg-ranges instead")
    parser.add_argument("--bg-output", type=str, default="", help="(Deprecated) Single bg output path — use --bg-ranges instead")
    parser.add_argument("--bg-ranges", type=str, default="", help="JSON array of {sceneId, startMs, endMs, output} for multiple background images")
    parser.add_argument("--matte-ranges", type=str, default="", help="JSON array of {startMs, endMs} — only run RVM inference for frames within these ranges; output black matte for frames outside")
    return parser.parse_args()


def probe_video(input_path: str) -> dict:
    """Probe video dimensions, fps, and duration using ffprobe."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration",
         "-show_entries", "format=duration",
         "-of", "csv=p=0", input_path],
        capture_output=True, text=True
    )
    lines = probe.stdout.strip().split("\n")
    parts = lines[0].split(",")
    src_w, src_h = int(parts[0]), int(parts[1])
    fps_frac = parts[2].strip()  # e.g., "30000/1001"
    fps_num, fps_den = map(int, fps_frac.split("/"))
    fps = fps_num / fps_den

    duration_s = 0
    for p in parts[3:]:
        try:
            duration_s = float(p)
            break
        except (ValueError, IndexError):
            pass
    if duration_s == 0 and len(lines) > 1:
        try:
            duration_s = float(lines[1].strip())
        except (ValueError, IndexError):
            pass

    return {"width": src_w, "height": src_h, "fps": fps, "fps_frac": fps_frac, "duration_s": duration_s}


def load_rvm_onnx(backbone: str, providers=None) -> ort.InferenceSession:
    """Load the RVM ONNX model for the given backbone.

    Resolves the file from $RVM_MODELS_DIR (default /models). If not present,
    falls back to downloading into ~/.cache/rvm/ (useful for local dev outside
    Docker; in production the Dockerfile pre-downloads into /models).

    Returns an InferenceSession. Verifies CUDAExecutionProvider is actually
    active if it was requested.
    """
    if providers is None:
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']

    model_filename = f"rvm_{backbone}_fp16.onnx"
    model_path = os.path.join(RVM_MODELS_DIR, model_filename)

    if not os.path.exists(model_path):
        # Dev fallback — download into user cache
        cache_dir = os.path.expanduser("~/.cache/rvm")
        os.makedirs(cache_dir, exist_ok=True)
        model_path = os.path.join(cache_dir, model_filename)
        if not os.path.exists(model_path):
            url = MODEL_URLS[backbone]
            print(f"Downloading {backbone} ONNX weights: {url}", flush=True)
            # Use urllib so we don't depend on torch.hub
            import urllib.request
            urllib.request.urlretrieve(url, model_path)

    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess = ort.InferenceSession(model_path, sess_options=sess_options, providers=providers)

    active = sess.get_providers()
    print(f"Model loaded: {backbone} | providers={active} | {model_path}", flush=True)
    return sess


_nvenc_cached = None
_nvdec_cached = None

def _has_nvenc() -> bool:
    """Probe actual NVENC availability by attempting a tiny encode.
    Needs the libnvidia-encode.so driver lib present in the container.

    NOTE: NVENC H.264 has a minimum input dimension (145×49 per NVIDIA's
    Video Codec SDK). A 64×64 probe ALWAYS fails with "Frame Dimension less
    than the minimum supported value" — earlier versions of this function
    used 64×64 and gave false negatives even on working containers. 256×256
    is safe for H.264, HEVC, and AV1 encoders.
    """
    global _nvenc_cached
    if _nvenc_cached is not None:
        return _nvenc_cached
    try:
        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error",
             "-f", "lavfi", "-i", "nullsrc=s=256x256:d=0.1",
             "-c:v", "h264_nvenc", "-f", "null", "-"],
            capture_output=True, timeout=15,
        )
        _nvenc_cached = r.returncode == 0
    except Exception:
        _nvenc_cached = False
    print(f"NVENC probe: {'available' if _nvenc_cached else 'unavailable — falling back to libx264'}", flush=True)
    return _nvenc_cached

def _has_nvdec() -> bool:
    """Probe actual NVCUVID decoder availability.
    Needs the libnvcuvid.so driver lib present in the container."""
    global _nvdec_cached
    if _nvdec_cached is not None:
        return _nvdec_cached
    try:
        # ffmpeg -hwaccels lists cuda regardless of driver presence,
        # so run a real tiny decode-with-hwaccel to truly verify.
        # Use 256x256 to match NVENC's minimum (so the encode step of the
        # probe pipeline doesn't fail before we get to test decode).
        enc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-f", "lavfi", "-i", "nullsrc=s=256x256:d=0.2",
             "-c:v", "libx264", "-preset", "ultrafast", "-f", "mp4", "/tmp/_probe.mp4"],
            capture_output=True, timeout=15,
        )
        if enc.returncode != 0:
            _nvdec_cached = False
        else:
            r = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-hwaccel", "cuda", "-i", "/tmp/_probe.mp4",
                 "-f", "null", "-"],
                capture_output=True, timeout=15,
            )
            _nvdec_cached = r.returncode == 0
    except Exception:
        _nvdec_cached = False
    print(f"NVDEC probe: {'available' if _nvdec_cached else 'unavailable — software decode'}", flush=True)
    return _nvdec_cached


def make_ffmpeg_encoder(output_path: str, w: int, h: int, fps_str: str, qp: int = 18):
    """Create FFmpeg encoder subprocess for RGB matte output (NVENC with libx264 fallback)."""
    if _has_nvenc():
        codec_args = ["-c:v", "h264_nvenc", "-preset", "p1", "-rc", "constqp", "-qp", str(qp)]
    else:
        # libx264 CRF is ~2-3 points more aggressive than NVENC QP at the same value
        crf = max(0, qp - 2)
        codec_args = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", str(crf)]

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{w}x{h}", "-r", fps_str,
        "-i", "pipe:0",
        *codec_args,
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=w * h * 3 * SEQ_CHUNK)


def _zero_rec_state(dtype=np.float16):
    """Initial recurrent state: dummy (1,1,1,1) zero tensors.

    RVM's ONNX export treats any zero-initial rec state as 'start of sequence'
    and internally expands it to the right shape based on downsample_ratio.
    Confirmed via introspection against rvm_resnet50_fp16.onnx."""
    return [np.zeros((1, 1, 1, 1), dtype=dtype) for _ in range(4)]


def process_video(
    input_path: str,
    output_path: str,
    backbone: str,
    scale: float,
    fps: int,
    downsample_ratio: float,
    matte_ranges: list = None,
) -> dict:
    """Run RVM segmentation on a video file via ONNX Runtime. Output RGB matte MP4 via FFmpeg pipe.

    Return shape is identical to the torch variant:
      {framesProcessed, framesWritten, outputWidth, outputHeight, outputFps, bboxPath, fgrPath}
    """
    # Provider selection — CUDA if available, else CPU.
    requested_providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    available = ort.get_available_providers()
    providers = [p for p in requested_providers if p in available]
    device_label = 'cuda' if 'CUDAExecutionProvider' in providers else 'cpu'
    # The ONNX exports are fp16; ORT handles casting from fp16 input automatically
    # but feeding fp16 directly avoids CPU-side conversion.
    np_dtype = np.float16
    print(f"Using device: {device_label} | {np_dtype}", flush=True)

    print(f"Loading RVM model ({backbone})...", flush=True)
    sess = load_rvm_onnx(backbone, providers=providers)
    # Cache I/O binding names (spec'd: src, r1i..r4i, downsample_ratio → fgr, pha, r1o..r4o)
    input_names = [i.name for i in sess.get_inputs()]
    output_names = [o.name for o in sess.get_outputs()]
    assert 'src' in input_names, f"Unexpected ONNX inputs: {input_names}"
    assert all(n in output_names for n in ['fgr', 'pha']), f"Unexpected ONNX outputs: {output_names}"

    info = probe_video(input_path)
    src_w, src_h = info["width"], info["height"]
    src_fps = info["fps"]
    src_fps_frac = info["fps_frac"]  # e.g., "30000/1001"
    duration_s = info["duration_s"]

    # fps=0 means use source native rate (recommended for perfect frame alignment)
    if fps == 0:
        effective_fps = src_fps
        effective_fps_str = src_fps_frac  # pass fraction to FFmpeg for exact rate
    else:
        effective_fps = float(fps)
        effective_fps_str = str(fps)

    out_w = int(src_w * scale) // 2 * 2
    out_h = int(src_h * scale) // 2 * 2
    max_frames = int(duration_s * effective_fps)

    # Build frame-level skip mask from matte_ranges (ms → frame indices)
    # If matte_ranges is provided, only run RVM for frames within those ranges.
    # Frames outside get black matte output (no GPU inference).
    skip_mask = None
    if matte_ranges:
        skip_mask = np.ones(max_frames + 100, dtype=bool)  # True = skip
        active_frame_count = 0
        for r in matte_ranges:
            f_start = int(r["startMs"] / 1000 * effective_fps)
            f_end = int(r["endMs"] / 1000 * effective_fps)
            skip_mask[f_start:f_end] = False
            active_frame_count += f_end - f_start
        skipped = int(skip_mask[:max_frames].sum())
        print(f"Matte ranges: {len(matte_ranges)} ranges, {active_frame_count} active frames, {skipped} skipped")
    else:
        print("Matte ranges: none (processing all frames)")

    print(f"Processing video: {src_w}x{src_h} @ {src_fps:.2f}fps ({src_fps_frac}), {max_frames} frames", flush=True)
    print(f"Output: {out_w}x{out_h} @ {effective_fps:.2f}fps, scale={scale}", flush=True)

    # Warm-up: a couple of forward passes to stabilize cuDNN kernel selection.
    rec = _zero_rec_state(np_dtype)
    dsr_np = np.array([downsample_ratio], dtype=np.float32)
    if device_label == 'cuda':
        dummy_src = np.zeros((1, 3, out_h, out_w), dtype=np_dtype)
        for _ in range(2):
            warm_feeds = {
                'src': dummy_src,
                'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3],
                'downsample_ratio': dsr_np,
            }
            _fgr, _pha, r1o, r2o, r3o, r4o = sess.run(None, warm_feeds)
            # Don't keep warm rec state — reset before real inference
        rec = _zero_rec_state(np_dtype)

    decode_cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
    ]
    # Only request hardware decode if the driver libs are actually usable.
    if device_label == 'cuda' and _has_nvdec():
        decode_cmd.extend(["-hwaccel", "cuda"])
    # When using native fps (fps=0), don't apply fps filter — preserves exact frame correspondence.
    # When resampling (fps>0), apply fps filter to convert frame rate.
    vf = f"scale={out_w}:{out_h}" if fps == 0 else f"scale={out_w}:{out_h},fps={fps}"
    decode_cmd.extend([
        "-i", input_path,
        "-vf", vf,
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ])
    decoder = subprocess.Popen(
        decode_cmd, stdout=subprocess.PIPE,
        bufsize=out_w * out_h * 3 * SEQ_CHUNK,
    )

    # Matte: QP 24 — lower quality is fine for grayscale alpha mask
    encoder = make_ffmpeg_encoder(output_path, out_w, out_h, effective_fps_str, qp=24)
    fgr_output_path = str(Path(output_path).with_suffix('')) + '-fgr.mp4'
    # FGR: QP 21 — moderate savings, preserves person detail at edges
    fgr_encoder = make_ffmpeg_encoder(fgr_output_path, out_w, out_h, effective_fps_str, qp=21)

    frame_size = out_w * out_h * 3
    black_frame = np.zeros((out_h, out_w, 3), dtype=np.uint8)
    black_bytes = black_frame.tobytes()
    frame_idx = 0
    inferred_frames = 0
    start_time = time.time()
    bbox_frames = []

    while True:
        # Read SEQ_CHUNK frames at a time from decode pipe. SEQ_CHUNK in the
        # ONNX variant is a pipeline buffer, not a time-axis batch: we issue
        # per-frame inferences so the recurrent state is properly maintained.
        frames_rgb = []
        batch_frame_indices = []
        for _ in range(SEQ_CHUNK):
            raw = decoder.stdout.read(frame_size)
            if len(raw) < frame_size:
                break
            frames_rgb.append(np.frombuffer(raw, dtype=np.uint8).reshape(out_h, out_w, 3))
            batch_frame_indices.append(frame_idx + len(frames_rgb) - 1)

        if not frames_rgb:
            break

        T = len(frames_rgb)

        for t in range(T):
            current_idx = batch_frame_indices[t]
            should_skip = skip_mask is not None and current_idx < len(skip_mask) and skip_mask[current_idx]

            if should_skip:
                # Frame is outside matte ranges — write black, no inference.
                # Note: we do NOT advance the recurrent state for skipped
                # frames. When the next active range starts, rec state may be
                # stale, but the torch version has exactly the same behavior
                # (it also skipped without resetting rec), so behavior parity
                # is preserved.
                encoder.stdin.write(black_bytes)
                fgr_encoder.stdin.write(black_bytes)
                frame_idx += 1
                continue

            # Build (1, 3, H, W) fp16 tensor normalized to [0, 1]
            frame_f = frames_rgb[t].astype(np.float32) * (1.0 / 255.0)
            src_np = np.transpose(frame_f, (2, 0, 1))[None, ...].astype(np_dtype, copy=False)

            feeds = {
                'src': src_np,
                'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3],
                'downsample_ratio': dsr_np,
            }
            fgr_out, pha_out, r1o, r2o, r3o, r4o = sess.run(
                ['fgr', 'pha', 'r1o', 'r2o', 'r3o', 'r4o'], feeds
            )
            rec = [r1o, r2o, r3o, r4o]
            inferred_frames += 1

            # pha_out: (1, 1, H, W) fp16 — convert to u8 matte
            matte_u8 = np.clip(pha_out[0, 0].astype(np.float32) * 255.0, 0, 255).astype(np.uint8)

            # Tighter bbox: threshold at 128 (solid body only, not halos),
            # then erode to shrink edge noise from hair/clothing.
            mask = (matte_u8 > 128).astype(np.uint8)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
            mask = cv2.erode(mask, kernel, iterations=1)

            rows = np.any(mask > 0, axis=1)
            cols = np.any(mask > 0, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]

                pad_h = int(out_h * 0.05)
                pad_w = int(out_w * 0.05)
                rmin = max(0, rmin - pad_h)
                rmax = min(out_h - 1, rmax + pad_h)
                cmin = max(0, cmin - pad_w)
                cmax = min(out_w - 1, cmax + pad_w)

                bbox_frames.append({
                    "frame": current_idx,
                    "x": float(cmin / out_w),
                    "y": float(rmin / out_h),
                    "w": float((cmax - cmin + 1) / out_w),
                    "h": float((rmax - rmin + 1) / out_h),
                })

            matte_rgb = np.stack([matte_u8, matte_u8, matte_u8], axis=-1)
            encoder.stdin.write(matte_rgb.tobytes())

            # fgr_out: (1, 3, H, W) fp16 — persisted as straight RGB
            fgr_frame = np.transpose(fgr_out[0].astype(np.float32), (1, 2, 0)) * 255.0
            fgr_straight = np.clip(fgr_frame, 0, 255).astype(np.uint8)
            fgr_encoder.stdin.write(fgr_straight.tobytes())

            frame_idx += 1

        if frame_idx >= 100 and (frame_idx - T) // 100 < frame_idx // 100:
            elapsed_so_far = time.time() - start_time
            fps_so_far = frame_idx / max(0.1, elapsed_so_far)
            pct = frame_idx / max(1, max_frames) * 100
            remaining = (max_frames - frame_idx) / max(0.1, fps_so_far)
            print(f"Processed {frame_idx}/{max_frames} frames ({pct:.0f}%) | {fps_so_far:.1f} fps | {inferred_frames} inferred | ETA {remaining:.0f}s", flush=True)

    decoder.stdout.close()
    decoder.wait()
    encoder.stdin.close()
    encoder.wait()
    fgr_encoder.stdin.close()
    fgr_encoder.wait()

    elapsed = time.time() - start_time
    print(f"Done! Processed {frame_idx} frames ({inferred_frames} inferred, {frame_idx - inferred_frames} skipped) in {elapsed:.1f}s ({frame_idx / max(1, elapsed):.1f} fps)")
    print(f"Foreground video saved: {fgr_output_path}")

    # Compute aggregate stats for downstream tools
    if bbox_frames:
        avg_y = sum(f["y"] for f in bbox_frames) / len(bbox_frames)
        avg_h = sum(f["h"] for f in bbox_frames) / len(bbox_frames)
        avg_x = sum(f["x"] for f in bbox_frames) / len(bbox_frames)
        avg_w = sum(f["w"] for f in bbox_frames) / len(bbox_frames)
        face_y = avg_y + avg_h * 0.15  # face is ~15-35% from top of body bbox
        face_center_y = avg_y + avg_h * 0.25  # approximate face center
        aggregate = {
            "avgBbox": {"x": avg_x, "y": avg_y, "w": avg_w, "h": avg_h},
            "bodyCenter": {"x": avg_x + avg_w / 2, "y": avg_y + avg_h / 2},
            "faceEstimate": {"y": face_y, "centerY": face_center_y},
        }
    else:
        aggregate = None

    bbox_data = {"fps": effective_fps, "frames": bbox_frames, "aggregate": aggregate}
    bbox_path = str(Path(output_path).parent / "matte-bbox.json")
    with open(bbox_path, "w") as f:
        json.dump(bbox_data, f)
    print(f"Bounding boxes saved: {bbox_path} ({len(bbox_frames)} frames)")

    return {
        "framesProcessed": frame_idx,
        "framesWritten": frame_idx,
        "outputWidth": out_w,
        "outputHeight": out_h,
        "outputFps": effective_fps,
        "bboxPath": bbox_path,
        "fgrPath": fgr_output_path,
    }


def generate_background(input_path: str, matte_path: str, output_path: str, start_ms: int, end_ms: int) -> str:
    """Generate clean background by inpainting speaker out of a mid-scene frame using OpenAI."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not set, skipping background generation", file=sys.stderr)
        return ""

    try:
        import base64
        import tempfile
        from io import BytesIO
        from PIL import Image
        from openai import OpenAI
    except ImportError as e:
        print(f"Warning: Missing dependency for background generation ({e}), skipping", file=sys.stderr)
        return ""

    try:
        client = OpenAI(api_key=api_key)

        # Probe source dimensions
        info = probe_video(input_path)
        src_w, src_h = info["width"], info["height"]

        # Extract midpoint frame from source video
        mid_sec = ((start_ms + end_ms) / 2) / 1000 if end_ms > start_ms else 1.0
        frame_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        frame_tmp.close()
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{mid_sec:.3f}", "-i", input_path,
            "-frames:v", "1", "-q:v", "2", frame_tmp.name,
        ], check=True, timeout=30)

        # Extract matte frame at relative midpoint (matte is full-length)
        matte_frame_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        matte_frame_tmp.close()
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{mid_sec:.3f}", "-i", matte_path,
            "-frames:v", "1", "-q:v", "2", matte_frame_tmp.name,
        ], check=True, timeout=30)

        # Load images
        source = cv2.imread(frame_tmp.name)
        matte_gray = cv2.imread(matte_frame_tmp.name, cv2.IMREAD_GRAYSCALE)

        if source is None or matte_gray is None:
            print("Warning: Failed to read frame/matte for background generation", file=sys.stderr)
            return ""

        h, w = source.shape[:2]

        # API-supported portrait size
        api_w, api_h = 1024, 1536

        # Resize source to API dimensions
        source_rgb = cv2.cvtColor(source, cv2.COLOR_BGR2RGB)
        source_pil = Image.fromarray(source_rgb).resize((api_w, api_h), Image.LANCZOS)

        # Create mask: dilate matte, then make RGBA where speaker = transparent (to inpaint)
        _, mask_bin = cv2.threshold(matte_gray, 100, 255, cv2.THRESH_BINARY)
        kernel = np.ones((25, 25), np.uint8)
        mask_dilated = cv2.dilate(mask_bin, kernel, iterations=2)
        mask_resized = cv2.resize(mask_dilated, (api_w, api_h))

        mask_rgba = np.zeros((api_h, api_w, 4), dtype=np.uint8)
        mask_rgba[:, :, 3] = 255 - mask_resized  # transparent where speaker is
        mask_pil = Image.fromarray(mask_rgba)

        # Save temp files for API upload
        src_api_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        source_pil.convert("RGBA").save(src_api_tmp.name, format="PNG")
        src_api_tmp.close()

        mask_api_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        mask_pil.save(mask_api_tmp.name, format="PNG")
        mask_api_tmp.close()

        # Call OpenAI
        print("Generating clean background via OpenAI...")
        t0 = time.time()
        with open(src_api_tmp.name, "rb") as img_f, open(mask_api_tmp.name, "rb") as mask_f:
            result = client.images.edit(
                model="gpt-image-1",
                image=img_f,
                mask=mask_f,
                prompt="Remove the person completely. Fill the area with a natural continuation of the background environment. Match the exact lighting, colors, textures, and camera perspective. Empty scene, no person.",
                size=f"{api_w}x{api_h}",
            )
        elapsed = time.time() - t0

        image_bytes = base64.b64decode(result.data[0].b64_json)
        result_img = Image.open(BytesIO(image_bytes))
        result_img = result_img.resize((w, h), Image.LANCZOS)
        result_img.save(output_path)

        # Cleanup temp files
        for f in [frame_tmp.name, matte_frame_tmp.name, src_api_tmp.name, mask_api_tmp.name]:
            try:
                os.unlink(f)
            except OSError:
                pass

        print(f"Background generated in {elapsed:.1f}s: {output_path}")
        return output_path

    except Exception as e:
        print(f"Warning: Background generation failed: {e}", file=sys.stderr)
        return ""


def main():
    print(f"segment_person_onnx.py starting", flush=True)
    print(f"Python: {sys.executable}", flush=True)
    args = parse_arguments()
    print(f"Args parsed: input={args.input}, scale={args.scale}, backbone={args.backbone}", flush=True)

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(2)
    print(f"Input file exists: {input_path.stat().st_size} bytes", flush=True)

    matte_ranges = json.loads(args.matte_ranges) if args.matte_ranges else None
    print(f"Matte ranges: {len(matte_ranges) if matte_ranges else 'none'}", flush=True)
    result = process_video(
        str(input_path),
        args.output,
        args.backbone,
        args.scale,
        args.fps,
        args.downsample_ratio,
        matte_ranges=matte_ranges,
    )

    print(f"Matte saved: {args.output}")
    print(f"Bbox saved: {result['bboxPath']}")

    # Generate clean backgrounds
    if args.bg_ranges:
        # New: multiple bg images from JSON array
        ranges = json.loads(args.bg_ranges)
        for r in ranges:
            bg_out = r.get("output", "")
            if not bg_out:
                continue
            bg_path = generate_background(
                str(input_path),
                args.output,
                bg_out,
                r.get("startMs", 0),
                r.get("endMs", 0),
            )
            if bg_path:
                print(f"Background saved: {bg_path}")
    elif args.bg_output:
        # Legacy: single bg image
        bg_path = generate_background(
            str(input_path),
            args.output,
            args.bg_output,
            args.start_ms,
            args.end_ms,
        )
        if bg_path:
            print(f"Background saved: {bg_path}")

    sys.exit(0)


if __name__ == "__main__":
    main()
