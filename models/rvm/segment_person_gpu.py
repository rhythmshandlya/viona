#!/usr/bin/env python3
"""
Person Segmentation (RVM) — GPU-resident pipeline.

Full zero-copy pipeline: NVDEC → CuPy preprocess → ORT IOBinding → CuPy postprocess
→ NVENC → ffmpeg mp4 muxer (copy-mode, no re-encode).

Replaces segment_person_onnx.py's ffmpeg-rgb24-pipe + numpy CPU pipeline.
Frames never leave GPU memory from decode to encode.

Why: profiling showed the rgb24+numpy architecture is CPU-bound at ~3 FPS on any
GPU. Model alone runs at 30+ FPS. The 10× gap is pure pipeline overhead:
  - libx264 encode on CPU:       90 ms/frame
  - numpy preprocess (uint8→fp16): 34 ms/frame
  - numpy postprocess:             44 ms/frame
  - libx264 decode:                31 ms/frame

This module keeps everything on GPU via:
  - PyNvVideoCodec: NVDEC demux/decode, NVENC encode
  - CuPy RawKernels: NV12↔RGB fp16 NCHW conversions
  - ONNX Runtime IOBinding: recurrent state pinned on CUDA, no H2D/D2H per frame
  - ffmpeg -c:v copy: mp4 muxing only (tiny CPU cost, no transcode)

Public API matches segment_person_onnx.process_video so handler_onnx.py can
switch backends via env var RVM_GPU_PIPELINE=1.

Requires:
  - PyNvVideoCodec==1.0.2
  - cupy-cuda12x==13.3.0
  - NVIDIA_DRIVER_CAPABILITIES=compute,utility,video (Dockerfile ENV)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort

# These imports require the slim Dockerfile's pip layer to include cupy + PyNvVideoCodec.
# Kept at module-load so ImportError surfaces immediately rather than mid-run.
import cupy as cp
import cupyx.scipy.ndimage as cpn
import PyNvVideoCodec as nvc


BACKBONE = "resnet50"
SCALE_FACTOR = 0.5
MATTE_FPS = 0
DOWNSAMPLE_RATIO = 0.25
RVM_MODELS_DIR = os.environ.get("RVM_MODELS_DIR", "/models")


# ---------------------------------------------------------------------------
# CuPy kernels — NV12 ↔ RGB fp16 NCHW on GPU
# ---------------------------------------------------------------------------

# NV12 layout: Y plane (H×W) followed by interleaved UV plane (H/2 × W).
# Total buffer shape is (H*3/2, W) uint8.

# Kernel 1: NV12 (src_h×src_w) → fp16 NCHW (out_h×out_w), nearest-neighbor resize
# + BT.601 YUV→RGB + [0,1] normalize. Single kernel, one pass.
_nv12_to_fp16_nchw_src = r"""
extern "C" __global__
void nv12_to_fp16_nchw_scaled(
    const unsigned char* __restrict__ nv12,
    __half* __restrict__ out,
    int src_w, int src_h, int out_w, int out_h)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= out_w || y >= out_h) return;

    // Nearest-neighbor downsample to source coords
    int sx = (int)(((long long)x * (long long)src_w) / (long long)out_w);
    int sy = (int)(((long long)y * (long long)src_h) / (long long)out_h);
    if (sx >= src_w) sx = src_w - 1;
    if (sy >= src_h) sy = src_h - 1;

    float Y = (float)nv12[sy * src_w + sx];

    // UV plane: half resolution, interleaved UV pairs.
    // For even/odd x pairs in source, UV is at (sy/2, sx & ~1).
    int uvx = (sx & ~1);
    int uvy = (sy >> 1);
    int uv_base = src_h * src_w + uvy * src_w + uvx;
    float U = (float)nv12[uv_base]     - 128.0f;
    float V = (float)nv12[uv_base + 1] - 128.0f;

    // BT.601 YUV → RGB (SD; fine for matting workload — RVM is tolerant)
    float r = Y + 1.402f * V;
    float g = Y - 0.344136f * U - 0.714136f * V;
    float b = Y + 1.772f * U;

    int p = y * out_w + x;
    int plane = out_h * out_w;
    out[0 * plane + p] = __float2half(fmaxf(0.0f, fminf(1.0f, r * (1.0f / 255.0f))));
    out[1 * plane + p] = __float2half(fmaxf(0.0f, fminf(1.0f, g * (1.0f / 255.0f))));
    out[2 * plane + p] = __float2half(fmaxf(0.0f, fminf(1.0f, b * (1.0f / 255.0f))));
}
"""

# Kernel 2: pha (1,1,H,W) fp16 → matte NV12 grayscale.
# Y = pha*255, UV = 128 (neutral gray).
_pha_to_nv12_src = r"""
extern "C" __global__
void pha_to_nv12_grayscale(
    const __half* __restrict__ pha,
    unsigned char* __restrict__ nv12,
    int W, int H)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= W || y >= H) return;

    float p = __half2float(pha[y * W + x]);
    p = fmaxf(0.0f, fminf(1.0f, p));
    unsigned char v = (unsigned char)(p * 255.0f + 0.5f);

    nv12[y * W + x] = v;

    // Write UV 128 once per 2×2 block (only thread with even x,y in source coords)
    if ((x & 1) == 0 && (y & 1) == 0) {
        int uvy = y >> 1;
        int uv_base = H * W + uvy * W + x;
        nv12[uv_base]     = 128;
        nv12[uv_base + 1] = 128;
    }
}
"""

# Kernel 3: fgr (1,3,H,W) RGB fp16 → fgr NV12 YUV.
# BT.601 RGB→YUV, 4:2:0 subsample.
_fgr_rgb_to_nv12_src = r"""
extern "C" __global__
void fgr_rgb_fp16_to_nv12(
    const __half* __restrict__ fgr,
    unsigned char* __restrict__ nv12,
    int W, int H)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= W || y >= H) return;

    int p = y * W + x;
    int plane = H * W;

    float r = fmaxf(0.0f, fminf(1.0f, __half2float(fgr[0 * plane + p]))) * 255.0f;
    float g = fmaxf(0.0f, fminf(1.0f, __half2float(fgr[1 * plane + p]))) * 255.0f;
    float b = fmaxf(0.0f, fminf(1.0f, __half2float(fgr[2 * plane + p]))) * 255.0f;

    float Y =  0.299f * r + 0.587f * g + 0.114f * b;
    float U = -0.169f * r - 0.331f * g + 0.500f * b + 128.0f;
    float V =  0.500f * r - 0.419f * g - 0.081f * b + 128.0f;

    nv12[p] = (unsigned char)fmaxf(0.0f, fminf(255.0f, Y + 0.5f));

    // Write UV once per 2×2 block — simplified: take (even, even) sample's UV
    if ((x & 1) == 0 && (y & 1) == 0) {
        int uvy = y >> 1;
        int uv_base = H * W + uvy * W + x;
        nv12[uv_base]     = (unsigned char)fmaxf(0.0f, fminf(255.0f, U + 0.5f));
        nv12[uv_base + 1] = (unsigned char)fmaxf(0.0f, fminf(255.0f, V + 0.5f));
    }
}
"""

# Compile kernels once at module load
_KERNEL_NV12_TO_FP16 = cp.RawKernel(_nv12_to_fp16_nchw_src, "nv12_to_fp16_nchw_scaled")
_KERNEL_PHA_TO_NV12 = cp.RawKernel(_pha_to_nv12_src, "pha_to_nv12_grayscale")
_KERNEL_FGR_TO_NV12 = cp.RawKernel(_fgr_rgb_to_nv12_src, "fgr_rgb_fp16_to_nv12")


def _launch_2d(kernel, w: int, h: int, args: tuple) -> None:
    """2D grid launcher with 16×16 block (covers 256 threads/block, fine occupancy)."""
    block = (16, 16, 1)
    grid = ((w + 15) // 16, (h + 15) // 16, 1)
    kernel(grid, block, args)


# ---------------------------------------------------------------------------
# Video probe — keep ffprobe path; metadata only, cheap
# ---------------------------------------------------------------------------

def probe_video(input_path: str) -> dict:
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration,codec_name",
         "-show_entries", "format=duration",
         "-of", "csv=p=0", input_path],
        capture_output=True, text=True,
    )
    lines = probe.stdout.strip().split("\n")
    parts = lines[0].split(",")
    src_w, src_h = int(parts[0]), int(parts[1])
    fps_frac = parts[2].strip()
    fps_num, fps_den = map(int, fps_frac.split("/"))
    fps = fps_num / fps_den
    codec = parts[3].strip().lower()

    duration_s = 0.0
    for p in parts[4:]:
        try:
            duration_s = float(p)
            break
        except (ValueError, IndexError):
            pass
    if duration_s == 0.0 and len(lines) > 1:
        try:
            duration_s = float(lines[1].strip())
        except (ValueError, IndexError):
            pass

    return {
        "width": src_w, "height": src_h, "fps": fps,
        "fps_frac": fps_frac, "duration_s": duration_s, "codec": codec,
    }


def _codec_to_nvc(codec: str):
    """Map ffprobe codec_name → PyNvVideoCodec enum."""
    m = {
        "h264": nvc.cudaVideoCodec.H264,
        "hevc": nvc.cudaVideoCodec.HEVC,
        "h265": nvc.cudaVideoCodec.HEVC,
        "av1":  getattr(nvc.cudaVideoCodec, "AV1", None),
        "vp9":  getattr(nvc.cudaVideoCodec, "VP9", None),
    }
    c = m.get(codec)
    if c is None:
        raise RuntimeError(f"Unsupported codec for NVDEC: {codec!r}")
    return c


# ---------------------------------------------------------------------------
# Model loader — provider options tuned for video recurrent inference
# ---------------------------------------------------------------------------

def load_rvm_onnx(backbone: str) -> ort.InferenceSession:
    model_filename = f"rvm_{backbone}_fp16.onnx"
    model_path = os.path.join(RVM_MODELS_DIR, model_filename)
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    providers = [
        ("CUDAExecutionProvider", {
            "device_id": 0,
            # EXHAUSTIVE picks the fastest conv kernel per shape at warmup.
            # Torch's cudnn.benchmark=True is the equivalent in torchland.
            "cudnn_conv_algo_search": "EXHAUSTIVE",
            "do_copy_in_default_stream": True,
            # Recurrent state has fixed shapes once resolution is known — no arena thrash.
            "arena_extend_strategy": "kSameAsRequested",
            "cudnn_conv_use_max_workspace": "1",
        }),
        "CPUExecutionProvider",
    ]
    sess = ort.InferenceSession(model_path, sess_options=so, providers=providers)
    active = sess.get_providers()
    if "CUDAExecutionProvider" not in active:
        raise RuntimeError(f"CUDA provider not active; got {active}")
    print(f"Model loaded: {backbone} | providers={active} | {model_path}", flush=True)
    return sess


# ---------------------------------------------------------------------------
# MP4 muxer subprocess — takes H.264 Annex-B bitstream, writes mp4
# ---------------------------------------------------------------------------

def _spawn_mp4_mux(output_path: str, fps_str: str) -> subprocess.Popen:
    """Launch ffmpeg in copy-mode to wrap an H.264 Annex-B stream in MP4.
    Tiny CPU cost — no decode or re-encode. fps_str can be "30000/1001" etc."""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "h264",
        "-framerate", fps_str,
        "-i", "pipe:0",
        "-c:v", "copy",
        "-an",
        "-movflags", "+faststart",
        output_path,
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)


# ---------------------------------------------------------------------------
# GPU-resident bbox
# ---------------------------------------------------------------------------

def _compute_bbox_gpu(
    pha_buf: "cp.ndarray", out_w: int, out_h: int,
    frame_idx: int, erode_kernel: "cp.ndarray",
) -> dict | None:
    """Compute bbox from pha tensor entirely on GPU.
    pha_buf shape: (1, 1, H, W) fp16. Threshold > 0.5, erode 15×15, reduce."""
    mask_u8 = (pha_buf[0, 0] > cp.float16(0.5)).astype(cp.uint8)
    eroded = cpn.binary_erosion(mask_u8, structure=erode_kernel).astype(cp.uint8)

    # Reduce to 1-D coverage vectors, then pull indices to host
    rows_any = eroded.any(axis=1)
    cols_any = eroded.any(axis=0)
    # cp.any() returns a 0-d array; convert to Python bool for short-circuit
    if not bool(rows_any.any()) or not bool(cols_any.any()):
        return None

    r_idx = cp.where(rows_any)[0]
    c_idx = cp.where(cols_any)[0]
    rmin = int(r_idx[0]); rmax = int(r_idx[-1])
    cmin = int(c_idx[0]); cmax = int(c_idx[-1])

    pad_h = int(out_h * 0.05)
    pad_w = int(out_w * 0.05)
    rmin = max(0, rmin - pad_h)
    rmax = min(out_h - 1, rmax + pad_h)
    cmin = max(0, cmin - pad_w)
    cmax = min(out_w - 1, cmax + pad_w)

    return {
        "frame": frame_idx,
        "x": float(cmin / out_w),
        "y": float(rmin / out_h),
        "w": float((cmax - cmin + 1) / out_w),
        "h": float((rmax - rmin + 1) / out_h),
    }


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_video(
    input_path: str,
    output_path: str,
    backbone: str,
    scale: float,
    fps: int,
    downsample_ratio: float,
    matte_ranges: list | None = None,
) -> dict:
    """GPU-resident RVM matting. Public API matches segment_person_onnx.process_video."""

    info = probe_video(input_path)
    src_w, src_h = info["width"], info["height"]
    src_fps = info["fps"]
    src_fps_frac = info["fps_frac"]
    duration_s = info["duration_s"]
    codec = info["codec"]

    if fps == 0:
        effective_fps = src_fps
        effective_fps_str = src_fps_frac
    else:
        effective_fps = float(fps)
        effective_fps_str = str(fps)

    out_w = (int(src_w * scale) // 2) * 2
    out_h = (int(src_h * scale) // 2) * 2
    max_frames = int(duration_s * effective_fps)

    # Skip mask for matte_ranges (ms → frame indices)
    skip_mask = None
    if matte_ranges:
        skip_mask = np.ones(max_frames + 100, dtype=bool)  # True = skip
        for r in matte_ranges:
            f_start = int(r["startMs"] / 1000 * effective_fps)
            f_end = int(r["endMs"] / 1000 * effective_fps)
            skip_mask[f_start:f_end] = False
        print(f"Matte ranges: {len(matte_ranges)} ranges", flush=True)
    else:
        print("Matte ranges: none (processing all frames)", flush=True)

    print(f"Processing video: {src_w}x{src_h} @ {src_fps:.2f}fps ({src_fps_frac}), "
          f"codec={codec}, ~{max_frames} frames", flush=True)
    print(f"Output: {out_w}x{out_h} @ {effective_fps:.2f}fps, scale={scale}", flush=True)

    # ---- ORT session + warmup for rec-state shape discovery ----
    sess = load_rvm_onnx(backbone)

    dsr_host = np.array([downsample_ratio], dtype=np.float32)
    zero_r_host = np.zeros((1, 1, 1, 1), dtype=np.float16)
    warmup_src = np.zeros((1, 3, out_h, out_w), dtype=np.float16)
    warm_feeds = {
        "src": warmup_src,
        "r1i": zero_r_host, "r2i": zero_r_host,
        "r3i": zero_r_host, "r4i": zero_r_host,
        "downsample_ratio": dsr_host,
    }
    print("Warming up ORT (rec-state shape probe + cuDNN algo search)...", flush=True)
    t_warm = time.time()
    _fgr, _pha, r1o, r2o, r3o, r4o = sess.run(None, warm_feeds)
    print(f"Warmup done in {time.time()-t_warm:.1f}s; rec shapes: "
          f"r1={r1o.shape} r2={r2o.shape} r3={r3o.shape} r4={r4o.shape}", flush=True)
    rec_shapes = [r1o.shape, r2o.shape, r3o.shape, r4o.shape]

    # ---- Persistent CUDA buffers for IOBinding ----
    src_buf = cp.zeros((1, 3, out_h, out_w), dtype=cp.float16)
    pha_buf = cp.zeros((1, 1, out_h, out_w), dtype=cp.float16)
    fgr_buf = cp.zeros((1, 3, out_h, out_w), dtype=cp.float16)
    dsr_buf = cp.asarray(dsr_host)

    # Ping-pong rec state buffers: frame N reads from A, writes to B; N+1 swaps.
    rec_a = [cp.zeros(s, dtype=cp.float16) for s in rec_shapes]
    rec_b = [cp.zeros(s, dtype=cp.float16) for s in rec_shapes]

    # Output NV12 buffers (shared across frames, reused)
    matte_nv12 = cp.zeros((out_h * 3 // 2, out_w), dtype=cp.uint8)
    fgr_nv12 = cp.zeros((out_h * 3 // 2, out_w), dtype=cp.uint8)

    # Erode structure for bbox (15×15 ellipse approx via cross/rect; simple rect is fine)
    erode_kernel = cp.ones((15, 15), dtype=cp.uint8)

    # ---- IOBinding skeleton (rebind buffer_ptr each frame only if it changes) ----
    io = sess.io_binding()

    def _bind_inputs(src_ptr, rec_in):
        io.bind_input("src", "cuda", 0, np.float16, (1, 3, out_h, out_w), src_ptr)
        io.bind_input("r1i", "cuda", 0, np.float16, rec_shapes[0], rec_in[0].data.ptr)
        io.bind_input("r2i", "cuda", 0, np.float16, rec_shapes[1], rec_in[1].data.ptr)
        io.bind_input("r3i", "cuda", 0, np.float16, rec_shapes[2], rec_in[2].data.ptr)
        io.bind_input("r4i", "cuda", 0, np.float16, rec_shapes[3], rec_in[3].data.ptr)
        io.bind_input("downsample_ratio", "cuda", 0, np.float32, (1,), dsr_buf.data.ptr)

    def _bind_outputs(rec_out):
        io.bind_output("fgr", "cuda", 0, np.float16, (1, 3, out_h, out_w), fgr_buf.data.ptr)
        io.bind_output("pha", "cuda", 0, np.float16, (1, 1, out_h, out_w), pha_buf.data.ptr)
        io.bind_output("r1o", "cuda", 0, np.float16, rec_shapes[0], rec_out[0].data.ptr)
        io.bind_output("r2o", "cuda", 0, np.float16, rec_shapes[1], rec_out[1].data.ptr)
        io.bind_output("r3o", "cuda", 0, np.float16, rec_shapes[2], rec_out[2].data.ptr)
        io.bind_output("r4o", "cuda", 0, np.float16, rec_shapes[3], rec_out[3].data.ptr)

    # ---- NVDEC demuxer + decoder ----
    demuxer = nvc.CreateDemuxer(filename=input_path)
    dec = nvc.CreateDecoder(
        gpuid=0,
        codec=_codec_to_nvc(codec),
        cudacontext=0, cudastream=0,
        usedevicememory=True,
    )

    # ---- NVENC encoders (matte = grayscale, fgr = color), both NV12 input ----
    matte_enc = nvc.CreateEncoder(
        width=out_w, height=out_h, fmt="NV12",
        usecpuinputbuffer=False, codec="h264",
        preset="P1", tuning_info="low_latency",
        rc="constqp", constqp=24,
        gop=60, idrperiod=60, bf=0, repeatspspps=1,
    )
    fgr_enc = nvc.CreateEncoder(
        width=out_w, height=out_h, fmt="NV12",
        usecpuinputbuffer=False, codec="h264",
        preset="P1", tuning_info="low_latency",
        rc="constqp", constqp=21,
        gop=60, idrperiod=60, bf=0, repeatspspps=1,
    )

    # MP4 muxer subprocesses (Annex-B → MP4 via `-c:v copy`)
    fgr_output_path = str(Path(output_path).with_suffix("")) + "-fgr.mp4"
    matte_mux = _spawn_mp4_mux(output_path, effective_fps_str)
    fgr_mux = _spawn_mp4_mux(fgr_output_path, effective_fps_str)

    # Black NV12 frame for `should_skip` branches (pre-allocated)
    black_nv12 = cp.zeros((out_h * 3 // 2, out_w), dtype=cp.uint8)
    black_nv12[: out_h, :] = 0
    black_nv12[out_h:, :] = 128  # neutral chroma

    # ---- Main loop ----
    frame_idx = 0
    bbox_frames = []
    start_time = time.time()
    last_report = start_time

    def _swap(a, b):
        return b, a

    rec_in = rec_a
    rec_out = rec_b

    try:
        for packet in demuxer:
            for decoded in dec.Decode(packet):
                # decoded is a DecodedFrame exposing __cuda_array_interface__
                # Shape (src_h*3/2, src_w) uint8 NV12.
                nv12_src = cp.from_dlpack(decoded)  # zero-copy GPU view

                if skip_mask is not None and frame_idx < len(skip_mask) and skip_mask[frame_idx]:
                    # Emit black frame to both encoders; do NOT advance rec state
                    mb = matte_enc.Encode(black_nv12)
                    if mb:
                        matte_mux.stdin.write(bytes(mb))
                    fb = fgr_enc.Encode(black_nv12)
                    if fb:
                        fgr_mux.stdin.write(bytes(fb))
                    frame_idx += 1
                    continue

                # Preprocess (GPU): NV12 → fp16 NCHW, scaled to out_h×out_w
                _launch_2d(
                    _KERNEL_NV12_TO_FP16, out_w, out_h,
                    (nv12_src, src_buf, np.int32(src_w), np.int32(src_h),
                     np.int32(out_w), np.int32(out_h)),
                )

                # Bind + run. Rec state ping-pongs between rec_a/rec_b each frame.
                _bind_inputs(src_buf.data.ptr, rec_in)
                _bind_outputs(rec_out)
                sess.run_with_iobinding(io)

                # Postprocess: pha → matte NV12, fgr → fgr NV12 (both on GPU)
                _launch_2d(
                    _KERNEL_PHA_TO_NV12, out_w, out_h,
                    (pha_buf, matte_nv12, np.int32(out_w), np.int32(out_h)),
                )
                _launch_2d(
                    _KERNEL_FGR_TO_NV12, out_w, out_h,
                    (fgr_buf, fgr_nv12, np.int32(out_w), np.int32(out_h)),
                )

                # Encode via NVENC. Input is a CUDA buffer; output is Annex-B bytes.
                mb = matte_enc.Encode(matte_nv12)
                if mb:
                    matte_mux.stdin.write(bytes(mb))
                fb = fgr_enc.Encode(fgr_nv12)
                if fb:
                    fgr_mux.stdin.write(bytes(fb))

                # Bbox on GPU (overlaps with encode)
                bb = _compute_bbox_gpu(pha_buf, out_w, out_h, frame_idx, erode_kernel)
                if bb is not None:
                    bbox_frames.append(bb)

                # Swap rec ping-pong for next frame
                rec_in, rec_out = rec_out, rec_in

                frame_idx += 1
                now = time.time()
                if frame_idx % 100 == 0 and now - last_report >= 0.5:
                    elapsed = now - start_time
                    fps_now = frame_idx / elapsed
                    pct = frame_idx / max(1, max_frames) * 100
                    eta = (max_frames - frame_idx) / max(0.1, fps_now)
                    print(f"Processed {frame_idx}/{max_frames} frames ({pct:.0f}%) | "
                          f"{fps_now:.1f} fps | ETA {eta:.0f}s", flush=True)
                    last_report = now

        # Flush decoder (B-frame reordering)
        for decoded in dec.Decode(None) or []:
            # Same loop body as above, minus skip check since we don't know frame index offset here.
            # In practice for low-latency encode (bf=0 above) there should be no flush frames.
            nv12_src = cp.from_dlpack(decoded)
            _launch_2d(
                _KERNEL_NV12_TO_FP16, out_w, out_h,
                (nv12_src, src_buf, np.int32(src_w), np.int32(src_h),
                 np.int32(out_w), np.int32(out_h)),
            )
            _bind_inputs(src_buf.data.ptr, rec_in)
            _bind_outputs(rec_out)
            sess.run_with_iobinding(io)
            _launch_2d(_KERNEL_PHA_TO_NV12, out_w, out_h,
                       (pha_buf, matte_nv12, np.int32(out_w), np.int32(out_h)))
            _launch_2d(_KERNEL_FGR_TO_NV12, out_w, out_h,
                       (fgr_buf, fgr_nv12, np.int32(out_w), np.int32(out_h)))
            mb = matte_enc.Encode(matte_nv12)
            if mb:
                matte_mux.stdin.write(bytes(mb))
            fb = fgr_enc.Encode(fgr_nv12)
            if fb:
                fgr_mux.stdin.write(bytes(fb))
            bb = _compute_bbox_gpu(pha_buf, out_w, out_h, frame_idx, erode_kernel)
            if bb is not None:
                bbox_frames.append(bb)
            rec_in, rec_out = rec_out, rec_in
            frame_idx += 1

    finally:
        # Flush NVENC
        try:
            tail = matte_enc.EndEncode()
            if tail:
                matte_mux.stdin.write(bytes(tail))
        except Exception as e:
            print(f"matte EndEncode failed: {e}", file=sys.stderr)
        try:
            tail = fgr_enc.EndEncode()
            if tail:
                fgr_mux.stdin.write(bytes(tail))
        except Exception as e:
            print(f"fgr EndEncode failed: {e}", file=sys.stderr)

        # Close muxers
        for name, mux in [("matte", matte_mux), ("fgr", fgr_mux)]:
            try:
                mux.stdin.close()
            except Exception:
                pass
            try:
                rc = mux.wait(timeout=30)
                if rc != 0:
                    err = mux.stderr.read().decode("utf-8", errors="replace")
                    print(f"{name} muxer exit={rc}: {err[-600:]}", file=sys.stderr)
            except Exception as e:
                print(f"{name} muxer wait failed: {e}", file=sys.stderr)

    elapsed = time.time() - start_time
    final_fps = frame_idx / max(0.001, elapsed)
    print(f"Done! Processed {frame_idx} frames in {elapsed:.1f}s ({final_fps:.1f} fps)", flush=True)
    print(f"Foreground video saved: {fgr_output_path}", flush=True)

    # Aggregate bbox stats for downstream
    if bbox_frames:
        avg_y = sum(f["y"] for f in bbox_frames) / len(bbox_frames)
        avg_h = sum(f["h"] for f in bbox_frames) / len(bbox_frames)
        avg_x = sum(f["x"] for f in bbox_frames) / len(bbox_frames)
        avg_w = sum(f["w"] for f in bbox_frames) / len(bbox_frames)
        aggregate = {
            "avgBbox": {"x": avg_x, "y": avg_y, "w": avg_w, "h": avg_h},
            "bodyCenter": {"x": avg_x + avg_w / 2, "y": avg_y + avg_h / 2},
            "faceEstimate": {"y": avg_y + avg_h * 0.15, "centerY": avg_y + avg_h * 0.25},
        }
    else:
        aggregate = None

    bbox_data = {"fps": effective_fps, "frames": bbox_frames, "aggregate": aggregate}
    bbox_path = str(Path(output_path).parent / "matte-bbox.json")
    with open(bbox_path, "w") as f:
        json.dump(bbox_data, f)
    print(f"Bounding boxes saved: {bbox_path} ({len(bbox_frames)} frames)", flush=True)

    return {
        "framesProcessed": frame_idx,
        "framesWritten": frame_idx,
        "outputWidth": out_w,
        "outputHeight": out_h,
        "outputFps": effective_fps,
        "bboxPath": bbox_path,
        "fgrPath": fgr_output_path,
    }


# ---------------------------------------------------------------------------
# CLI — parity with segment_person_onnx.py so tests & local dev work unchanged
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="RVM segmentation (GPU-resident).")
    p.add_argument("input", type=str)
    p.add_argument("--output", type=str, required=True)
    p.add_argument("--backbone", type=str, default=BACKBONE, choices=["resnet50", "mobilenetv3"])
    p.add_argument("--scale", type=float, default=SCALE_FACTOR)
    p.add_argument("--fps", type=int, default=MATTE_FPS)
    p.add_argument("--downsample-ratio", type=float, default=DOWNSAMPLE_RATIO)
    p.add_argument("--matte-ranges", type=str, default="")
    return p.parse_args()


def main():
    args = _parse_args()
    matte_ranges = json.loads(args.matte_ranges) if args.matte_ranges else None
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        sys.exit(2)

    result = process_video(
        str(input_path), args.output,
        backbone=args.backbone, scale=args.scale, fps=args.fps,
        downsample_ratio=args.downsample_ratio, matte_ranges=matte_ranges,
    )
    print(f"Matte saved: {args.output}")
    print(f"Bbox saved: {result['bboxPath']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
