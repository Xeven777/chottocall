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
- With Mithi, the whole sentence is generated before playback starts, so expect a short pause (~1–3 s on a GPU, ~3 s on 4 CPU threads) before the voice begins. On an Intel Arc GPU we use PyTorch's `xpu` device automatically; CPU and NVIDIA CUDA also work. If Mithi fails to load or synthesize, the app silently uses Speechify (check the backend logs for why).

## LLM providers

Selected with `LLM_PROVIDER`; whatever is chosen falls back to Groq when the local server is unreachable, so a call never dies because your local LLM is down.

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
`satvik` male voice are the defaults. If the model is missing or errors, the app
automatically falls back to Speechify (`SPEECHIFY_API_KEY` must be set for that).

One-time setup, from `backend/`:

```sh
uv sync                                   # installs torch (Intel Arc/XPU build; also runs on CPU)
uv run hf download Oomni/mithi-v2-flash --local-dir models/mithi-v2-flash
```

`TTS_MITHI_DEVICE`, `TTS_MITHI_THREADS`, `TTS_MITHI_VOICE` and
`TTS_MITHI_LANG` are documented in `.env.example`.

Important: Mithi is **not streaming** — it generates a whole sentence before
playback begins (roughly 1–3 s on GPU, ~3 s on 4 CPU threads). Once it starts,
the audio plays normally.

## Setup

1. **Backend** (Python 3.14, [uv](https://docs.astral.sh/uv/)):
   ```sh
   cd backend
   uv sync
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
   # TTS_MITHI_VOICE=satvik  # see .env.example for all voices/options
   # TTS_MITHI_DEVICE=auto   # auto | xpu | cpu | cuda
   # LLM_PROVIDER=llama.cpp|ollama|groq
   # LLAMA_CPP_BASE_URL=http://localhost:8080/v1
   # LLAMA_CPP_MODEL=<name>  # defaults to whatever the server has loaded
   # OLLAMA_BASE_URL=http://localhost:11434/v1
   # OLLAMA_MODEL=gemma3:1b
   # GROQ_MODEL=openai/gpt-oss-20b
   # CHOTTO_BARGE_IN=1
   ```

Then open `http://localhost:3000` and start a call.
