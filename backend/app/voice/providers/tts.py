"""TTS providers.

``tiny-swara`` (default) and ``mithi`` are local models; ``speechify`` is the hosted fallback.
Availability is decided before construction, so a machine without the model
skips loading torch entirely. When more than one provider in the chain is
available, the build keeps them all and wraps them in a
:class:`~app.voice.providers.fallback.FallbackTTSService`.
"""

from pathlib import Path

from pipecat.services.tts_service import TTSService

from app.voice.providers.base import ProviderRegistry
from app.voice.settings import TTSConfig
from app.voice.tts_mithi import MithiTTSService
from app.voice.tts_speechify import SpeechifyTTSService
from app.voice.tts_tiny_swara import TinySwaraTTSService

tts_providers: ProviderRegistry[TTSConfig, TTSService] = ProviderRegistry("TTS")


def _tiny_swara_ready(config: TTSConfig) -> bool:
    """inference.py and its ONNX weights must both be present."""
    root = Path(config.tiny_swara_dir)
    if config.tiny_swara_model:
        model = Path(config.tiny_swara_model)
        if not model.is_absolute():
            model = root / model
    else:
        model = root / "onnx/tiny-swara-int8.onnx"
    return (root / "inference.py").is_file() and model.is_file()


@tts_providers.register("tiny-swara", available=_tiny_swara_ready)
def build_tiny_swara(config: TTSConfig) -> TTSService:
    return TinySwaraTTSService(
        model_dir=config.tiny_swara_dir,
        model=config.tiny_swara_model,
        voice=config.tiny_swara_voice,
        speed=config.tiny_swara_speed,
    )


def _mithi_ready(config: TTSConfig) -> bool:
    """The model's ``run.py`` is what makes a local Mithi install loadable."""
    return (Path(config.mithi_model_dir) / "run.py").is_file()


@tts_providers.register("mithi", available=_mithi_ready)
def build_mithi(config: TTSConfig) -> TTSService:
    return MithiTTSService(
        model_dir=config.mithi_model_dir,
        voice=config.mithi_voice,
        language=config.mithi_lang,
        device=config.mithi_device,
        threads=config.mithi_threads,
    )


@tts_providers.register(
    "speechify", available=lambda config: bool(config.speechify_api_key)
)
def build_speechify(config: TTSConfig) -> TTSService:
    return SpeechifyTTSService(
        api_key=config.speechify_api_key,
        voice_id=config.speechify_voice,
        model=config.speechify_model,
        language=config.speechify_language,
    )
