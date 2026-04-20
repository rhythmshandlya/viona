"""
RunPod Serverless handler for RVM (Robust Video Matting) — ONNX Runtime variant.

Parallel implementation of handler.py that uses onnxruntime-gpu instead of
PyTorch. The public I/O contract is identical to handler.py.

Contract (shared across all capabilities in this stack):

Input JSON:
  {
    "inputs":  { "video": "<presigned GET URL>" },
    "outputs": {
      "matte":      "<presigned PUT URL>",
      "fgr":        "<presigned PUT URL>",
      "bbox":       "<presigned PUT URL>",
      "proxyMatte": "<presigned PUT URL>",   // optional
      "proxyFgr":   "<presigned PUT URL>"    // optional
    },
    "params": {
      "backbone":         "resnet50" | "mobilenetv3",
      "scale":            0.5,
      "fps":              0,
      "downsampleRatio":  0.25,
      "ranges":           [{ "startMs": 0, "endMs": 120000 }, ...]   // optional
    }
  }

Returns:
  {
    "artifacts": {
      "matte":      { "uploaded": true },
      "fgr":        { "uploaded": true },
      "bbox":       { "uploaded": true },
      "proxyMatte": { "uploaded": true },
      "proxyFgr":   { "uploaded": true }
    },
    "metrics": {
      "durationMs":      1234,
      "framesProcessed": 3600,
      "outputWidth":     540,
      "outputHeight":    960,
      "outputFps":       30
    }
  }
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests
import runpod

# ---- GPU utilization tuning ----
# ORT handles its own kernel cache (no equivalent of cudnn.benchmark /
# torch.compile), so the torch-variant's ladder is reduced to SEQ_CHUNK sizing
# only. SEQ_CHUNK in the ONNX path is a decode/encode pipeline buffer size,
# not a model-time batch (the RVM ONNX export lacks a time axis and is called
# per-frame so the recurrent state is maintained correctly).

_cuda_available = False
try:
    import onnxruntime as _ort
    _cuda_available = 'CUDAExecutionProvider' in _ort.get_available_providers()
except Exception:
    _cuda_available = False

_vram_gb = 0
if _cuda_available:
    # Try to read VRAM via pynvml if present, otherwise via nvidia-smi, else 0.
    try:
        import pynvml  # type: ignore
        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        _vram_gb = pynvml.nvmlDeviceGetMemoryInfo(h).total / (1024 ** 3)
    except Exception:
        try:
            out = subprocess.check_output(
                ['nvidia-smi', '--query-gpu=memory.total', '--format=csv,noheader,nounits'],
                timeout=5, text=True,
            ).strip().splitlines()
            if out:
                _vram_gb = int(out[0]) / 1024
        except Exception:
            _vram_gb = 0

    # Bigger read/write buffers keep both decoder and encoder pipes busier.
    if _vram_gb >= 70:         # H100 80GB, A100 80GB, H200
        os.environ.setdefault('RVM_SEQ_CHUNK', '48')
    elif _vram_gb >= 40:       # L40S, A40, A6000 (48GB)
        os.environ.setdefault('RVM_SEQ_CHUNK', '32')
    elif _vram_gb >= 28:       # RTX 5090 (32GB), RTX PRO 4500 (32GB)
        os.environ.setdefault('RVM_SEQ_CHUNK', '20')
    elif _vram_gb >= 20:       # RTX 4090/3090/A5000/L4/A4500 (20-24GB)
        os.environ.setdefault('RVM_SEQ_CHUNK', '12')
    elif _vram_gb >= 14:       # RTX 2000 Ada, T4 (16GB)
        os.environ.setdefault('RVM_SEQ_CHUNK', '6')
    else:
        os.environ.setdefault('RVM_SEQ_CHUNK', '4')

# Let CPU cores drive the ffmpeg-fed numpy ops between inference calls.
try:
    _cpu_cores = os.cpu_count() or 4
    os.environ.setdefault('OMP_NUM_THREADS', str(_cpu_cores))
    os.environ.setdefault('MKL_NUM_THREADS', str(_cpu_cores))
except Exception:
    pass

# Make segment_person_onnx importable.
# In the Docker image the file is COPY'd as /app/segment_person.py (the `_onnx`
# suffix is dropped at COPY time), so try both import names for local-dev and
# container-runtime compatibility.
sys.path.insert(0, '/app')

# Backend selection: RVM_GPU_PIPELINE=1 → GPU-resident (NVDEC + CuPy kernels
# + ORT IOBinding + NVENC), 0 → legacy ffmpeg rgb24 pipe + numpy CPU pipeline.
# Default 1 in production; flip to 0 to roll back without a redeploy.
_USE_GPU_PIPELINE = os.environ.get("RVM_GPU_PIPELINE", "1") == "1"

if _USE_GPU_PIPELINE:
    try:
        from segment_person_gpu import process_video
        print("Using GPU-resident pipeline (segment_person_gpu)", flush=True)
    except ImportError as e:
        print(f"RVM_GPU_PIPELINE=1 but import failed: {e}; falling back to legacy", flush=True)
        _USE_GPU_PIPELINE = False

if not _USE_GPU_PIPELINE:
    try:
        from segment_person_onnx import process_video  # dev/local
    except ImportError:
        from segment_person import process_video  # in-container (renamed by Dockerfile)


def _download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open('wb') as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)


def _upload(url: str, src: Path, content_type: str = 'application/octet-stream') -> None:
    with src.open('rb') as f:
        r = requests.put(url, data=f, headers={'Content-Type': content_type}, timeout=600)
    r.raise_for_status()


def _make_proxy(input_path: Path, output_path: Path) -> None:
    """Low-res 480p proxy for editor preview."""
    subprocess.run(
        [
            'ffmpeg', '-y', '-i', str(input_path),
            '-vf', 'scale=-2:480',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
            '-an',
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )


def handler(job):
    t0 = time.time()
    inp = job['input']
    inputs = inp['inputs']
    outputs = inp['outputs']
    params = inp.get('params', {})

    work = Path('/tmp/rvm-work')
    work.mkdir(parents=True, exist_ok=True)
    video_path = work / 'source.mp4'
    matte_path = work / 'matte.mp4'

    # 1. Download input
    _download(inputs['video'], video_path)

    # 2. Run RVM (reuses segment_person_onnx.py)
    result = process_video(
        str(video_path),
        str(matte_path),
        backbone=params.get('backbone', 'resnet50'),
        scale=params.get('scale', 0.5),
        fps=params.get('fps', 0),
        downsample_ratio=params.get('downsampleRatio', 0.25),
        matte_ranges=params.get('ranges', []),
    )

    fgr_path = Path(result['fgrPath'])
    bbox_path = Path(result['bboxPath'])

    artifacts = {}

    # 3. Upload primary outputs
    for name, path, ctype in [
        ('matte', matte_path, 'video/mp4'),
        ('fgr', fgr_path, 'video/mp4'),
        ('bbox', bbox_path, 'application/json'),
    ]:
        if name in outputs:
            _upload(outputs[name], path, ctype)
            artifacts[name] = {'uploaded': True}

    # 4. Optional: generate and upload proxies
    if 'proxyMatte' in outputs:
        proxy_matte = work / 'matte-proxy.mp4'
        _make_proxy(matte_path, proxy_matte)
        _upload(outputs['proxyMatte'], proxy_matte, 'video/mp4')
        artifacts['proxyMatte'] = {'uploaded': True}

    if 'proxyFgr' in outputs:
        proxy_fgr = work / 'fgr-proxy.mp4'
        _make_proxy(fgr_path, proxy_fgr)
        _upload(outputs['proxyFgr'], proxy_fgr, 'video/mp4')
        artifacts['proxyFgr'] = {'uploaded': True}

    return {
        'artifacts': artifacts,
        'metrics': {
            'durationMs': int((time.time() - t0) * 1000),
            'framesProcessed': result['framesProcessed'],
            'outputWidth': result['outputWidth'],
            'outputHeight': result['outputHeight'],
            'outputFps': result['outputFps'],
        },
    }


def _warmup():
    """Run a tiny dummy forward pass on an ORT session so CUDA context +
    provider kernels are hot when the first real job arrives. Called once at
    module load, best-effort.

    Unlike the torch variant there's no JIT/torch.compile to warm — just the
    CUDA context + ORT's internal kernel selection."""
    if not _cuda_available:
        return
    try:
        import numpy as _np
        try:
            from segment_person_onnx import load_rvm_onnx
        except ImportError:
            from segment_person import load_rvm_onnx  # in-container (renamed)

        sess = load_rvm_onnx('resnet50', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
        # (B=1, C=3, H=180, W=320) — small shape, real kernels. fp16 matches
        # the ONNX export dtype so no implicit cast.
        src = _np.zeros((1, 3, 180, 320), dtype=_np.float16)
        rec = [_np.zeros((1, 1, 1, 1), dtype=_np.float16) for _ in range(4)]
        dsr = _np.array([0.8], dtype=_np.float32)
        feeds = {
            'src': src,
            'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3],
            'downsample_ratio': dsr,
        }
        # Two passes — first builds the graph, second exercises the cache.
        sess.run(None, feeds)
        sess.run(None, feeds)
        print('RVM ONNX warmup complete', flush=True)
    except Exception as e:
        print(f'RVM ONNX warmup failed (non-fatal): {e}', flush=True)


_warmup()


if __name__ == '__main__':
    # Allow local testing: `python handler_onnx.py --test-input path/to/input.json`
    if '--test-input' in sys.argv:
        idx = sys.argv.index('--test-input')
        with open(sys.argv[idx + 1]) as f:
            test_job = {'id': 'local-test', 'input': json.load(f)}
        print(json.dumps(handler(test_job), indent=2))
    else:
        runpod.serverless.start({'handler': handler})
