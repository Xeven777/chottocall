"""Mic -> speaker on this machine, for checking the pipeline without a browser.

    cd backend && uv run python -m app.voice.run
"""

import asyncio

from pipecat.observers.user_bot_latency_observer import UserBotLatencyObserver
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.transports.local.audio import LocalAudioTransport, LocalAudioTransportParams
from pipecat.workers.runner import WorkerRunner

from app.voice.pipeline import build_pipeline


async def main() -> None:
    transport = LocalAudioTransport(
        LocalAudioTransportParams(audio_in_enabled=True, audio_out_enabled=True)
    )

    latency = UserBotLatencyObserver()

    @latency.event_handler("on_latency_breakdown")
    async def on_latency_breakdown(observer, breakdown):
        for line in breakdown.turn_contribution_lines():
            print(line, flush=True)

    worker = PipelineWorker(
        build_pipeline(transport),
        params=PipelineParams(enable_metrics=True),
        observers=[latency],
    )
    runner = WorkerRunner(handle_sigint=True)
    await runner.add_workers(worker)
    await runner.run()


if __name__ == "__main__":
    asyncio.run(main())
