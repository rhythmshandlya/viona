# viona-rvm — RunPod Serverless handler

Runs RVM (Robust Video Matting) on GPU via presigned MinIO URLs.

## Contract

See `handler.py` docstring for full input/output JSON.

## Build & push (manual, to GHCR)

The image is hosted as a public GHCR package and RunPod pulls it by URL — RunPod never connects to GitHub.

One-time setup (grant `write:packages` to your existing gh token, then log docker in):

```bash
gh auth refresh -s write:packages
gh auth token | docker login ghcr.io -u <your-gh-user> --password-stdin
```

Build + push:

```bash
# Context = models/rvm/. Run from repo root:
docker build -t ghcr.io/<your-gh-user>/viona-rvm:latest models/rvm
docker push ghcr.io/<your-gh-user>/viona-rvm:latest
```

Make the package public (only needed on first push):

```bash
gh api -X PATCH /user/packages/container/viona-rvm/visibility -f visibility=public
```

Local test build (optional, for dev):

```bash
docker build -t viona-rvm:local models/rvm
```

## Local test

```bash
cat > /tmp/local-input.json <<'JSON'
{
  "inputs":  { "video": "https://<presigned-get>" },
  "outputs": {
    "matte": "https://<presigned-put>",
    "fgr":   "https://<presigned-put>",
    "bbox":  "https://<presigned-put>"
  },
  "params": { "backbone": "resnet50", "scale": 0.5, "downsampleRatio": 0.25 }
}
JSON

docker run --rm --gpus all -v /tmp:/tmp "$IMAGE" \
  python /app/handler.py --test-input /tmp/local-input.json
```

## RunPod endpoint config (set in dashboard)

Serverless → New Endpoint → **Custom** (NOT "Import from GitHub").

| Field | Value |
|---|---|
| Container image | `ghcr.io/<your-gh-user>/viona-rvm:latest` |
| Container registry credentials | leave empty (image is public) |

### Recommended worker sizing (GPU + CPU saturation)

RVM mixes GPU inference (bottleneck) and CPU ffmpeg decode/encode (secondary). Underspec-ing CPU starves the GPU between batches.

| Field | Value | Why |
|---|---|---|
| GPU types (priority) | **L40S → A40 → RTX A5000** | L40S (48GB) gives us `SEQ_CHUNK=16` and fp16; A40 same VRAM, slightly slower; A5000 (24GB) falls to `SEQ_CHUNK=8`. Avoid anything smaller. |
| GPU count | 1 | RVM is single-GPU; multi-GPU buys nothing for this model. |
| vCPUs | **at least 8, prefer 16** | ffmpeg decode + NVENC encode run in parallel with inference; too few cores = pipeline stall. |
| RAM | **32 GB** | Headroom for frame buffers + ffmpeg + torch + batched tensors. |
| Disk | 50 GB | Source video + matte + fgr + proxies in `/tmp` during a single job; short-lived. |
| Min workers | 0 | |
| Max workers | 3 | Leaves room for parallel scene segmentation. |
| Idle timeout | 60s |
| Execution timeout | 900s |
| Scaler | QUEUE_DELAY, 4s |
| FlashBoot | on |
