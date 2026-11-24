"""Local Mithi v2 Flash TTS as a Pipecat service.

Mithi is a small local model (11 Indian languages, 10 voices, 24 kHz mono, Apache-2.0).
It is *not* a streaming API: ``synthesize()`` returns a whole sentence at once as a
float32 numpy array. We convert that to 16-bit PCM and feed it to the pipeline in
small frames, the same shape Speechify produced.

The heavy dependencies (torch, transformers, espeak, ...) are imported lazily so
importing the pipeline stays cheap. Fallback to a hosted voice is not this
service's job: ``TTS_PROVIDER`` names the chain and
:class:`~app.voice.providers.fallback.FallbackTTSService` switches when a
sentence fails.

Device selection: ``TTS_MITHI_DEVICE=auto`` prefers CUDA when available,
otherwise CPU. A failed GPU load retries once on CPU before giving up and
falling back to Speechify.
"""

from __future__ import annotations

import asyncio
import importlib.util
import logging
import sys
import threading
from collections.abc import AsyncGenerator
from pathlib import Path
from types import ModuleType

from pipecat.frames.frames import Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService

from app.voice.text import strip_emoji

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000
# 50 ms of 16-bit mono audio at 24 kHz. Must be an even number of bytes.
FRAME_BYTES = int(SAMPLE_RATE * 0.05) * 2

def _pick_device(torch, preferred: str) -> str:
    """Resolve the configured device to one torch actually has available."""
    if preferred != "auto":
        return preferred
    return "cuda" if torch.cuda.is_available() else "cpu"


def _import_run_module(model_dir: Path) -> ModuleType:
    """Import the model's self-contained ``run.py`` from the downloaded folder.

    That file embeds its own Python package (via a meta path finder) and exposes
    ``Mithi``. Loading it by path avoids copying ~6k generated lines into the repo.
    """
    run_py = model_dir / "run.py"
    if not run_py.is_file():
        raise FileNotFoundError(
            f"Mithi run.py not found at {run_py}. "
            "Run: uv run hf download Oomni/mithi-v2-flash "
            f"--local-dir {model_dir}"
        )
    spec = importlib.util.spec_from_file_location("mithi_v2_flash_run", run_py)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot import {run_py}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _to_pcm16(audio) -> bytes:
    """Mithi returns float32 in [-1, 1]; Pipecat wants little-endian S16LE."""
    import numpy as np

    samples = np.asarray(audio, dtype=np.float32)
    samples = np.clip(samples, -1.0, 1.0)
    return (samples * 32767.0).astype("<i2").tobytes()


def _pcm_chunks(pcm: bytes):
    for start in range(0, len(pcm), FRAME_BYTES):
        yield pcm[start : start + FRAME_BYTES]


# Loading takes 1-3 s and a new service is built for every call, so the model
# lives for the process. The key makes a changed device/path reload instead of
# silently reusing a model that no longer matches the config.
_MODEL: tuple[tuple[str, str, int], object] | None = None
_MODEL_LOCK = threading.Lock()


def _load_model(model_dir: Path, device: str, threads: int):
    """Blocking model load, always run in a worker thread."""
    import torch

    if threads:
        torch.set_num_threads(threads)

    run_module = _import_run_module(model_dir)
    chosen = _pick_device(torch, device)
    logger.info("Loading Mithi TTS from %s on %s", model_dir, chosen)
    try:
        tts = run_module.Mithi(str(model_dir), device=chosen)
    except Exception as exc:
        if chosen == "cpu":
            raise
        # CPU always works; a GPU load can fail for driver/runtime reasons.
        logger.warning("Mithi failed on %s (%s); retrying on CPU", chosen, exc)
        chosen = "cpu"
        tts = run_module.Mithi(str(model_dir), device=chosen)
    logger.info("Mithi TTS ready on %s", chosen)
    return tts


def _shared_model(model_dir: Path, device: str, threads: int):
    """Load once per process, then hand every caller the same model."""
    global _MODEL
    key = (str(model_dir), device, threads)
    if _MODEL is None or _MODEL[0] != key:
        with _MODEL_LOCK:
            if _MODEL is None or _MODEL[0] != key:
                _MODEL = (key, _load_model(model_dir, device, threads))
    return _MODEL[1]


class MithiTTSService(TTSService):
    """Bengali/local TTS backed by the Mithi v2 Flash model."""

    def __init__(
        self,
        *,
        model_dir: str = "models/mithi-v2-flash",
        voice: str = "ahana",
        language: str = "bn",
        device: str = "auto",
        threads: int = 0,
        **kwargs,
    ):
        super().__init__(
            sample_rate=SAMPLE_RATE,
            settings=TTSSettings(model="mithi-v2-flash", voice=voice, language=language),
            text_transforms=[("*", strip_emoji)],
            **kwargs,
        )
        self._model_dir = Path(model_dir)
        self._device = device
        self._threads = threads
        self._model = None

    async def _get_model(self):
        if self._model is None:
            self._model = await asyncio.to_thread(
                _shared_model, self._model_dir, self._device, self._threads
            )
        return self._model

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        model = await self._get_model()
        audio = await asyncio.to_thread(
            model.synthesize,
            text,
            lang=self._settings.language,
            voice=self._settings.voice,
        )

        for chunk in _pcm_chunks(_to_pcm16(audio)):
            # Mithi generates the whole sentence before the first byte exists,
            # so TTFB here means "first frame handed to the transport".
            await self.stop_ttfb_metrics()
            yield TTSAudioRawFrame(
                audio=chunk,
                sample_rate=SAMPLE_RATE,
                num_channels=1,
                context_id=context_id,
            )
