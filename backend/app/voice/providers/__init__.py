"""Build each voice component from configuration.

The pipeline calls only these functions: no provider names, env reads, or
pipecat service classes live in :mod:`app.voice.pipeline`. Each ``build_*``
resolves its preference chain from :mod:`app.voice.settings` and raises
:class:`~app.voice.providers.base.ProviderUnavailable` when nothing in the
chain can run, with a message naming what was tried.
"""

from loguru import logger
from pipecat.audio.vad.vad_analyzer import VADAnalyzer
from pipecat.services.llm_service import LLMService
from pipecat.services.stt_service import STTService
from pipecat.services.tts_service import TTSService

from app.voice.providers.base import ProviderUnavailable
from app.voice.providers.fallback import FallbackTTSService
from app.voice.providers.llm import llm_providers
from app.voice.providers.stt import stt_providers
from app.voice.providers.tts import tts_providers
from app.voice.providers.turn import TurnDetector, turn_providers
from app.voice.providers.vad import vad_providers
from app.voice.settings import (
    LLMConfig,
    STTConfig,
    TTSConfig,
    TurnConfig,
    VADConfig,
)

__all__ = [
    "ProviderUnavailable",
    "TurnDetector",
    "build_llm",
    "build_stt",
    "build_tts",
    "build_turn",
    "build_vad",
]


def build_stt(config: STTConfig) -> STTService:
    """Speech-to-text service (``STT_PROVIDER``)."""
    return stt_providers.resolve(config.providers, config)[1]


def build_llm(config: LLMConfig, *, system_instruction: str = "") -> LLMService:
    """LLM service (``LLM_PROVIDER``), returning the first reachable provider."""
    return llm_providers.resolve(
        config.providers, config, system_instruction=system_instruction
    )[1]


def build_vad(config: VADConfig) -> VADAnalyzer:
    """Voice-activity detector (``VAD_PROVIDER``)."""
    return vad_providers.resolve(config.providers, config)[1]


def build_turn(config: TurnConfig) -> TurnDetector:
    """Turn detector (``TURN_PROVIDER``)."""
    return turn_providers.resolve(config.providers, config)[1]


def build_tts(config: TTSConfig) -> TTSService:
    """TTS service (``TTS_PROVIDER``), with the remaining chain as fallbacks."""
    built = tts_providers.build_all(config.providers, config)
    logger.info("TTS chain: " + " -> ".join(name for name, _ in built))

    service: TTSService = built[-1][1]
    for _, primary in reversed(built[:-1]):
        service = FallbackTTSService(primary=primary, fallback=service)
    return service
