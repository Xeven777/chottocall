"""ChottoCall API: serves browser voice sessions over WebRTC."""

import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
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

from app.voice.pipeline import build_pipeline
from app.voice.providers.base import ProviderUnavailable
from app.voice.settings import LLMConfig

app = FastAPI(title="ChottoCall API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

handler = SmallWebRTCRequestHandler()
_tasks: set[asyncio.Task] = set()


async def run_bot(connection) -> None:
    transport = SmallWebRTCTransport(
        connection,
        params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    )
    try:
        pipeline = build_pipeline(transport)
    except ProviderUnavailable as exc:
        # A missing provider is a configuration problem, not a per-call one:
        # log it plainly and drop the peer connection instead of leaving a
        # half-open session (the request fails so the client can retry).
        logger.error(f"cannot start the voice pipeline: {exc}")
        await connection.disconnect()
        raise

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True),
    )

    async def run() -> None:
        runner = WorkerRunner(handle_sigint=False)
        await runner.add_workers(worker)
        await runner.run()

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
