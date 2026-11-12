"""Speechify text-to-speech as a Pipecat service.

Asks for raw PCM rather than MP3 so chunks can go straight into audio frames;
decoding MP3 would add a stage and defeat the point of streaming.
"""

from collections.abc import AsyncGenerator

import re

import httpx
from pipecat.frames.frames import Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService

SAMPLE_RATE = 24000

# Emoji are stripped before synthesis: the small local LLM keeps emitting them
# despite the system prompt, and Speechify renders them as garbage or silence.
_EMOJI_RE = re.compile(
    r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u20E3]"
)


def _strip_emoji(text: str, text_type: str) -> str:
    return re.sub(r"  +", " ", _EMOJI_RE.sub("", text)).strip()


class SpeechifyTTSService(TTSService):
    """Bengali TTS via Speechify's streaming endpoint."""

    def __init__(
        self,
        *,
        api_key: str,
        voice_id: str = "ritwik",
        model: str = "simba-3.5",  # simba-3.2 is English-only
        language: str = "bn-IN",
        **kwargs,
    ):
        super().__init__(
            sample_rate=SAMPLE_RATE,
            settings=TTSSettings(model=model, voice=voice_id, language=language),
            text_transforms=[("*", _strip_emoji)],
            **kwargs,
        )
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=60)

    async def cleanup(self):
        await self._client.aclose()
        await super().cleanup()

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        payload = {
            "input": text,
            "voice_id": self._settings.voice,
            "model": self._settings.model,
            "language": self._settings.language,
            "output_format": "pcm_24000",
        }
        pending = b""
        async with self._client.stream(
            "POST",
            "https://api.speechify.ai/v1/audio/stream",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json=payload,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                pending += chunk
                usable = len(pending) - len(pending) % 2  # whole 16-bit samples only
                if not usable:
                    continue
                await self.stop_ttfb_metrics()
                yield TTSAudioRawFrame(
                    audio=pending[:usable],
                    sample_rate=SAMPLE_RATE,
                    num_channels=1,
                    context_id=context_id,
                )
                pending = pending[usable:]
