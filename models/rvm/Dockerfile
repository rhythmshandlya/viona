# syntax=docker/dockerfile:1.6
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip python3.10-venv \
    git wget ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3.10 /usr/local/bin/python

WORKDIR /app

# Install Python deps (cached layer)
COPY requirements.txt /app/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cu121 \
        torch==2.3.1 torchvision==0.18.1 \
    && pip install -r /app/requirements.txt

# Pre-download RVM weights + hub repo (bake into image — no internet at runtime)
RUN mkdir -p /root/.cache/torch/hub/checkpoints \
    && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_resnet50.pth \
       https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth \
    && wget -q -O /root/.cache/torch/hub/checkpoints/rvm_mobilenetv3.pth \
       https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3.pth \
    && git clone --depth 1 https://github.com/PeterL1n/RobustVideoMatting.git \
       /root/.cache/torch/hub/PeterL1n_RobustVideoMatting_master

# Copy everything from build context (models/rvm/) into the image.
COPY segment_person.py /app/segment_person.py
COPY handler.py /app/handler.py

CMD ["python", "/app/handler.py"]
