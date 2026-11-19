"""Speech with the next provider when one fails.

The primary service is still the pipeline's TTS stage; this wrapper only adds
"if this sentence can't be synthesized, speak it with the next one". Failures
are per sentence, so one broken provider does not end the call.

A sentence that already produced audio is never retried: restarting mid-sentence
would repeat the beginning, so the rest of that sentence is dropped instead.
"""

from collections.abc import AsyncGenerator

from loguru import logger
from pipecat.frames.frames import Frame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService

from app.voice.text import strip_emoji


class FallbackTTSService(TTSService):
    """Delegate synthesis to ``primary``, then to ``fallback`` on failure."""

    def __init__(
        self, *, primary: TTSService, fallback: TTSService, **kwargs
    ) -> None:
        settings = primary.settings
        # ``sample_rate`` only reports a value after setup; the declared rate is
        # what the base class needs at construction time (TTSService treats 0 as
        # "use the transport rate", which would mismatch the frames the inner
        # provider emits).
        declared_rate = getattr(primary, "_init_sample_rate", 0) or primary.sample_rate
        # The wrapper aggregates sentences (its run_tts is what the base class
        # calls), so it needs the primary's voice/language for tokenization and
        # the shared text cleanup; the inner services' own settings stay theirs.
        super().__init__(
            sample_rate=declared_rate or None,
            settings=TTSSettings(
                model=settings.model,
                voice=settings.voice,
                language=settings.language,
            ),
            text_transforms=[("*", strip_emoji)],
            **kwargs,
        )
        self._primary_tts = primary
        self._fallback_tts = fallback

    async def run_tts(
        self, text: str, context_id: str
    ) -> AsyncGenerator[Frame | None, None]:
        spoke = False
        try:
            async for frame in self._primary_tts.run_tts(text, context_id):
                spoke = True
                yield frame
            return
        except Exception as exc:
            if spoke:
                logger.warning(
                    f"TTS failed mid-sentence ({type(exc).__name__}: {exc}); "
                    "not retrying this sentence"
                )
                return
            logger.warning(
                f"TTS failed ({type(exc).__name__}: {exc}); "
                f"falling back to {type(self._fallback_tts).__name__}"
            )

        async for frame in self._fallback_tts.run_tts(text, context_id):
            yield frame

    async def cleanup(self) -> None:
        for service in (self._primary_tts, self._fallback_tts):
            try:
                await service.cleanup()
            except Exception as exc:
                logger.warning(
                    f"cleanup of {type(service).__name__} failed: "
                    f"{type(exc).__name__}: {exc}"
                )
        await super().cleanup()
