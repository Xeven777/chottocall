"""Persist a call's transcript into Postgres as it happens."""

from uuid import UUID

from loguru import logger
from pipecat.frames.frames import TTSTextFrame, TranscriptionFrame
from pipecat.observers.base_observer import BaseObserver, FramePushed

from app.knowledge.db import SessionLocal
from app.knowledge.models import Message


class TranscriptRecorder(BaseObserver):
    def __init__(self, session_id: UUID, **kwargs):
        super().__init__(observe_every_push=False, **kwargs)
        self.session_id = session_id

    async def on_push_frame(self, data: FramePushed) -> None:
        frame = data.frame
        if isinstance(frame, TranscriptionFrame):
            await self._write("user", frame.text)
        elif isinstance(frame, TTSTextFrame):
            await self._write("bot", frame.text)

    async def _write(self, role: str, text: str) -> None:
        # Observers are torn down with the worker; one failed write must not
        # kill the observer task and lose the rest of the call.
        try:
            async with SessionLocal() as session:
                session.add(Message(session_id=self.session_id, role=role, text=text))
                await session.commit()
        except Exception:
            logger.exception(f"could not store {role} message for session {self.session_id}")
