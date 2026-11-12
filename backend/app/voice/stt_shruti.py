"""Shruti Bengali speech-to-text as a Pipecat service.

cactus-compute's Whistle engine runs the udgamlabs/shruti-bengali weights on CPU.
Pipecat hands the service 16-bit PCM; cactus wants float samples in [-1, 1].
"""

import asyncio
import os
from collections.abc import AsyncGenerator

import cactus
import numpy as np
from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.services.settings import STTSettings
from pipecat.services.stt_service import SegmentedSTTService
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

HF_REPO = "udgamlabs/shruti-bengali"
HF_FILE = "shruti-bengali.cact"

_MODEL: cactus.Whistle | None = None


def _load(weights: str) -> cactus.Whistle:
    """One engine per process: it takes ~3s to load and cactus serializes calls anyway."""
    global _MODEL
    if _MODEL is None:
        _MODEL = cactus.Whistle(weights=ensure_weights(weights))
    return _MODEL


def ensure_weights(path: str) -> str:
    """Download the 30 MB model once if it is not on disk yet."""
    if not os.path.exists(path):
        from huggingface_hub import hf_hub_download

        hf_hub_download(HF_REPO, HF_FILE, local_dir=os.path.dirname(path))
    return path


class ShrutiSTTService(SegmentedSTTService):
    """Bengali STT with English code-switching, local and offline."""

    def __init__(self, weights: str = "models/shruti-bengali.cact", **kwargs):
        # Every settings field must be set, None included; Pipecat validates it.
        super().__init__(
            settings=STTSettings(model="shruti-bengali", language=None),
            ttfs_p99_latency=0.3,  # measured: ~0.26s on this machine
            **kwargs,
        )
        # Load at startup, not on the first turn: it takes ~3s.
        self._model = _load(weights)

    @property
    def wants_wav_segments(self) -> bool:
        # cactus reads float samples directly, so skip the WAV wrapper.
        return False

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None, None]:
        samples = np.frombuffer(audio, dtype="<i2").astype(np.float32) / 32768.0
        # Transcribe off the event loop; 0.3s of CPU work would stall the pipeline.
        result = await asyncio.to_thread(self._model.transcribe, samples)
        if text := result["text"].strip():
            yield TranscriptionFrame(text, self._user_id, time_now_iso8601(), Language.BN)
