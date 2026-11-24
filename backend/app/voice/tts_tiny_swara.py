"""tiny-swara ONNX TTS as a Pipecat service.

The model folder is self-contained — ``inference.py``, ONNX weights, config and
the Bengali phonemizer frontend — so it is imported by path, like Mithi's
``run.py``. Audio is 24 kHz mono; it goes through the same PCM16 framing as the
other local provider before reaching the transport.
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from collections.abc import AsyncGenerator
from pathlib import Path

from pipecat.frames.frames import Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService

from app.voice.text import strip_emoji
from app.voice.tts_mithi import _pcm_chunks, _to_pcm16

SAMPLE_RATE = 24000


def _load_service_class(model_dir: Path):
    """Load inference.py by path; its ``tiny_voca`` import needs the folder on sys.path."""
    inference = model_dir / "inference.py"
    spec = importlib.util.spec_from_file_location("tiny_swara_inference", inference)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot import {inference}")
    if str(model_dir) not in sys.path:
        sys.path.insert(0, str(model_dir))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(spec.name, None)
        raise
    return module.TinySwara


class TinySwaraTTSService(TTSService):
    """Local Bengali TTS backed by the tiny-swara ONNX model."""

    def __init__(
        self,
        *,
        model_dir: str = "models/tiny-swara",
        model: str = "",
        voice: str = "BM",
        speed: float = 1.0,
        **kwargs,
    ):
        super().__init__(
            sample_rate=SAMPLE_RATE,
            settings=TTSSettings(model="tiny-swara", voice=voice, language="bn"),
            text_transforms=[("*", strip_emoji)],
            **kwargs,
        )
        self._model_dir = Path(model_dir)
        self._model = model or None
        self._speed = speed

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        def synthesize():
            service = _load_service_class(self._model_dir)
            tts = service(model=self._model, voice=self._settings.voice, speed=self._speed)
            return tts.synthesize(text)

        audio = await asyncio.to_thread(synthesize)
        for chunk in _pcm_chunks(_to_pcm16(audio)):
            await self.stop_ttfb_metrics()
            yield TTSAudioRawFrame(
                audio=chunk,
                sample_rate=SAMPLE_RATE,
                num_channels=1,
                context_id=context_id,
            )
