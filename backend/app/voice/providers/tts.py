"""TTS providers.

``mithi`` is the local model (default); ``speechify`` is the hosted fallback.
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

tts_providers: ProviderRegistry[TTSConfig, TTSService] = ProviderRegistry("TTS")


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
