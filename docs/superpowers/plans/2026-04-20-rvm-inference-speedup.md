# RVM Inference Speedup — Research + Plan

> **For agentic workers:** Execute phase-by-phase. Each phase has verification steps with concrete FPS thresholds. Commit after each phase. Skip phases whose predecessor already hit the target.

**Current baseline (verified 2026-04-20):** 3.19 FPS on RunPod A4000 (primary) — ADA_24/4090 is fallback only when A4000 pool is empty, not a perf target. ResNet50 fp16 ONNX, 998 frames of 1080×1920 (4K source downscaled via scale=0.5).

**Target:** ≥30 FPS on A4000 (everything sized to this GPU — we stay on AMPERE_16 to keep per-second cost at ~$0.17/hr). Reference points: RVM paper reports ~71 FPS ResNet50 1080p FP32 on 1080Ti; extrapolated A4000 FP16 ceiling ~60-80 FPS.

**Bottleneck attribution (4 parallel research streams, 2026-04-20):**

| Cause | Impact | Fix |
|---|---|---|
| `downsample_ratio=0.8` vs paper's 0.25 | 3-6× slower | Change default. FREE. |
| No `ort.IOBinding`; recurrent state r1..r4 ping-pongs CPU↔GPU every frame | 5-10× slower | Rewrite inference loop. ~80 LoC. |
| Memcpy node in graph (scalar `downsample_ratio` on CPU) breaks CUDA Graphs | 1.2-1.5× lost | Pass scalar as CUDA OrtValue. |
| Not using `prefer_nhwc=True` on Ampere/Ada | 1.1-1.2× lost | Provider option. |
| Per-frame CPU preprocess (uint8→f32→/255→transpose→f16) | 1.5-2× lost | Fuse into graph or GPU kernel. |
| `sess.run()` with numpy vs `run_with_iobinding()` | Inclusive of IOBinding fix | — |
| CPU H.264 decode + rgb24 pipe (libx264 ~80 FPS cap) | 2-4× lost when inference fast | PyNvVideoCodec zero-copy. |
| Not using TensorRT EP | 1.5-2× lost | TRT provider + engine cache. |
| ResNet50 vs MobileNetV3 | 1.47× faster with MNet3 | Optional — marginal quality loss. |

Research output stored in agent reports (2026-04-20 session).

---

## File structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `models/rvm/segment_person_onnx.py` | Phase 1-3 core rewrite |
| Modify | `models/rvm/handler_onnx.py` | Pass new params through, default values |
| Modify | `models/rvm/Dockerfile.onnx.slim` | Phase 3: pin `tensorrt==10.3`, Phase 4: add PyNvVideoCodec |
| Modify | `packages/api/src/inference/capabilities/segment-speaker.ts` (or similar) | Update default `downsampleRatio` sent to RunPod |
| Modify | `scripts/temp/test-runpod-against-railway-bucket.ts` | Benchmark harness updates |
| Add | `scripts/temp/rvm-export-opset17.py` | One-time re-export for TRT compatibility (Phase 3) |

---

## Execution order

```
Phase 1 (free, config only)       →  verify ≥15 FPS on A4000
Phase 2 (IOBinding rewrite)       →  verify ≥30 FPS on A4000
Phase 3 (ORT tuning + NHWC)       →  verify ≥40 FPS on A4000
Phase 4 (TensorRT EP)             →  verify ≥60 FPS on A4000
Phase 5 (zero-copy I/O)           →  verify ≥80 FPS end-to-end
Phase 6 (max GPU util: concurrency + streams)  →  verify ≥75% gpu_avg single-job, ≥90% 3-concurrent
Phase 7 (fallback: MNet3)         →  only if ResNet50 quality isn't needed
```

**Stop at the first phase that meets your throughput target.** Each phase is independently shippable.

---

## Phase 1 — Fix `downsample_ratio` (30 min, biggest single win)

### Why
RVM's paper and README: "we recommend downsample_ratio=0.25 for 1080p, 0.125 for 4K." The encoder-decoder runs at `downsample_ratio × input_size`; Deep Guided Filter handles the upsample. Our current `0.8` means the encoder runs at 864×1536 instead of 270×480 — **10.2× more pixels** through the expensive ResNet50 encoder.

### Files
- Modify: `models/rvm/segment_person_onnx.py` line 46
- Modify: `models/rvm/segment_person.py` (torch variant — keep parity)
- Modify: API-side default that populates `params.downsampleRatio` in the RunPod submission
- Modify: `scripts/temp/test-runpod-against-railway-bucket.ts` line 77 (`downsampleRatio: 0.8` → `0.25`)

### Steps

- [ ] **Step 1** — Flip the defaults.
  ```python
  # segment_person_onnx.py line 46
  DOWNSAMPLE_RATIO = 0.25   # was 0.8 — paper's prescribed value for 1080p
  ```
  Same in `segment_person.py`. Search for any hardcoded `0.8` in `packages/api/src/inference/capabilities/`; replace with `0.25`.

- [ ] **Step 2** — Rebuild + push slim image with the fix.
  ```bash
  docker buildx build -f models/rvm/Dockerfile.onnx.slim \
    --platform linux/amd64 \
    --output type=image,compression=zstd,compression-level=8,push=true \
    -t ghcr.io/rhythmshandlya/viona-rvm:slim models/rvm
  ```

- [ ] **Step 3** — Pin template to the new digest (reuse Task 2 Step 1 of `2026-04-20-rvm-cold-start-optimization.md`).

- [ ] **Step 4** — Re-run benchmark.
  ```bash
  set -a; source .env; set +a
  pnpm tsx scripts/temp/test-runpod-against-railway-bucket.ts /c/tmp/test-video.mp4
  ```

- [ ] **Step 5** — Commit.
  ```bash
  git commit -m "fix(rvm): downsample_ratio 0.8 → 0.25 (paper default for 1080p)"
  ```

### Verification
- Inference FPS ≥ 15 FPS on A4000 (was 3.19). **If it's still under 10 FPS, the ratio isn't the dominant issue and you must proceed to Phase 2.**
- Output matte visual quality: identical on mid-body, slightly softer on hair/fine edges (expected — that's ResNet50's edge advantage only manifesting on finer internal resolution). Acceptable for speaker compositing.

### Rollback
- Revert commit. Model + image unchanged.

---

## Phase 2 — IOBinding with GPU-resident recurrent state (2-3 hours, 5-10× speedup)

### Why
Every `sess.run()` in the current loop passes `src` as a numpy array and receives `r1o..r4o` as numpy arrays. The 4 recurrent tensors (each tens of MB at 1080p) cross the PCIe bus **twice per frame**. With IOBinding + OrtValues allocated on CUDA, recurrent state stays GPU-resident across frame boundaries.

### Files
- Modify: `models/rvm/segment_person_onnx.py` (replace `process_video` loop)

### Design

**Ping-pong OrtValues** — allocate TWO sets of recurrent state buffers on CUDA, alternate them each frame. Critical for CUDA Graphs in Phase 3: the *same buffer addresses* must be re-bound every call, not swapped.

```python
# One-time setup
io = sess.io_binding()
r_shapes = probe_rec_shapes(sess, out_h, out_w, ratio=0.25)  # see sub-step
rec_a = {n: ort.OrtValue.ortvalue_from_numpy(
            np.zeros(r_shapes[n], dtype=np.float16), 'cuda', 0)
         for n in ('r1','r2','r3','r4')}
rec_b = {n: ort.OrtValue.ortvalue_from_numpy(
            np.zeros(r_shapes[n], dtype=np.float16), 'cuda', 0)
         for n in ('r1','r2','r3','r4')}

# Scalar on CUDA — prevents the Memcpy warning we saw
dsr_ov = ort.OrtValue.ortvalue_from_numpy(
    np.array(0.25, dtype=np.float32), 'cuda', 0)

# Per-frame (frame already on GPU — see Phase 5 for zero-copy, fallback: upload via OrtValue)
for t in range(total_frames):
    src_ov = ort.OrtValue.ortvalue_from_numpy(frame_fp16_nchw, 'cuda', 0)
    io.bind_ortvalue_input('src', src_ov)
    io.bind_ortvalue_input('downsample_ratio', dsr_ov)

    (r_in, r_out) = (rec_a, rec_b) if t % 2 == 0 else (rec_b, rec_a)
    for i in range(1, 5):
        io.bind_ortvalue_input(f'r{i}i', r_in[f'r{i}'])
        io.bind_ortvalue_output(f'r{i}o', r_out[f'r{i}'])

    io.bind_output('fgr', 'cuda', 0, np.float16)
    io.bind_output('pha', 'cuda', 0, np.float16)

    sess.run_with_iobinding(io)
    # No CPU copy; r_out is now valid for next iteration
```

`probe_rec_shapes`: RVM's recurrent shapes are determined at first inference. Run one dummy forward with `zeros((1,1,1,1))` rec state, read output shapes from `io.get_outputs()`, allocate real buffers. Same-input-resolution assumption is safe per video.

### Steps

- [ ] **Step 1** — Extract an `OrtRvmEngine` class in `segment_person_onnx.py` that encapsulates session + bindings + ping-pong state. Keep the existing `process_video()` signature; replace its inner loop.

- [ ] **Step 2** — Resolve recurrent shapes dynamically on first call. Don't hard-code — shapes depend on `downsample_ratio` and input resolution.

- [ ] **Step 3** — Keep `fgr`/`pha` outputs on GPU. Only download the minimum per-frame: the `pha` tensor for bbox computation (via CuPy or torch, or copy just the final uint8 matte back). Skip CPU copy of `fgr` until encode — see Phase 5.

- [ ] **Step 4** — Preserve `--matte-ranges` skip semantics. Skipped frames: don't call `sess.run_with_iobinding`, don't advance rec state (matches torch variant).

- [ ] **Step 5** — Local smoke.
  ```bash
  docker build -f models/rvm/Dockerfile.onnx.slim -t viona-rvm-local models/rvm
  docker run --rm --gpus all -v /c/tmp:/tmp viona-rvm-local \
    python /app/handler.py --test-input /tmp/rvm-input.json
  ```

- [ ] **Step 6** — Rebuild slim image + push + RunPod re-benchmark.

- [ ] **Step 7** — Commit.

### Verification
- RunPod inference FPS ≥ 30 on A4000.
- Matte output frame-identical to Phase 1 (IOBinding is a pure perf change — sanity-check via `ffmpeg -i old.mp4 -i new.mp4 -lavfi psnr -f null -` on 100 sampled frames; expect ≥ 40 dB PSNR).
- No `Memcpy nodes are added` warning at session init (once `downsample_ratio` is on CUDA).

### Rollback
- Revert commit. Keep Phase 1's config fix.

### Reference
- ORT IOBinding docs: https://onnxruntime.ai/docs/performance/tune-performance/iobinding.html
- ORT device tensors: https://onnxruntime.ai/docs/performance/device-tensor.html
- RVM ONNX inference guide: https://github.com/PeterL1n/RobustVideoMatting/blob/master/documentation/inference.md#onnx

---

## Phase 3 — ORT provider tuning + CUDA Graphs (1 hour, 1.3-1.5× on top of Phase 2)

### Why
With Memcpy nodes eliminated (Phase 2 fixes the scalar), CUDA Graphs become viable. `prefer_nhwc=True` matches cuDNN's native layout on Ampere+/Ada — avoids internal transposes. `cudnn_conv_algo_search=EXHAUSTIVE` finds the fastest conv kernel for RVM's specific tensor shapes.

### Files
- Modify: `models/rvm/segment_person_onnx.py` (provider setup)

### Steps

- [ ] **Step 1** — Update provider list.
  ```python
  providers = [
      ("CUDAExecutionProvider", {
          "device_id": 0,
          "enable_cuda_graph": True,          # requires static shapes + no Memcpy
          "cudnn_conv_algo_search": "EXHAUSTIVE",
          "prefer_nhwc": True,                # Ampere+/Ada fp16 win
          "do_copy_in_default_stream": True,  # default — kept for clarity
      }),
      "CPUExecutionProvider",
  ]
  ```

- [ ] **Step 2** — CUDA Graphs capture on first inference. Verify with:
  ```python
  # First frame will be slow (graph capture); subsequent frames use replay.
  # Monitor: if FPS measured over last 10% of video is >> FPS over first 10%, graph replay is working.
  ```

- [ ] **Step 3** — Save optimized graph to inspect any remaining Memcpy nodes.
  ```python
  so = ort.SessionOptions()
  so.optimized_model_filepath = "/tmp/rvm_opt.onnx"
  so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
  # Open in Netron — confirm no Memcpy operators remain.
  ```

- [ ] **Step 4** — Benchmark + commit.

### Verification
- RunPod inference FPS ≥ 40 on A4000.
- First-frame latency measurably higher than steady-state (graph capture).
- `netron /tmp/rvm_opt.onnx` shows no `Memcpy` operators.

### Known gotchas
- CUDA Graphs require **stable input buffer addresses**. Don't reallocate `src_ov` per frame — reuse one pre-allocated buffer and copy into it (via `OrtValue.update_inplace(numpy_array)` in ORT 1.16+, or `copyfrom` method). The ping-pong rec state from Phase 2 is the exception: ORT handles the alternation internally once bound.
- If graph capture fails silently, set `ORT_LOGGING_LEVEL=0` — check for "Cannot use CUDA graph" warnings.

---

## Phase 4 — TensorRT EP with engine cache (3-5 hours, 1.5-2× on top of Phase 3)

### Why
TensorRT's kernel fusion + its own convolution library typically gives 1.5-2× over ORT-CUDA on ResNet-class models. TRT's GridSample support in 8.5+ handles RVM's Deep Guided Filter upsampler. Zero code changes to the inference loop — just swap the provider list.

### Files
- Modify: `models/rvm/Dockerfile.onnx.slim` (add libnvinfer + tensorrt pip)
- Add: `scripts/temp/rvm-export-opset17.py` (re-export from torch checkpoint)
- Modify: `models/rvm/segment_person_onnx.py` (provider list + engine cache path)
- Modify: `railway.toml` or RunPod template config — attach persistent network volume for engine cache

### Steps

- [ ] **Step 1** — Re-export RVM to opset 17.

  The shipped `rvm_resnet50_fp16.onnx` is opset 12 with a custom `GridSampler` op that TRT refuses to import. Re-export from the torch checkpoint at opset ≥ 16 so it becomes standard `GridSample`.

  ```python
  # scripts/temp/rvm-export-opset17.py
  import torch
  model = torch.hub.load('PeterL1n/RobustVideoMatting', 'resnet50').cuda().half().eval()
  dummy_src = torch.randn(1, 3, 1080, 1920, dtype=torch.float16).cuda()
  dummy_r = [torch.zeros(1, 1, 1, 1, dtype=torch.float16).cuda() for _ in range(4)]
  torch.onnx.export(
      model, (dummy_src, *dummy_r, torch.tensor(0.25).cuda()),
      'rvm_resnet50_fp16_op17.onnx',
      input_names=['src', 'r1i','r2i','r3i','r4i','downsample_ratio'],
      output_names=['fgr','pha','r1o','r2o','r3o','r4o'],
      opset_version=17,
      dynamic_axes={'src': {2:'H', 3:'W'}},
  )
  ```

- [ ] **Step 2** — Add TRT runtime libs to the Dockerfile.
  ```dockerfile
  RUN wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb \
   && dpkg -i cuda-keyring_1.1-1_all.deb && apt-get update \
   && apt-get install -y --no-install-recommends \
      libnvinfer10 libnvinfer-plugin10 libnvonnxparsers10 \
   && rm -rf /var/lib/apt/lists/* cuda-keyring_1.1-1_all.deb

  RUN /opt/venv/bin/pip install tensorrt==10.3.0 tensorrt-cu12==10.3.0
  ```
  **Docker size impact: +1.4-1.8 GB.** Compressed: ~500-700 MB. This single Phase can push the image from 6.05 GB → 7.5-8 GB. Track in next rebuild.

- [ ] **Step 3** — Attach RunPod network volume for engine cache.
  ```bash
  # Via GraphQL: saveTemplate with volumeInGb=10, volumeMountPath=/runpod-volume
  ```
  Engines are **not portable across GPU architectures** — cache key on `f"{gpu_name}-{trt_version}-{input_hw}"`.

- [ ] **Step 4** — Switch provider list.
  ```python
  gpu = torch.cuda.get_device_name(0).replace(' ', '_')  # e.g. "NVIDIA_RTX_A4000"
  cache_dir = f"/runpod-volume/trt_cache/{gpu}-trt10.3-1080x1920"

  providers = [
      ("TensorrtExecutionProvider", {
          "trt_fp16_enable": True,
          "trt_engine_cache_enable": True,
          "trt_engine_cache_path": cache_dir,
          "trt_max_workspace_size": 2 * 1024 * 1024 * 1024,  # 2 GB
          "trt_dump_subgraphs": False,
      }),
      "CUDAExecutionProvider",   # fallback for any unsupported ops
      "CPUExecutionProvider",
  ]
  ```

- [ ] **Step 5** — First-run will build the engine (~2-5 min on A4000). Subsequent cold-starts with the cache hit hydrate in < 1 s. Verify cache hit:
  ```python
  import os, glob
  cached = glob.glob(f"{cache_dir}/*.engine")
  print(f"TRT cache: {len(cached)} engines, sizes={[os.path.getsize(f)//(1024*1024) for f in cached]} MB")
  ```

- [ ] **Step 6** — Benchmark + commit.

### Verification
- RunPod inference FPS ≥ 60 on A4000.
- First-job `executionTime` higher than steady-state (engine build). Subsequent jobs hit cache — verify by checking `executionTime` drops ~2-5 min between first and second job on same worker.
- Engine files present in `/runpod-volume/trt_cache/`.

### Gotchas
- TRT engine + ORT version compat: ORT 1.19.2 built against TRT 10.2-10.3. If `import onnxruntime` loads `libnvinfer.so.10` but you installed 9.x, silent fallback to CUDA EP. Verify `providers[0] == 'TensorrtExecutionProvider'` in session's active list.
- Dynamic H/W axes: if your inputs vary resolution per job, set `trt_profile_min/opt/max_shapes` to avoid repeated engine builds.
- INT8 quantization: **skip**. RVM's recurrent state needs specialized per-block calibration (arXiv 2506.10840). FP16 gets to target — INT8 is 2-4 weeks of work for marginal speedup.

### Rollback
- Flip provider list back to CUDA-only. Engine cache stays; remove via `rm -rf /runpod-volume/trt_cache/` if disk pressure.

---

## Phase 5 — Zero-copy video I/O (PyNvVideoCodec) (4-6 hours, 1.5-3× when inference is fast)

### Why
When inference is < 20 ms/frame (Phase 3+), the bottleneck shifts to the video pipe: libx264 decodes 1080p at ~80-120 FPS, and every decoded `rgb24` frame is a 6 MB PCIe H2D copy. NVDEC does 500-900 FPS of 1080p H.264 natively and the frame lands in CUDA memory — zero PCIe cost.

Only meaningful after Phase 3+ brings inference under ~20 ms. Before that, I/O isn't the dominant cost.

### Files
- Modify: `models/rvm/Dockerfile.onnx.slim` (pip install PyNvVideoCodec)
- Rewrite: `models/rvm/segment_person_onnx.py` decode + encode paths
- Ensure: `libnvcuvid.so.1` and `libnvidia-encode.so.1` present in RunPod runtime (they come from the driver, not the CUDA toolkit; RunPod's `nvidia/cuda:*` images have them)

### Steps

- [ ] **Step 1** — Add to requirements.
  ```dockerfile
  RUN /opt/venv/bin/pip install PyNvVideoCodec
  ```
  Minimal size impact (~10 MB). Wheels are prebuilt; works with CUDA 12.6.

- [ ] **Step 2** — Replace the ffmpeg decode subprocess with NVDEC.
  ```python
  import PyNvVideoCodec as nvc
  import torch

  demux = nvc.CreateDemuxer(input_path)
  dec = nvc.CreateDecoder(gpuid=0, codec=demux.GetNvCodecId(),
                          cudacontext=0, cudastream=0, usedevicememory=True)

  for pkt in demux:
      for frame in dec.Decode(pkt):        # NV12 on GPU
          rgb_nchw_fp16 = nv12_to_rgb_fp16_nchw_kernel(frame)  # CuPy or torch
          src_ov = ort.OrtValue.ortvalue_from_data_ptr(
              (1, 3, H, W), np.float16, 'cuda', 0, rgb_nchw_fp16.data_ptr())
          io.bind_ortvalue_input('src', src_ov)
          sess.run_with_iobinding(io)
          # pha/fgr now on GPU — see Step 3
  ```

  NV12→RGB kernel: small CuPy kernel (~15 LoC) or `torchvision.transforms.v2.ToImage` on GPU. Not published as a one-liner — write it.

- [ ] **Step 3** — NVENC output path (zero-copy encode).
  ```python
  enc = nvc.PyNvEncoder({
      'preset': 'P1', 'codec': 'h264', 'fps': str(fps),
      'tuning_info': 'ultra_low_latency',
  }, gpu_id=0)
  # fgr/pha are already cuda tensors — convert to NV12 via CUDA kernel, pass data_ptr to enc.Encode()
  ```

- [ ] **Step 4** — Benchmark end-to-end throughput (decode + inference + encode combined, not just inference).

### Verification
- End-to-end throughput ≥ 80 FPS on A4000.
- `nvidia-smi dmon -i 0` during run shows NVDEC utilization > 40%, NVENC > 40%. Previously both were 0%.
- `ffprobe` output video is valid H.264.

### Gotchas
- AV1 decode needs Ampere+ (A4000 ✓).
- `libnvcuvid.so.1` must be dlopen-able — fails on `-base` CUDA images without driver shim. The `slim` Dockerfile uses `nvidia/cuda:12.6.3-base-ubuntu22.04`; RunPod workers mount the driver at runtime so it works in prod but not in local builds without `--gpus all`.
- NVENC has a 3-4 concurrent-sessions-per-GPU hard limit on consumer GPUs. A4000 is a workstation card — no limit. Safe.
- Encode queue depth: set to at least 4 for pipeline overlap with decode.

### Rollback
- Revert to ffmpeg subprocess path. Keep Phase 1-4 fixes.

---

## Phase 6 — Max GPU utilization (in-worker concurrency + pipeline overlap)

### Why
Throughput-per-second (FPS) and **GPU utilization %** are different. After Phases 1-5 a single job might push 100-180 FPS but still leave the GPU SMs idle ~30-50% of wall-clock (waiting on Python, PCIe, NVDEC/NVENC engine queues). To max util we need:
(a) **pipeline overlap inside a single job** — copy/compute on different CUDA streams, NVDEC-prefetch ahead of compute, NVENC-drain behind it, and
(b) **multiple concurrent jobs on one worker** — fills the remaining bubbles and means one worker serves N users before scaling out.

Practical ceiling: research shows **N=2-3 concurrent jobs** is the sweet spot on an A4000 (16 GB VRAM, one GPU engine). Beyond that it's memory pressure for ~0 throughput gain.

### Files
- Modify: `models/rvm/handler_onnx.py` — switch to async handler + `concurrency_modifier`
- Modify: `models/rvm/segment_person_onnx.py` — share session, per-request IOBinding, `do_copy_in_default_stream=False`
- Add: inline `pynvml` sampler (logs GPU/mem util at 500 ms cadence per job for post-hoc analysis)

### Steps

- [ ] **Step 1 — Async handler with concurrency modifier**
  ```python
  # handler_onnx.py
  import asyncio
  from concurrent.futures import ThreadPoolExecutor
  import runpod

  MAX_CONCURRENT = 3
  _executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT)
  _session = None  # lazily loaded ORT session — shared across tasks

  async def process_request(job):
      loop = asyncio.get_running_loop()
      # run_with_iobinding is sync + CUDA-kernel-heavy; offload to thread pool
      return await loop.run_in_executor(_executor, _do_job, job)

  def concurrency_modifier(current: int) -> int:
      # Simple heuristic: scale up on backlog, down otherwise
      # RunPod passes current in-flight count; we return desired cap.
      return min(MAX_CONCURRENT, max(1, current))

  runpod.serverless.start({
      "handler": process_request,
      "concurrency_modifier": concurrency_modifier,
  })
  ```

- [ ] **Step 2 — Share session, per-request IOBinding**
  ```python
  # segment_person_onnx.py
  _session_lock = threading.Lock()
  _session = None

  def get_session():
      global _session
      with _session_lock:
          if _session is None:
              _session = ort.InferenceSession(
                  MODEL_PATH,
                  providers=[("CUDAExecutionProvider", {
                      "device_id": 0,
                      "do_copy_in_default_stream": False,   # copy/compute overlap
                      "cudnn_conv_algo_search": "EXHAUSTIVE",
                      "prefer_nhwc": True,
                      "enable_cuda_graph": True,
                  })],
              )
      return _session

  def process_video(...):
      sess = get_session()
      io = sess.io_binding()            # fresh binding per job — NOT shared
      # allocate THIS job's r1..r4 OrtValues on CUDA (per-job state)
      ...
  ```
  ORT session is thread-safe after construction for concurrent `run_with_iobinding`. IOBinding and recurrent-state OrtValues are per-job (one set per in-flight request).

- [ ] **Step 3 — Pipeline overlap via CUDA streams in a single job**

  `do_copy_in_default_stream=False` already puts H2D/D2H copies on a stream separate from compute. For the NVDEC→compute→NVENC chain (Phase 5), use three explicit streams:
  ```python
  # Inside the frame loop (after Phase 5's PyNvVideoCodec path)
  decode_stream = torch.cuda.Stream()
  compute_stream = torch.cuda.current_stream()  # ORT uses default
  encode_stream = torch.cuda.Stream()

  with torch.cuda.stream(decode_stream):
      nv12_frame = dec.Decode(pkt)   # NVDEC is a separate HW engine anyway
      rgb_fp16 = nv12_to_rgb_kernel(nv12_frame)
  # compute_stream waits on decode_stream via event:
  ev = decode_stream.record_event()
  compute_stream.wait_event(ev)
  # Run ORT on compute_stream (default)
  sess.run_with_iobinding(io)
  # Encode kicked off on encode_stream after compute done
  ev2 = compute_stream.record_event()
  with torch.cuda.stream(encode_stream):
      encode_stream.wait_event(ev2)
      enc.Encode(pha_to_nv12(pha_ov))
  ```
  NVDEC and NVENC are separate hardware engines from the SM compute units — they overlap with compute for free, only queue-depth ordering matters.

- [ ] **Step 4 — GPU util sampler**

  Add once at process start:
  ```python
  import pynvml, threading, json, time

  def start_gpu_sampler(job_id: str, interval_s: float = 0.5):
      pynvml.nvmlInit()
      h = pynvml.nvmlDeviceGetHandleByIndex(0)
      samples = []
      stop = threading.Event()
      def sample():
          while not stop.is_set():
              u = pynvml.nvmlDeviceGetUtilizationRates(h)
              m = pynvml.nvmlDeviceGetMemoryInfo(h)
              samples.append({"t": time.time(), "gpu": u.gpu, "mem_mb": m.used // 1024 // 1024})
              time.sleep(interval_s)
      t = threading.Thread(target=sample, daemon=True); t.start()
      def finish():
          stop.set(); t.join(timeout=1)
          if samples:
              gpus = [s["gpu"] for s in samples]
              print(json.dumps({"job_id": job_id, "gpu_avg": sum(gpus)/len(gpus),
                                "gpu_max": max(gpus), "samples": len(samples)}), flush=True)
      return finish
  ```
  Call at start of each job, log summary at end. Results show up in RunPod logs; aggregate across 10-20 test jobs to get a real utilization number.

- [ ] **Step 5 — Verify session concurrency actually parallelizes**

  Submit 3 jobs to the same warm worker within 1 second of each other. Expected behavior:
  - All 3 jobs enter `IN_PROGRESS` simultaneously (not queued behind each other)
  - Wall-clock for all 3 completing ≈ 1.2-1.8× wall-clock for a single job (not 3×)
  - GPU util avg ≥ 80% across the concurrent window (vs ~30-50% single-job)

- [ ] **Step 6** — Commit.

### Verification
- `gpu_avg ≥ 75%` over the inference window of a single job (post-Phase 5)
- `gpu_avg ≥ 90%` when 2-3 concurrent jobs share a worker
- 3-job concurrent wall-clock ≤ 1.8× single-job wall-clock (proves actual parallelism, not just serialization under lock)
- No OOM — VRAM usage peaks < 14 GB on A4000 with 3 concurrent 1080p jobs

### Gotchas
- **Handler MUST be `async def`**. RunPod SDK v1.7.7 gates `concurrency_modifier` on async handlers. A sync handler silently ignores the modifier.
- **`do_copy_in_default_stream=False` has known race conditions on some ops** (ORT issue #4829). Validate outputs against the default-stream config on a test video first (PSNR ≥ 40 dB).
- **Don't share IOBinding across concurrent jobs** — `io_binding()` is not thread-safe even though the session is. Per-job instance.
- **CUDA Graphs + concurrency**: when multiple threads hit the same session with CUDA Graph enabled, they share the captured graph but not the buffers. Each IOBinding must provide the SAME buffer addresses each call for graph replay to work. Two concurrent jobs = two sets of stable buffers. Works, but test carefully.
- **A4000 has no NVENC session limit** (that's a consumer-GPU restriction — A4000 is workstation-class).

### Rollback
- Revert handler to sync + remove `concurrency_modifier`. Session-share change is safe to keep.

### Reference
- RunPod concurrent handlers: https://docs.runpod.io/serverless/workers/handlers/handler-concurrency
- ORT thread safety: https://github.com/microsoft/onnxruntime/discussions/10107
- ORT CUDA EP options: https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html

---

## Phase 7 — Fallback to MobileNetV3 backbone (10 min, 1.47× if ResNet50 quality isn't needed)

### When
Only if Phases 1-5 still fall short of the target AND speaker matting quality is dominated by mid-body silhouette (not hair/edge detail). For most social-media speaker compositing this is true.

### Steps

- [ ] **Step 1** — `Dockerfile.onnx.slim` already downloads both backbones. No rebuild needed.
- [ ] **Step 2** — Change default in `segment_person_onnx.py` line 43: `BACKBONE = "mobilenetv3"`.
- [ ] **Step 3** — Change dispatcher default in `packages/api/src/inference/capabilities/segment-speaker.ts` params.
- [ ] **Step 4** — Re-export opset 17 variant if Phase 4 is active.
- [ ] **Step 5** — A/B sample 5 clips at both backbones; human-review matte on hair/hand edges.
- [ ] **Step 6** — Commit if acceptable.

### Verification
- Inference FPS ≥ 1.47× Phase-5 number.
- Visual quality acceptable on the A/B sample.

---

## Expected throughput progression (A4000, 1080p, ResNet50)

| Phase | Change | Predicted FPS | Cumulative speedup |
|---|---|---|---|
| 0 | Baseline | 3 | 1× |
| 1 | `downsample_ratio: 0.8 → 0.25` | 15-30 | 5-10× |
| 2 | IOBinding + GPU recurrent state | 40-60 | 13-20× |
| 3 | `prefer_nhwc` + CUDA Graphs + EXHAUSTIVE | 50-80 | 16-27× |
| 4 | TensorRT EP + FP16 | 80-130 | 26-43× |
| 5 | Zero-copy I/O (end-to-end) | 100-180 | 33-60× |
| 6 | Concurrency 2-3× per worker | 200-400 aggregate | — per-job same; per-worker 2-3× |
| 7 | (optional) MobileNetV3 | 150-250 single-job | 50-83× |

All numbers sized to A4000 (AMPERE_16). ADA_24/4090 remains in the pool as a reliability fallback only, not a perf assumption.

**GPU utilization targets per phase:**

| Phase | Single-job gpu_avg | Notes |
|---|---|---|
| 0 (now) | ~5-10% | mostly idle — CPU bottlenecked |
| 1 | ~15-25% | less CPU per frame but still serial |
| 2 | ~40-60% | no more CPU↔GPU ping-pong |
| 3 | ~50-70% | Graphs + NHWC |
| 5 | ~60-80% | zero-copy I/O fills PCIe bubble |
| 6 single-job | ~70-85% | copy/compute overlap via streams |
| 6 3-concurrent | ~90-98% | multiple jobs fill remaining bubbles |

---

## Self-review

- **Biggest single win (Phase 1) is FREE** — a config value change. If this alone hits throughput goals, stop there. Budget: 30 min.
- **Phase 2 is a rewrite but contained** — `process_video()` and its decode loop only. ~150 LoC change. The verification step (PSNR against pre-change output) guards against behavioral drift.
- **Phases 3-5 are independent** — you can ship Phase 3, measure, and skip Phase 4/5 if you're above target.
- **Phase 4 (TRT) adds 1.4-1.8 GB to the Docker image.** Check that against the slim image's current 6.05 GB goal — this may force reverting the slim-image optimization effort. Decision point: if Phase 3 hits target, don't do Phase 4.
- **No new external services.** All changes are code in `models/rvm/` + the existing Dockerfile. No MinIO changes, no dispatcher changes beyond param defaults.
- **Rollback per phase is a single `git revert`** — each phase's changes are orthogonal.

## What's NOT in this plan

- Multi-stream pipelining (parallel chunks of the video with separate recurrent states): breaks temporal coherence at chunk boundaries; not worth the complexity for single-speaker matting.
- INT8 quantization: RVM recurrent states need specialized per-block calibration (arXiv 2506.10840). FP16 is sufficient.
- Switching off ONNX to direct TRT Python bindings: marginal ~10-20% gain vs ORT+TRT EP, not worth the rewrite.
- Replacing RVM with MODNet or BackgroundMattingV2: quality/behavior tradeoff — separate research doc if quality gaps appear.
- Switching backends per video (e.g., MNet3 for low-res, ResNet50 for 4K): dispatcher-side complexity not justified until Phase 6 ships and we measure real quality impact.
