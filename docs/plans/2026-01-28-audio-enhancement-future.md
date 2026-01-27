# Audio Enhancement Pipeline — Future Improvements

## Current Pipeline (v2, Jan 28 2026)

```
Input WAV (48kHz)
  → DC offset removal + peak normalize
  → Demucs htdemucs (speech separation — isolates vocals)
  → DeepFilterNet3 (residual stationary noise removal, atten_lim=12dB)
  → Resemble Enhance CFM (generative spectral restoration + bandwidth extension)
  → FFmpeg EQ (highpass 80Hz, lowpass 14kHz, de-esser 6kHz -1.5dB)
  → FFmpeg compression (2:1, threshold 0.25, attack 20ms, release 100ms)
  → FFmpeg limiter (0.79 / -2dBTP)
  → pyloudnorm LUFS normalization (-14 LUFS, true peak clamp -2dBTP)
  → Output WAV
```

## Future Improvement 1: Multiband Compression

Replace single-band `acompressor` with multiband compression to control
bass, mids, and highs independently. This prevents bass rumble from
ducking the voice and lets sibilance be tamed without dulling the overall
sound.

**Bands:**
- Low (80-300 Hz): 3:1 ratio, aggressive — control plosives and rumble
- Mid (300-4000 Hz): 1.5:1 ratio, gentle — preserve natural voice dynamics
- High (4000-14000 Hz): 2:1 ratio, moderate — tame sibilance

**Implementation:** FFmpeg doesn't support multiband natively. Options:
- Use `crossfeed` + parallel `acompressor` filter chains in FFmpeg
- Switch to SoX which has multiband support
- Use `pydub` or `scipy` for programmatic multiband processing

## Future Improvement 2: Replace DeepFilterNet with ClearerVoice FRCRN

ClearerVoice-Studio (Alibaba/ModelScope) provides FRCRN, which won
the ICASSP 2022 DNS Challenge. Handles both denoising AND dereverberation
(room echo removal) — DeepFilterNet is weak at dereverberation.

**Install:** `pip install clearvoice`
**Usage:** `from clearvoice import ClearVoice; cv = ClearVoice(task='speech_enhancement', model_names=['FRCRN_SE_16K'])`

The 48kHz variant `MossFormer2_SE_48K` would be ideal.

**Trade-off:** Heavier model, slower inference, but handles more distortion
types in a single pass. Could potentially replace both DeepFilterNet AND
the dereverberation that Demucs partially handles.

## Future Improvement 3: GPU Acceleration

Current pipeline runs on CPU (torch 2.8.0+cpu). Install CUDA-enabled
PyTorch for 10-50x speedup on Demucs and Resemble Enhance:

```
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Resemble Enhance's CFM solver (32 NFE steps) is the main bottleneck
on CPU (~133s for a short clip). On GPU this drops to ~5-10s.

## Future Improvement 4: Reduce Resemble Enhance NFE Steps

Current: `nfe=32` (32 ODE solver steps). Could reduce to `nfe=16` or
`nfe=8` for faster inference with minimal quality loss. The `midpoint`
solver is already efficient. For even faster inference, consider
FlashSR (distilled single-step diffusion, 500KB ONNX, Apache-2.0).

## Research References

- Resemble Enhance: https://github.com/resemble-ai/resemble-enhance
- ClearerVoice-Studio: https://github.com/modelscope/ClearerVoice-Studio
- FlashSR: https://github.com/ysharma3501/FlashSR
- AudioSR: https://github.com/haoheliu/versatile_audio_super_resolution
- MP-SENet (joint denoise+dereverb+BWE): https://github.com/yxlu-0102/MP-SENet
- URGENT 2025 Challenge: https://arxiv.org/html/2505.23212v2
