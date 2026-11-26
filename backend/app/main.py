"""ChottoCall API: serves browser voice sessions over WebRTC."""

import asyncio
import os
from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text, update
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pipecat.frames.frames import EndFrame
from pipecat.observers.function_call_observer import FunctionCallObserver
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from app.knowledge.db import SessionLocal
from app.knowledge.ingest import ingest_path
from app.knowledge.models import Chunk, Document, Message, Session, ToolToggle
from app.knowledge.recorder import TranscriptRecorder
from app.knowledge.registry import ensure_rows, load_disabled, set_enabled
from app.voice.pipeline import build_pipeline
from app.voice.providers.base import ProviderUnavailable
from app.voice.settings import KnowledgeConfig, LLMConfig
from app.voice.tools import TOOLS

app = FastAPI(title="ChottoCall API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

handler = SmallWebRTCRequestHandler()
_tasks: set[asyncio.Task] = set()


def _tool_logger() -> FunctionCallObserver:
    """Log every tool call at INFO: name, arguments, outcome, and how long it ran."""
    observer = FunctionCallObserver(include_results=True)

    @observer.event_handler("on_function_call_event")
    async def on_function_call_event(_observer, event):
        ran = f" ({event.timestamp - event.in_progress_at:.1f}s)" if event.in_progress_at else ""
        logger.info(
            f"tool {event.function_name} {event.kind}{ran}"
            f" args={event.arguments} result={event.result} error={event.error}"
        )

    return observer


async def run_bot(connection) -> None:
    transport = SmallWebRTCTransport(
        connection,
        params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    )
    await load_disabled()
    try:
        pipeline = build_pipeline(transport)
    except ProviderUnavailable as exc:
        # A missing provider is a configuration problem, not a per-call one:
        # log it plainly and drop the peer connection instead of leaving a
        # half-open session (the request fails so the client can retry).
        logger.error(f"cannot start the voice pipeline: {exc}")
        await connection.disconnect()
        raise

    session_id = uuid4()
    async with SessionLocal() as db:
        db.add(Session(id=session_id))
        await db.commit()

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True),
        observers=[_tool_logger(), TranscriptRecorder(session_id)],
    )

    # SmallWebRTC does not push EndFrame on its own when the peer leaves; without
    # this the pipeline never ends and the session's ended_at is never set.
    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        if not worker.has_finished():
            await worker.queue_frame(EndFrame())

    async def run() -> None:
        runner = WorkerRunner(handle_sigint=False)
        await runner.add_workers(worker)
        await runner.run()
        # Runs after the worker is gone, so observer cleanup can't cancel it.
        async with SessionLocal() as db:
            await db.execute(
                update(Session).where(Session.id == session_id).values(ended_at=func.now())
            )
            await db.commit()

    # Must return before the SDP answer is sent, so the pipeline runs detached.
    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# OpenAI-style probe (opencode/IDE clients hit this). Not an LLM endpoint —
# the voice pipeline uses a local LLM (llama.cpp/Ollama, Groq fallback); this only silences the 404.
@app.get("/v1/models")
async def list_models() -> dict:
    return {
        "object": "list",
        "data": [
            {
                "id": LLMConfig.from_env().groq_model,
                "object": "model",
                "owned_by": "chottocall",
            }
        ],
    }


@app.get("/v1/models/{model_id:path}")
async def get_model(model_id: str) -> dict:
    return {"id": model_id, "object": "model", "owned_by": "chottocall"}


@app.post("/api/offer")
async def offer(request: Request) -> dict[str, str] | None:
    return await handler.handle_web_request(
        SmallWebRTCRequest.from_dict(await request.json()), run_bot
    )


@app.patch("/api/offer")
async def ice_candidates(request: Request) -> dict[str, str]:
    body = await request.json()
    await handler.handle_patch_request(
        SmallWebRTCPatchRequest(
            pc_id=body["pc_id"],
            candidates=[IceCandidate(**c) for c in body["candidates"]],
        )
    )
    return {"status": "ok"}


# shortcut: no admin auth — localhost only; add a token before exposing this app.
@app.get("/api/admin/stack")
async def admin_stack() -> dict:
    config = KnowledgeConfig.from_env()
    db_ok = False
    embed_ok = False
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            embed_ok = (await client.get(f"{config.embedding_base_url}/models")).status_code == 200
    except Exception:
        pass
    async with SessionLocal() as session:
        documents = (await session.execute(select(func.count()).select_from(Document))).scalar_one()
        chunks = (await session.execute(select(func.count()).select_from(Chunk))).scalar_one()
    return {
        "stack": [
            {"layer": "Frontend", "name": "Next.js"},
            {"layer": "Transport", "name": "Pipecat + WebRTC"},
            {"layer": "Backend", "name": "FastAPI"},
            {"layer": "Embeddings", "name": "EmbeddingGemma 2 (Q8_0)"},
            {"layer": "Parsing", "name": "pypdfium2"},
            {"layer": "Database", "name": "PostgreSQL + pgvector (Neon)"},
        ],
        "status": {
            "database": db_ok,
            "embeddings": embed_ok,
            "documents": documents,
            "chunks": chunks,
            "llm": LLMConfig.from_env().providers,
            "embedding": config.embedding_model,
        },
    }


@app.post("/api/admin/knowledge")
async def upload_knowledge(file: UploadFile = File(...)) -> dict:
    config = KnowledgeConfig.from_env()
    uploads = Path(config.upload_dir)
    uploads.mkdir(parents=True, exist_ok=True)
    name = Path(file.filename or "upload.pdf").name
    path = uploads / f"{uuid4()}_{name}"
    raw = await file.read()
    path.write_bytes(raw)
    return await ingest_path(path, title=name, raw=raw)


@app.get("/api/admin/knowledge")
async def list_knowledge() -> list[dict]:
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(
                    Document.id,
                    Document.title,
                    Document.source_uri,
                    Document.created_at,
                    func.count(Chunk.id).label("chunks"),
                )
                .outerjoin(Chunk, Chunk.document_id == Document.id)
                .group_by(Document.id)
                .order_by(Document.created_at.desc())
            )
        ).all()
    return [
        {
            "id": str(row[0]),
            "title": row[1],
            "source_uri": row[2],
            "created_at": row[3].isoformat(),
            "chunks": row[4],
        }
        for row in rows
    ]


@app.delete("/api/admin/knowledge/{document_id}")
async def delete_knowledge(document_id: UUID) -> dict[str, str]:
    async with SessionLocal() as session:
        result = await session.execute(
            delete(Document).where(Document.id == document_id).returning(Document.id)
        )
        removed = result.first()
        await session.commit()
    if removed is None:
        raise HTTPException(status_code=404, detail="document not found")
    return {"status": "ok"}


class ToolState(BaseModel):
    enabled: bool


@app.get("/api/admin/tools")
async def list_tools() -> list[dict]:
    names = [tool.__name__ for tool in TOOLS]
    await ensure_rows(names)
    async with SessionLocal() as session:
        toggles = {
            row[0]: row[1]
            for row in (await session.execute(select(ToolToggle.name, ToolToggle.enabled))).all()
        }
    return [{"name": name, "enabled": toggles.get(name, True)} for name in names]


@app.patch("/api/admin/tools/{name}")
async def update_tool(name: str, state: ToolState) -> dict:
    if name not in {tool.__name__ for tool in TOOLS}:
        raise HTTPException(status_code=404, detail="tool not found")
    await set_enabled(name, state.enabled)
    return {"name": name, "enabled": state.enabled}


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@app.get("/api/admin/sessions")
async def list_sessions() -> list[dict]:
    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(
                    Session.id,
                    Session.started_at,
                    Session.ended_at,
                    func.count(Message.id).label("messages"),
                )
                .outerjoin(Message, Message.session_id == Session.id)
                .group_by(Session.id)
                .order_by(Session.started_at.desc())
                .limit(50)
            )
        ).all()
    return [
        {
            "id": str(row[0]),
            "started_at": row[1].isoformat(),
            "ended_at": _iso(row[2]),
            "messages": row[3],
        }
        for row in rows
    ]


@app.get("/api/admin/sessions/{session_id}")
async def get_session(session_id: UUID) -> dict:
    async with SessionLocal() as session:
        row = (
            await session.execute(
                select(Session.id, Session.started_at, Session.ended_at).where(
                    Session.id == session_id
                )
            )
        ).first()
        if row is None:
            raise HTTPException(status_code=404, detail="session not found")
        messages = (
            await session.execute(
                select(Message.id, Message.role, Message.text, Message.at)
                .where(Message.session_id == session_id)
                .order_by(Message.id)
            )
        ).all()
    return {
        "id": str(row[0]),
        "started_at": row[1].isoformat(),
        "ended_at": _iso(row[2]),
        "messages": [
            {"id": m[0], "role": m[1], "text": m[2], "at": m[3].isoformat()} for m in messages
        ],
    }


@app.delete("/api/admin/sessions/{session_id}")
async def delete_session(session_id: UUID) -> dict[str, str]:
    async with SessionLocal() as session:
        result = await session.execute(
            delete(Session).where(Session.id == session_id).returning(Session.id)
        )
        removed = result.first()
        await session.commit()
    if removed is None:
        raise HTTPException(status_code=404, detail="session not found")
    return {"status": "ok"}
