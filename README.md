# ChottoCall (চট্টোকল)

A browser-based Bengali voice assistant: talk to it in Bengali over WebRTC and it answers by voice. Built with [Pipecat](https://github.com/pipecat-ai/pipecat) on the backend and Next.js on the frontend.

## Stack

| Layer | What | Notes |
|---|---|---|
| Frontend | Next.js 16 (Bun), Pipecat JS client | `http://localhost:3000` |
| Backend | FastAPI + Pipecat 1.15 | `http://localhost:8000` |
| Transport | SmallWebRTC | mic in / audio out |
| STT | Shruti (local Bengali model, `backend/models/`) | cactus Whistle, ~3 s load |
| VAD | Silero (bundled ONNX) | no API key |
| Turn detection | SmartTurn v3 (local) | `speech_timeout` alternative |
| LLM | llama.cpp (default) → Ollama → Groq fallback | see below |
| TTS | tiny-swara (local ONNX) → Mithi v2 Flash (local) → Speechify | per-sentence runtime fallback |

## Voice pipeline

```
mic → half-duplex → VAD (Silero) → STT → user aggregator → LLM → TTS → speaker → assistant aggregator
```

- **Half-duplex** by default: the mic is muted while the bot speaks. Set `CHOTTO_BARGE_IN=1` to open it (interruptions still need turn detection).
- **SmartTurn** stops the bot from answering until you're actually done speaking.
- The LLM speaks in 1–2 short Bengali sentences; emojis are stripped before TTS.
- Text is synthesized **per sentence** — a multi-sentence answer is several TTS calls played back-to-back. That's the streaming design, not a bug.
- Four demo tools are registered (weather, order status, appointment, branch lookup). They sleep and return canned Bengali answers today; a short bridging filler is spoken while they "run" so the caller hears no dead air.
- `GET /health` is a static readiness stub. The `/v1/models` routes only silence IDE/OpenAI-client 404s — they are **not** an LLM endpoint.

## Provider abstraction

The pipeline never names a concrete implementation. Each voice component has a
registry in `backend/app/voice/providers/` and a comma-separated preference chain
in the environment:

| Component | Setting | Providers |
|---|---|---|
| STT | `STT_PROVIDER` | `shruti` |
| LLM | `LLM_PROVIDER` | `llama.cpp`, `ollama`, `groq` |
| TTS | `TTS_PROVIDER` | `tiny-swara`, `mithi`, `speechify` |
| VAD | `VAD_PROVIDER` | `silero` |
| Turn detection | `TURN_PROVIDER` | `smart_turn`, `speech_timeout` |

The first provider that reports itself available is built. Availability is
checked without loading a model (a model file on disk, an API key, or a probe of
`GET /v1/models`), lazily and in order — a working llama.cpp server never pays for
an Ollama probe. TTS keeps the rest of its chain as a per-sentence runtime
fallback: a sentence a provider could not synthesize is retried by the next one,
and a sentence that already produced audio is never restarted.

Adding a provider is one decorated factory: see
`backend/app/voice/providers/base.py`. Nothing in the pipeline, settings, or API
changes — the env setting chooses the implementation. Settings are typed, frozen
dataclasses in `backend/app/voice/settings.py`, read per call rather than at import.

## LLM providers

Selected with `LLM_PROVIDER`, a preference chain (default
`llama.cpp,ollama,groq`). Whatever is chosen falls back to Groq when the local
server is unreachable, so a call never dies because your local LLM is down.

- `llama.cpp` (default) — [llama.cpp](https://github.com/ggml-org/llama.cpp) OpenAI-compatible server on `:8080`:
  ```sh
  llama serve -m <model.gguf> -c 2048 --port 8080 -rea off
  ```
  `-rea off` (a.k.a. `--reasoning off`) matters for reasoning models (e.g. LiquidAI LFM3, Sarvam-30B) — otherwise it reasons first and TTS has nothing to speak.
- `ollama` — `ollama serve`, model auto-discovered (default `gemma3:1b`, falls back to the first local model).
- `groq` — cloud fallback; needs `GROQ_API_KEY` (default model `openai/gpt-oss-20b`).

The app does not rely on the server flag alone: every request also sends
`enable_thinking: false` and caps output at `LLM_MAX_TOKENS` (default 256). Without
the cap a reasoning model can generate thousands of tokens per turn — 45 s+ at
~70 tok/s — for audio nobody hears. `LLM_PROBE_TIMEOUT` defaults to 15 s (1 s broke
tunnelled hosts).

## TTS: tiny-swara → Mithi → Speechify

**tiny-swara** is the default: a self-contained local ONNX model (voices `BM` male,
`BF` female), with no API key. It needs `espeak-ng` on `PATH`; `onnxruntime` comes
from Pipecat's `silero` extra. One-time setup, from `backend/`:

```sh
uv run hf download Xeven7/tiny-swara --local-dir models/tiny-swara
```

**Mithi v2 Flash** is a 199 MB local model (Apache-2.0) for 11 Indian languages.
It runs in the backend process; there is no external TTS server. Bengali (`bn`)
and the `satvik` male voice are the defaults. Mithi is skipped at build time when
`models/mithi-v2-flash/run.py` is missing, so a machine without the model never
loads torch; if a sentence still fails at synthesis time, the
`FallbackTTSService` wrapper speaks it with the next provider in `TTS_PROVIDER`.

```sh
uv run hf download Oomni/mithi-v2-flash --local-dir models/mithi-v2-flash
```

**Speechify** is the hosted last resort and needs `SPEECHIFY_API_KEY`. It streams
`pcm_24000` Bengali (`bn-IN`, voice `ritwik`, model `simba-3.5` — 3.2 is
English-only). Leave the key empty to opt out of the hosted fallback entirely.

`TTS_TINY_SWARA_*`, `TTS_MITHI_DEVICE`, `TTS_MITHI_THREADS`, `TTS_MITHI_VOICE` and
`TTS_MITHI_LANG` are documented in `.env.example`. Mithi is **not streaming** — it
generates a whole sentence before playback begins (roughly 1–3 s on GPU, ~3 s on
4 CPU threads). Once it starts, the audio plays normally. CPU and CUDA are
supported; the bundled torch build is CPU-only.

## Verification

There is no test script and no backend lint/typecheck config. What exists:

```sh
cd frontend && bun lint && bun typecheck && bun run build   # frontend checks
cd backend && uv run python -m app.voice.run                 # mic → speaker + per-stage latency
```

`uv run python -m app.voice.run` runs the same pipeline locally with your machine's
mic and speakers and prints a latency breakdown per turn — the fastest way to check
that providers still assemble after a change.

## Docker Compose

Build and start both services from the repo root:

```sh
docker compose up -d --build
```

The root `.env` is passed to the backend, and the frontend's `NEXT_PUBLIC_API_URL`
is a **build arg** (default `http://localhost:8000`) because Next.js inlines it
into the browser bundle. Models download once on first start into the gitignored
`backend/models/` folder, which is shared with local runs. Open
`http://localhost:3000`.

The backend uses host networking so WebRTC host candidates are reachable from
the browser — this works on Linux only. Set `CORS_ORIGINS` in `.env` when opening
the app from a LAN IP or domain instead of `localhost:3000`. Rebuild the frontend
if the backend URL changes.

## Setup

1. **Backend** (Python 3.14, [uv](https://docs.astral.sh/uv/)):
   ```sh
   cd backend
   uv sync
   uv run hf download Xeven7/tiny-swara --local-dir models/tiny-swara
   uv run hf download Oomni/mithi-v2-flash --local-dir models/mithi-v2-flash  # optional
   uv run uvicorn app.main:app --port 8000
   ```
   Model paths are relative to the backend working directory — run backend
   commands from `backend/`. The Shruti STT weights auto-download on first use;
   the TTS models above must be downloaded once explicitly.

2. **Frontend** (Bun):
   ```sh
   cd frontend
   bun install
   bun dev
   ```

3. **Env** — root `.env` (gitignored), loaded automatically via `find_dotenv()`:
   ```
   GROQ_API_KEY=...              # Groq fallback
   SPEECHIFY_API_KEY=...         # TTS fallback (can be empty if a local TTS model is installed)
   # optional overrides:
   # LLM_PROVIDER=llama.cpp,ollama,groq
   # LLM_PROBE_TIMEOUT=15
   # LLM_MAX_TOKENS=256
   # LLAMA_CPP_BASE_URL=http://localhost:8080/v1
   # LLAMA_CPP_MODEL=<name>      # defaults to whatever the server has loaded
   # OLLAMA_BASE_URL=http://localhost:11434/v1
   # OLLAMA_MODEL=gemma3:1b
   # GROQ_MODEL=openai/gpt-oss-20b
   # STT_PROVIDER=shruti
   # VAD_PROVIDER=silero
   # TURN_PROVIDER=smart_turn|speech_timeout
   # TURN_STOP_TIMEOUT=5.0
   # TTS_PROVIDER=tiny-swara,mithi,speechify
   # TTS_TINY_SWARA_VOICE=BM     # BM (male) | BF (female)
   # TTS_MITHI_VOICE=satvik
   # TTS_MITHI_DEVICE=auto       # auto | cpu | cuda
   # CHOTTO_BARGE_IN=1           # default 0 (half-duplex)
   # CORS_ORIGINS=http://localhost:3000
   ```

Then open `http://localhost:3000` and start a call.

## Knowledge layer and `/admin`

Embeddings run in a separate llama.cpp server using a local GGUF (Q8_0). Start it from `backend/`:

```sh
llama serve -m /home/anish/apps/models/embeddinggemma-2-Q8_0.gguf --embedding --port 8081 --ctx-size 2048
```

`docker compose up` starts this as the `embeddings` service; override the model path with `EMBEDDING_MODEL_PATH`. The backend talks to it at `EMBEDDING_BASE_URL` (default `http://127.0.0.1:8081/v1`). EmbeddingGemma 2 uses task prefixes and 512-dim Matryoshka vectors; the server truncates and renormalizes them before storage.

Set `DATABASE_URL` in the root `.env` and apply the schema once:

```sh
cd backend && uv run python -m app.knowledge.migrate
```

Then open `http://localhost:3000/admin`. It shows the live stack/status, uploads PDFs or Markdown into Postgres (PDF text via pypdfium2 — no HF model downloads), toggles tools on/off, and lists recorded calls. There is **no admin auth** — keep it localhost-only until you add a token. Ingest a file from the CLI with `uv run python -m app.knowledge.ingest path/to/file.pdf`.

The voice pipeline gains one tool, `search_knowledge`: hybrid pgvector + PostgreSQL full-text retrieval fused with RRF. When nothing clears the confidence gate, it returns `আমার কাছে এই তথ্য নেই।` so the model cannot invent an answer. Filenames are deliberately kept out of the spoken text because the local G2P cannot pronounce them.

