"""Speech-to-text providers."""

from pipecat.services.stt_service import STTService

from app.voice.providers.base import ProviderRegistry
from app.voice.settings import STTConfig
from app.voice.stt_shruti import ShrutiSTTService

stt_providers: ProviderRegistry[STTConfig, STTService] = ProviderRegistry("STT")


@stt_providers.register("shruti")
def build_shruti(config: STTConfig) -> STTService:
    """Local Bengali STT (cactus Whistle + Shruti weights); downloads on first use."""
    return ShrutiSTTService(weights=config.shruti_weights)
