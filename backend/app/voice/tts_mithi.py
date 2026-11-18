"""Local Mithi v2 Flash TTS as a Pipecat service, with a Speechify fallback.

Mithi is a small local model (11 Indian languages, 10 voices, 24 kHz mono, Apache-2.0).
It is *not* a streaming API: ``synthesize()`` returns a whole sentence at once as a
float32 numpy array. We convert that to 16-bit PCM and feed it to the pipeline in
small frames, the same shape Speechify produced.

The heavy dependencies (torch, transformers, espeak, ...) are imported lazily so
importing the pipeline stays cheap. If the model files or runtime are missing,
this service falls back to Speechify instead of killing the call.

Device selection: ``TTS_MITHI_DEVICE=auto`` prefers CUDA, then an Intel Arc/XPU
GPU (``torch.xpu``), then CPU. If XPU is detected but the model fails to load on
it, we retry once on CPU before giving up and falling back to Speechify.
"""

from __future__ import annotations

import asyncio
import importlib.util
import logging
import sys
from collections.abc import AsyncGenerator
from pathlib import Path
from types import ModuleType

from pipecat.frames.frames import Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService

from app.voice.tts_speechify import SpeechifyTTSService, _strip_emoji

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000
# 50 ms of 16-bit mono audio at 24 kHz. Must be an even number of bytes.
FRAME_BYTES = int(SAMPLE_RATE * 0.05) * 2

# Ordered by preference when device="auto". CUDA is first for the benefit of
# anyone running this on an NVIDIA machine; Arc/XPU is the Intel path.
_DEVICE_CANDIDATES = ("cuda", "xpu", "cpu")


def _pick_device(torch, preferred: str) -> str:
    """Resolve the configured device to one torch actually has available."""
    if preferred != "auto":
        return preferred
    if torch.cuda.is_available():
        return "cuda"
    xpu = getattr(torch, "xpu", None)
    if xpu is not None and xpu.is_available():
        return "xpu"
    return "cpu"


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


class MithiTTSService(TTSService):
    """Bengali/local TTS: Mithi first, Speechify when Mithi can't produce audio."""

    def __init__(
        self,
        *,
        speechify_api_key: str = "",
        model_dir: str = "models/mithi-v2-flash",
        voice: str = "satvik",
        language: str = "bn",
        device: str = "auto",
        threads: int = 0,
        fallback: bool = True,
        **kwargs,
    ):
        super().__init__(
            sample_rate=SAMPLE_RATE,
            settings=TTSSettings(model="mithi-v2-flash", voice=voice, language=language),
            text_transforms=[("*", _strip_emoji)],
            **kwargs,
        )
        self._model_dir = Path(model_dir)
        self._device = device
        self._threads = threads
        self._model = None
        self._load_lock = asyncio.Lock()
        self._speechify = (
            SpeechifyTTSService(api_key=speechify_api_key)
            if fallback and speechify_api_key
            else None
        )

    def _load_model(self):
        """Blocking model load, run in a worker thread."""
        import torch

        if self._threads:
            torch.set_num_threads(self._threads)

        run_module = _import_run_module(self._model_dir)
        device = _pick_device(torch, self._device)
        logger.info("Loading Mithi TTS from %s on %s", self._model_dir, device)
        try:
            tts = run_module.Mithi(str(self._model_dir), device=device)
        except Exception as exc:
            if device != "xpu":
                raise
            # A broken/missing oneAPI runtime is common; CPU always works.
            logger.warning("Mithi failed on XPU (%s); retrying on CPU", exc)
            device = "cpu"
            tts = run_module.Mithi(str(self._model_dir), device=device)
        logger.info("Mithi TTS ready on %s", device)
        return tts

    async def _get_model(self):
        if self._model is None:
            async with self._load_lock:
                if self._model is None:
                    self._model = await asyncio.to_thread(self._load_model)
        return self._model

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        try:
            model = await self._get_model()
            audio = await asyncio.to_thread(
                model.synthesize,
                text,
                lang=self._settings.language,
                voice=self._settings.voice,
            )
        except Exception as exc:
            if self._speechify is None:
                raise
            logger.warning("Mithi TTS failed (%s); falling back to Speechify", exc)
            async for frame in self._speechify.run_tts(text, context_id):
                yield frame
            return

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

    async def cleanup(self):
        if self._speechify is not None:
            await self._speechify.cleanup()
        await super().cleanup()
