# syntax=docker/dockerfile:1

FROM python:3.14-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# pyaudio (pipecat-ai[local]) builds from source; espeak-ng is tiny-swara's phonemizer.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      espeak-ng \
      portaudio19-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml uv.lock ./
# Cache mount keeps uv's ~8 GB wheel cache out of the image while still
# making rebuilds fast.
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.14-slim

# Runtime-only shared libraries for pyaudio, torch and onnxruntime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      espeak-ng \
      libasound2t64 \
      libgomp1 \
      libportaudio2 \
      libstdc++6 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv ./.venv
COPY app ./app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
