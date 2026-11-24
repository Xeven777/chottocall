#!/bin/sh
set -eu

cd /app

# Models live in a bind-mounted, gitignored folder shared with local runs.
# Shruti self-downloads on first call; these two need an explicit fetch.
if [ ! -f models/tiny-swara/inference.py ]; then
  uv run --frozen hf download Xeven7/tiny-swara --local-dir models/tiny-swara
fi
if [ ! -f models/mithi-v2-flash/run.py ]; then
  uv run --frozen hf download Oomni/mithi-v2-flash --local-dir models/mithi-v2-flash
fi

exec uv run --frozen uvicorn app.main:app --host 0.0.0.0 --port 8000
