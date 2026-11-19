"""Voice activity detection providers."""

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADAnalyzer

from app.voice.providers.base import ProviderRegistry
from app.voice.settings import VADConfig

vad_providers: ProviderRegistry[VADConfig, VADAnalyzer] = ProviderRegistry("VAD")


@vad_providers.register("silero")
def build_silero(config: VADConfig) -> VADAnalyzer:
    """Silero VAD, shipped with pipecat (ONNX, no API key)."""
    return SileroVADAnalyzer()
