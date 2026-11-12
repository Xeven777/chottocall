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
| TTS | Speechify (`simba-3.5`, `bn-IN`, voice `ritwik`) | streaming raw PCM |

## Voice pipeline

```
mic → half-duplex → VAD (Silero) → STT → LLM → TTS → speaker
```

- **Half-duplex** by default: the mic is muted while the bot speaks. Set `CHOTTO_BARGE_IN=1` to open it (interruptions still need turn detection).
- **SmartTurn** detection stops the bot from answering until you're actually done.
- The LLM speaks in 1–2 short Bengali sentences; emojis are stripped before TTS.
- Text is synthesized **per sentence** — a multi-sentence answer is several Speechify calls played back-to-back. That's the streaming design (low time-to-first-word), not a bug.

## LLM providers

Selected with `LLM_PROVIDER`; whatever is chosen falls back to Groq when the local server is unreachable, so a call never dies because your local LLM is down.

- `llama.cpp` (default) — [llama.cpp](https://github.com/ggml-org/llama.cpp) unified binary, OpenAI-compatible server on `:8080`:
  ```sh
  llama serve -m <model.gguf> -c 2048 --port 8080 \
    --chat-template-kwargs '{"enable_thinking": false}'
  ```
  The `enable_thinking` flag matters for reasoning models (e.g. LiquidAI LFM3) — otherwise it reasons in `reasoning_content` and TTS has nothing to speak.
- `ollama` — `ollama serve`, model auto-discovered (default `gemma3:1b`, falls back to the first local model).
- `groq` — cloud fallback; needs `GROQ_API_KEY`.

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
   SPEECHIFY_API_KEY=...     # TTS
   # optional overrides:
   # LLM_PROVIDER=llama.cpp|ollama|groq
   # LLAMA_CPP_BASE_URL=http://localhost:8080/v1
   # LLAMA_CPP_MODEL=<name>  # defaults to whatever the server has loaded
   # OLLAMA_BASE_URL=http://localhost:11434/v1
   # OLLAMA_MODEL=gemma3:1b
   # GROQ_MODEL=openai/gpt-oss-20b
   # CHOTTO_BARGE_IN=1
   ```

Then open `http://localhost:3000` and start a call.
