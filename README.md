# ChottoCall (চট্টোকল)

A browser-based Bengali voice assistant: talk to it in Bengali over WebRTC and it answers by voice. Built with [Pipecat](https://github.com/pipecat-ai/pipecat) on the backend and Next.js on the frontend.

## Stack

| Layer | What | Notes |
|---|---|---|
| Frontend | Next.js (Bun), pipecat client | `http://localhost:3000` |
| Backend | FastAPI + Pipecat pipeline | `http://localhost:8000` |
| Transport | SmallWebRTC | mic in / audio out |
| STT | Shruti (local Bengali model, `backend/models/`) | |
| LLM | llama.cpp (default) → Ollama → Groq fallback | see below |
| TTS | Mithi v2 Flash (local, `bn`, voice `satvik`) → Speechify fallback | Mithi by default; Speechify when the local model is unavailable |

## Voice pipeline

```
mic → half-duplex → VAD (Silero) → STT → LLM → TTS → speaker
```

- **Half-duplex** by default: the mic is muted while the bot speaks. Set `CHOTTO_BARGE_IN=1` to open it (interruptions still need turn detection).
- **SmartTurn** detection stops the bot from answering until you're actually done.
- The LLM speaks in 1–2 short Bengali sentences; emojis are stripped before TTS.
- Text is synthesized **per sentence** — a multi-sentence answer is several TTS calls played back-to-back. That's the streaming design, not a bug.
- With Mithi, the whole sentence is generated before playback starts, so expect a short pause (~3 s on 4 CPU threads) before the voice begins. The locked torch wheel is CPU-only; NVIDIA CUDA also works when a CUDA build is installed. If Mithi fails to load or synthesize, the app silently uses Speechify (check the backend logs for why).

## Provider abstraction

The pipeline never names a concrete implementation. Each voice component has a
registry in `backend/app/voice/providers/` and a comma-separated preference chain
in the environment:

| Component | Setting | Providers |
|---|---|---|
| STT | `STT_PROVIDER` | `shruti` |
| LLM | `LLM_PROVIDER` | `llama.cpp`, `ollama`, `groq` |
| TTS | `TTS_PROVIDER` | `mithi`, `speechify` |
| VAD | `VAD_PROVIDER` | `silero` |
| Turn detection | `TURN_PROVIDER` | `smart_turn`, `speech_timeout` |

The first provider that reports itself available is built. Availability is
checked without loading a model (a model file on disk, an API key, or a probe of
`GET /v1/models`), lazily and in order — a working llama.cpp server never pays for
an Ollama probe. TTS keeps the rest of its chain as a per-sentence runtime
fallback. A local-only `LLM_PROVIDER` still gets Groq appended, so a call never
dies because the local server is down.

Adding a provider is one decorated factory: see
`backend/app/voice/providers/base.py`. Nothing in the pipeline, settings, or API
changes — the env setting chooses the implementation.

## LLM providers

Selected with `LLM_PROVIDER`, a preference chain (default
`llama.cpp,ollama,groq`). Whatever is chosen falls back to Groq when the local
server is unreachable, so a call never dies because your local LLM is down.

- `llama.cpp` (default) — [llama.cpp](https://github.com/ggml-org/llama.cpp) unified binary, OpenAI-compatible server on `:8080`:
  ```sh
  llama serve -m <model.gguf> -c 2048 --port 8080 -rea off
  ```
  `-rea off` (a.k.a. `--reasoning off`) matters for reasoning models (e.g. LiquidAI LFM3, Sarvam-30B) — otherwise it reasons first and TTS has nothing to speak. The old `--chat-template-kwargs '{"enable_thinking": false}'` still works but logs a deprecation warning.

  The app does not rely on that flag alone: every request also sends `enable_thinking: false` and `max_tokens: LLM_MAX_TOKENS` (default 256). Without the cap a reasoning model can generate thousands of tokens per turn — 45s+ at ~70 tok/s — for audio nobody hears.
- `ollama` — `ollama serve`, model auto-discovered (default `gemma3:1b`, falls back to the first local model).
- `groq` — cloud fallback; needs `GROQ_API_KEY`.

## TTS: Mithi (local) + Speechify (fallback)

Mithi v2 Flash is a 199 MB local model (Apache-2.0) for 11 Indian languages. It runs
in the backend process; there is no external TTS server. Bengali (`bn`) and the
`satvik` male voice are the defaults. Mithi is skipped at build time when
`models/mithi-v2-flash/run.py` is missing, so a machine without the model never
loads torch; if a sentence still fails at synthesis time, the
`FallbackTTSService` wrapper speaks it with the next provider in `TTS_PROVIDER`
(Speechify, when `SPEECHIFY_API_KEY` is set).

One-time setup, from `backend/`:

```sh
uv sync                                   # installs CPU-only torch from PyTorch's CPU index
uv run hf download Oomni/mithi-v2-flash --local-dir models/mithi-v2-flash
```

`TTS_MITHI_DEVICE`, `TTS_MITHI_THREADS`, `TTS_MITHI_VOICE` and
`TTS_MITHI_LANG` are documented in `.env.example`.

Important: Mithi is **not streaming** — it generates a whole sentence before
playback begins (roughly 1–3 s on GPU, ~3 s on 4 CPU threads). Once it starts,
the audio plays normally.

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
   uv run uvicorn app.main:app --port 8000
   ```

2. **Frontend** (Bun):
   ```sh
   cd frontend
   bun install
   bun dev
   ```

3. **Env** — root `.env` (gitignored), loaded automatically:
   ```
   GROQ_API_KEY=...          # Groq fallback
   SPEECHIFY_API_KEY=...     # TTS fallback (can be empty if Mithi is installed)
   # optional overrides:
   # TTS_PROVIDER=mithi,speechify   # provider chains: see "Provider abstraction"
   # STT_PROVIDER=shruti
   # VAD_PROVIDER=silero
   # TURN_PROVIDER=smart_turn|speech_timeout
   # TTS_MITHI_VOICE=satvik  # see .env.example for all voices/options
   # TTS_MITHI_DEVICE=auto   # auto | cpu | cuda
   # LLM_PROVIDER=llama.cpp|ollama|groq
   # LLAMA_CPP_BASE_URL=http://localhost:8080/v1
   # LLAMA_CPP_MODEL=<name>  # defaults to whatever the server has loaded
   # OLLAMA_BASE_URL=http://localhost:11434/v1
   # OLLAMA_MODEL=gemma3:1b
   # GROQ_MODEL=openai/gpt-oss-20b
   # CHOTTO_BARGE_IN=1
   ```

Then open `http://localhost:3000` and start a call.
