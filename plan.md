# ChottoCall

## 1. Overview

An open-source, multilingual AI assistant that people can interact with through voice calls and SMS.

The initial version will provide browser-based real-time voice conversations, with Bengali as the primary language. The architecture will support future integration with traditional telephone networks and SMS without rewriting the core agent.

**Core philosophy:** Modular, provider-agnostic, streaming-first and self-hostable.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| Voice framework | Pipecat |
| Audio transport | WebRTC |
| Signaling / Events | WebSocket |
| STT | Shruti Bengali |
| VAD | Silero VAD |
| Turn detection | Pipecat Smart Turn |
| LLM | API providers / LFM 3.1 1.7B |
| Local inference | llama.cpp |
| TTS | Indic TTS / Bengali-compatible provider |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Validation | Pydantic |
| Deployment | Docker, Docker Compose |
| Dependency management | uv |

## 3. Architecture

The system will have five major layers.

### A. Communication Layer
Responsible for connecting users to the agent.

- WebRTC for browser-based voice conversations.
- WebSocket for signaling and real-time events.
- Future adapters for PSTN and SMS.
- Transport-independent session management.

### B. Voice Processing Layer
Powered by Pipecat.

- Streaming audio input and output.
- Speech-to-text.
- Voice activity detection.
- Turn detection.
- Interruption handling (barge-in).
- Streaming text-to-speech.

### C. Agent Runtime
The central intelligence layer.

- Conversation context and memory.
- LLM orchestration.
- Tool/function calling.
- Intent handling.
- Response generation.
- Tool execution and validation.

### D. Provider Abstraction Layer

Every AI component should have a common interface.

- STTProvider
- LLMProvider
- TTSProvider
- VADProvider
- TurnDetector

Implementations should be interchangeable through configuration without modifying the agent runtime.

Support both hosted APIs and local inference.

### E. Data Layer

PostgreSQL will store:

- User profiles.
- Conversation sessions.
- Conversation history.
- Tool execution records.
- Agent configurations.
- Usage and performance metrics.

## 4. Features

### Initial MVP

- Real-time browser voice conversations.
- Bengali speech recognition and synthesis.
- AI-generated conversational responses.
- Streaming audio playback.
- Voice interruption and turn detection.
- Conversation history.
- Configurable AI providers.
- Basic tool/function calling.
- Simple dashboard for testing conversations.

### Agent Capabilities

The agent should be able to:

- Answer general questions.
- Retrieve information from external APIs.
- Execute registered tools.
- Maintain conversational context.
- Explain tool results in simple Bengali.
- Handle errors and retry failed operations safely.

### Future Features

- Traditional phone calling through telephony providers & SMS support (via twilio).
- Multiple Indian languages.
- Multiple specialized agents.
- User-specific memory.
- Analytics and conversation evaluation.

## 5. Development Roadmap

### Phase 1 — Project Foundation
- Set up monorepo.
- Configure FastAPI and Next.js.
- Set up Docker Compose.
- Configure PostgreSQL and SQLAlchemy.
- Establish provider interfaces.

### Phase 2 — Voice Pipeline
- Integrate Pipecat.
- Implement WebRTC transport.
- Integrate Shruti Bengali STT.
- Add Silero VAD and Smart Turn.
- Integrate initial TTS provider.
- Implement streaming audio responses.

### Phase 3 — Agent Runtime
- Integrate LLM providers.
- Implement API and llama.cpp adapters.
- Build conversation context management.
- Implement tool registry and execution.
- Add structured outputs and validation.

### Phase 4

Decisions
Item	Choice
DB	Your Neon chottocall database — put the URL in root .env as DATABASE_URL (gitignored; don't commit it)
PDFs	≤10 MB → synchronous ingest, no job table
Tools	Toggle only — enable/disable the existing 5 functions in tools.py
Admin	No auth, local-only — with a shortcut: comment: add a token before exposing
Orchestration	Pipecat only; no LangGraph
Embeddings	EmbeddingGemma 2, text-only 270M, 512d
Parsing	Docling → Markdown → sentence chunks
Schema — simplified
documents(id uuid pk, title text, source_uri text, content_hash text unique,
          lang text default 'bn', created_at timestamptz)
chunks(id uuid pk, document_id uuid fk, ordinal int, content text,
       embedding halfvec(512), search tsvector, unique(document_id, ordinal))
sessions(id uuid pk, started_at, ended_at, locale text)
messages(id bigint pk, session_id fk, role text, text text,
         sources jsonb, at timestamptz)
tools(name text pk, enabled bool default true, updated_at timestamptz)
HNSW on embedding, GIN on search + trigram on content. tools.name references the decorated functions — no webhook URLs, no SSRF surface.
Admin pages (same Next.js app, shadcn-first)
- Overview — stack list + live status (API, DB, embedding model, doc/chunk counts, provider chains)
- Knowledge — file input, document table with delete dialog, ingest result toast
- Tools — table of TOOLS with Switch bound to tools.enabled
- Conversations — sessions table + transcript with source chips
Components: Card, Badge, Table, Dialog, Switch, Skeleton, sonner. No new frontend deps. Read node_modules/next/dist/docs/ before writing Next.js code.
Backend additions
GET /api/admin/stack, POST/GET/DELETE /api/admin/knowledge, GET/PATCH /api/admin/tools, GET /api/admin/sessions. KnowledgeConfig dataclass in settings.py. Alembic migration #1 runs CREATE EXTENSION IF NOT EXISTS vector;.
Build order
1. Migration + config + ingest (prove retrieval on 10 Bengali questions first)
2. Admin knowledge + overview
3. Tool toggles
4. Sessions/messages + conversations

### Phase 5 — Testing & Optimization
- Test Bengali conversational accuracy.
- Measure end-to-end response latency.
- Test interruptions and noisy audio.
- Add logging and observability.
- Test concurrent sessions.

## 6. Engineering Principles

1. Keep AI providers interchangeable.
2. Keep communication transports independent of agent logic.
3. Use asynchronous processing for real-time workloads.
4. Prefer streaming over blocking request-response operations.
5. Validate every tool call before execution.
6. Track latency and errors across the entire pipeline.
7. Keep local inference optional, not mandatory.
8. Avoid unnecessary microservices and infrastructure.

## 7. MVP Success Criteria

The first release is considered functional when:

- A user can start a browser voice session.
- The agent understands and responds in Bengali.
- Audio is streamed with reasonable latency.
- Users can interrupt the agent naturally.
- The LLM can invoke and execute tools.
- API and local LLM providers can be switched through configuration.
- Conversations are persisted and retrievable.

But still ask me before any major move or decision