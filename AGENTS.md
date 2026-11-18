# ChottoCall — agent notes

Two independent services, no root manifest, no CI, no tests. Both must run for a call to work.

## Run & verify

- Backend: `cd backend && uv sync && uv run uvicorn app.main:app --port 8000`. This checkout uses Python 3.14 (`uv.lock` / `.venv`); `pyproject.toml` allows >=3.11 but don't downgrade.
- Browserless pipeline check (local mic/speaker + per-stage latency): `cd backend && uv run python -m app.voice.run`.
- Frontend: `cd frontend && bun install && bun dev` (port 3000).
- Verification is frontend-only: `bun lint`, `bun typecheck`, `bun run build`. There is no test script and no backend lint/typecheck/test config — don't go looking for tests.
- `bun run format` (Prettier: no semicolons, double quotes, tailwind class sorting).

## Env: two separate files

- Backend reads the **root** `.env` (gitignored, template `.env.example`) at import time via `find_dotenv()` in `app/voice/llm.py`. There is no `backend/.env`.
- Frontend reads `frontend/.env.local` (template `frontend/.env.example`) with `NEXT_PUBLIC_API_URL`; only `NEXT_PUBLIC_*` reaches the browser. Backend CORS allows only `http://localhost:3000`.

## Backend wiring

- Entrypoint `backend/app/main.py`: real endpoints are `/health`, `POST /api/offer`, `PATCH /api/offer` (ICE candidates). The `/v1/models` routes are stubs that only silence IDE/OpenAI-client 404s — not an LLM endpoint.
- Pipeline is assembled in `app/voice/pipeline.py::build_pipeline(transport)`:
  `transport.input → HalfDuplexProcessor → VADProcessor(Silero) → ShrutiSTTService → user aggregator (SmartTurn) → LLM → SpeechifyTTS → transport.output → assistant aggregator`.
  Half-duplex is deliberately **before** VAD so the bot's own voice isn't heard as user speech; don't reorder.
- LLM choice in `app/voice/llm.py` is local-first — llama.cpp (:8080/v1) → Ollama (:11434/v1) → Groq fallback — with env read at call time. Keep `LLM_MAX_TOKENS=256` and the per-request `enable_thinking: false`: uncapped reasoning models produce 45s+ turns nobody hears. `LLM_PROBE_TIMEOUT` defaults to 15s (1s broke tunnelled hosts). Serve reasoning models with `llama serve -m model.gguf -c 2048 --port 8080 -rea off`.
- STT `ShrutiSTTService` uses cactus Whistle with `models/shruti-bengali.cact`. The path is **relative to cwd** — run backend commands from `backend/`. It auto-downloads via `huggingface_hub` if missing (gitignored) and loads once per process (~3s).
- TTS `SpeechifyTTSService` streams `pcm_24000` Bengali (`bn-IN`, voice `ritwik`, model `simba-3.5` — 3.2 is English-only) and needs `SPEECHIFY_API_KEY`. Emojis are stripped before synthesis. One sentence = one API call; multi-sentence replies are several back-to-back calls **by design**.
- Barge-in is off by default: the mic is muted while the bot speaks (no echo cancellation). `CHOTTO_BARGE_IN=1` opens it; interruptions still depend on the SmartTurn wiring.

## Frontend wiring

- App Router, one page: `app/page.tsx` → `components/voice-call.tsx`. All visible copy lives in `lib/i18n.ts` (Bengali default, English, persisted to `localStorage["chottocall:locale"]`) — add strings there, not inline.
- Pipecat client (`@pipecat-ai/client-js` + `@pipecat-ai/small-webrtc-transport`) POSTs to `${NEXT_PUBLIC_API_URL}/api/offer`.
- **Next.js 16 is not the Next.js you know.** `frontend/AGENTS.md` requires reading `node_modules/next/dist/docs/` before writing frontend code. `next dev` rewrites that file, so keep its changes in diffs instead of reverting them; `frontend/CLAUDE.md` just imports it.
- shadcn/ui via `components.json` (Tailwind v4 CSS-first, no `tailwind.config`, Phosphor icons). Add with `npx shadcn@latest add <name>` from `frontend/`; `@/*` maps to `frontend/*`. `D` toggles the theme (`components/theme-provider.tsx`).

## Don't "fix" these

- `backend/app/voice/smart_turn_backport_warn.py` is intentionally never imported — it documents missing interruption logs as a pipecat-backport artifact, not a bug.
- `backend/app/voice/smart_turn.py` has many unused helper factories/classes; the active path is only `user_turn_strategies()` + `user_turn_strategies_params()` wired into the user aggregator.
- `plan.md` ends with a standing request: **ask before any major move or decision**. Honor it for scope/architecture changes.
