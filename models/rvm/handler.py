"""
RunPod Serverless handler for RVM (Robust Video Matting).

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
      "downsampleRatio":  0.8,
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

# ---- GPU/CPU utilization tuning ----
# These env vars are read by segment_person.py (see Step 3 to expose them there).

_cuda_available = False
try:
    import torch as _torch
    _cuda_available = _torch.cuda.is_available()
except Exception:
    _cuda_available = False

if _cuda_available:
    try:
        _vram_gb = _torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    except Exception:
        _vram_gb = 0

    # Bigger batches = better GPU utilisation for the recurrent RVM model.
    # Defaults are conservative; override to saturate high-VRAM GPUs.
    if _vram_gb >= 40:         # L40S (48GB), A40 (48GB), A100-80
        os.environ.setdefault('RVM_SEQ_CHUNK', '16')
    elif _vram_gb >= 20:       # RTX A5000 (24GB), RTX 4090 (24GB)
        os.environ.setdefault('RVM_SEQ_CHUNK', '8')
    else:
        os.environ.setdefault('RVM_SEQ_CHUNK', '4')

    # torch.compile speedup on Ampere+ (compute capability >= 8.0).
    try:
        _major, _ = _torch.cuda.get_device_capability(0)
        if _major >= 8:
            os.environ.setdefault('RVM_COMPILE', '1')
    except Exception:
        pass

# Let PyTorch use all CPU cores for the ffmpeg-fed tensor ops between inference batches.
# Defaults to core count; no harm setting it explicitly here.
try:
    _cpu_cores = os.cpu_count() or 4
    os.environ.setdefault('OMP_NUM_THREADS', str(_cpu_cores))
    os.environ.setdefault('MKL_NUM_THREADS', str(_cpu_cores))
except Exception:
    pass

# Make segment_person importable
sys.path.insert(0, '/app')
from segment_person import process_video  # noqa: E402


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

    # 2. Run RVM (reuses existing segment_person.py)
    result = process_video(
        str(video_path),
        str(matte_path),
        backbone=params.get('backbone', 'resnet50'),
        scale=params.get('scale', 0.5),
        fps=params.get('fps', 0),
        downsample_ratio=params.get('downsampleRatio', 0.8),
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
    """Run a tiny dummy inference so the JIT / torch.compile paths are hot when
    the first real job arrives. Called once at module load, best-effort."""
    if not _cuda_available:
        return
    try:
        import numpy as np
        import tempfile
        import cv2  # from opencv-python-headless in requirements
        work = Path(tempfile.mkdtemp(prefix='rvm-warmup-'))
        dummy = work / 'dummy.mp4'
        # 1 second, 30fps, 320x180 black frames
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        vw = cv2.VideoWriter(str(dummy), fourcc, 30, (320, 180))
        for _ in range(30):
            vw.write(np.zeros((180, 320, 3), dtype=np.uint8))
        vw.release()
        process_video(
            str(dummy), str(work / 'matte.mp4'),
            backbone='resnet50', scale=0.5, fps=0, downsample_ratio=0.8,
            matte_ranges=[],
        )
        print('RVM warmup complete', flush=True)
    except Exception as e:
        print(f'RVM warmup failed (non-fatal): {e}', flush=True)

_warmup()


if __name__ == '__main__':
    # Allow local testing: `python handler.py --test-input path/to/input.json`
    if '--test-input' in sys.argv:
        idx = sys.argv.index('--test-input')
        with open(sys.argv[idx + 1]) as f:
            test_job = {'id': 'local-test', 'input': json.load(f)}
        print(json.dumps(handler(test_job), indent=2))
    else:
        runpod.serverless.start({'handler': handler})
