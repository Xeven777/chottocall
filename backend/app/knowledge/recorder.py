"""Persist a call's transcript into Postgres when the pipeline ends."""

from datetime import datetime
from uuid import UUID

from pipecat.frames.frames import EndFrame, TTSTextFrame, TranscriptionFrame
from pipecat.observers.base_observer import BaseObserver, FramePushed
from sqlalchemy import update

from app.knowledge.db import SessionLocal
from app.knowledge.models import Message, Session


class TranscriptRecorder(BaseObserver):
    def __init__(self, session_id: UUID, **kwargs):
        super().__init__(observe_every_push=False, **kwargs)
        self.session_id = session_id
        self.pending: list[dict[str, str]] = []

    async def on_push_frame(self, data: FramePushed) -> None:
        frame = data.frame
        if isinstance(frame, TranscriptionFrame):
            self.pending.append({"role": "user", "text": frame.text})
        elif isinstance(frame, TTSTextFrame):
            self.pending.append({"role": "bot", "text": frame.text})
        elif isinstance(frame, EndFrame) and self.pending:
            async with SessionLocal() as session:
                session.add_all(
                    Message(session_id=self.session_id, **message) for message in self.pending
                )
                await session.execute(
                    update(Session)
                    .where(Session.id == self.session_id)
                    .values(ended_at=datetime.utcnow())
                )
                await session.commit()
            self.pending.clear()
