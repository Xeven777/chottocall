"""Half-duplex mic gating: drop the mic while the bot talks.

There is no echo cancellation between this machine's speakers and its mic, so
the bot hears its own voice. Muting the mic during playback is the cheap fix.
It costs barge-in: speech during a reply is discarded, not queued.
"""

import asyncio

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    InputAudioRawFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class HalfDuplexProcessor(FrameProcessor):
    """Discard microphone audio from bot start until a tail after bot stop.

    There is no echo cancellation between this machine's speakers and its mic, so
    the bot hears its own voice. Muting the mic during playback is the cheap fix.
    It costs barge-in: speech during a reply is discarded, not queued.

    Set ``barge_in=True`` to keep the mic open during bot speech. When the
    pipeline uses turn detection with ``enable_interruptions=True`` (the default
    for the current SmartTurn wiring), the bot will still be interrupted when the
    user speaks again — the only difference is that the user's speech actually
    reaches VAD/STT while the bot is talking.
    """

    def __init__(
        self,
        tail_secs: float = 0.3,
        barge_in: bool = False,
        **kwargs,
    ):
        # The tail covers audio still sitting in the WebRTC playout buffer.
        super().__init__(**kwargs)
        self._tail_secs = tail_secs
        self._barge_in = barge_in
        self._muted = False
        self._unmute: asyncio.Task | None = None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, BotStartedSpeakingFrame):
            self._cancel_unmute()
            if not self._barge_in:
                self._muted = True
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self._cancel_unmute()
            self._unmute = asyncio.create_task(self._unmute_later())

        if self._muted and isinstance(frame, InputAudioRawFrame):
            return

        await self.push_frame(frame, direction)

    def _cancel_unmute(self):
        if self._unmute:
            self._unmute.cancel()
            self._unmute = None

    async def _unmute_later(self):
        await asyncio.sleep(self._tail_secs)
        self._muted = False
        self._unmute = None

    async def cleanup(self):
        self._cancel_unmute()
        await super().cleanup()
