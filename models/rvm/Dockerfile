# syntax=docker/dockerfile:1.6
#
# Multi-stage build targeting ~6-7 GB final image.
# Key tricks:
#   * CUDA `base` image instead of `runtime` — torch's +cu121 wheel bundles
#     libcudart/libcublas/libcudnn etc. Using `runtime` duplicates them (~2 GB).
#   * Builder stage installs deps + downloads weights, final stage copies just
#     the venv + weights cache. Avoids carrying pip cache / build tools / git
#     into the runtime image.
#   * Site-packages strip: tests/, __pycache__, *.pyc — saves 200-500 MB.
#   * Shallow clone of RVM repo, then retain only `model/` + `hubconf.py`.
#
# Build context: `models/rvm/` (Dockerfile + segment_person.py + handler.py + requirements.txt).

############################
# 1. Builder stage
############################
FROM nvidia/cuda:12.2.0-base-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv \
    git wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Isolated venv so final stage copies only what's needed
RUN python3.10 -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH

# PyTorch (bundles CUDA runtime libs) + rest of requirements
COPY requirements.txt /tmp/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cu121 \
        torch==2.3.1 torchvision==0.18.1 \
 && pip install -r /tmp/requirements.txt

# Strip site-packages cruft (tests, pyc cache, build artifacts)
RUN find /opt/venv -type d \( -name __pycache__ -o -name tests -o -name test \) -prune -exec rm -rf {} + \
 && find /opt/venv -type f \( -name "*.pyc" -o -name "*.pyo" -o -name "*.a" -o -name "*.so.debug" \) -delete

# RVM weights + hub repo (keep only what torch.hub.load needs: hubconf.py + model/)
RUN mkdir -p /root/.cache/torch/hub/checkpoints \
 && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_resnet50.pth \
    https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth \
 && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_mobilenetv3.pth \
    https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3.pth \
 && git clone --depth 1 https://github.com/PeterL1n/RobustVideoMatting.git /tmp/rvm-repo \
 && mkdir -p /root/.cache/torch/hub/PeterL1n_RobustVideoMatting_master \
 && cp /tmp/rvm-repo/hubconf.py /root/.cache/torch/hub/PeterL1n_RobustVideoMatting_master/ \
 && cp -r /tmp/rvm-repo/model /root/.cache/torch/hub/PeterL1n_RobustVideoMatting_master/ \
 && rm -rf /tmp/rvm-repo


############################
# 2. Final runtime stage
############################
FROM nvidia/cuda:12.2.0-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH

# Runtime needs: python interpreter (no pip/venv), ffmpeg for decode/encode.
# Everything else (torch, CUDA libs, deps) ships in the venv we copy below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3.10 /usr/local/bin/python

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /root/.cache/torch /root/.cache/torch

WORKDIR /app
COPY segment_person.py /app/segment_person.py
COPY handler.py /app/handler.py

CMD ["python", "/app/handler.py"]
