"""In-memory mirror of tool toggles, refreshed at each call start."""

from datetime import datetime

from sqlalchemy import select

from app.knowledge.db import SessionLocal
from app.knowledge.models import ToolToggle

disabled_tools: set[str] = set()


async def load_disabled() -> None:
    async with SessionLocal() as session:
        names = (
            await session.execute(select(ToolToggle.name).where(ToolToggle.enabled.is_(False)))
        ).scalars().all()
    disabled_tools.clear()
    disabled_tools.update(names)


def enabled_tools() -> list:
    from app.voice.tools import TOOLS

    return [tool for tool in TOOLS if tool.__name__ not in disabled_tools]


async def ensure_rows(names: list[str]) -> None:
    """Missing rows mean 'enabled'; materialize them so admin and DB agree."""
    async with SessionLocal() as session:
        existing = set((await session.execute(select(ToolToggle.name))).scalars().all())
        missing = [name for name in names if name not in existing]
        if missing:
            session.add_all(ToolToggle(name=name, enabled=True) for name in missing)
            await session.commit()


async def set_enabled(name: str, enabled: bool) -> None:
    async with SessionLocal() as session:
        toggle = await session.get(ToolToggle, name)
        if toggle is None:
            session.add(ToolToggle(name=name, enabled=enabled, updated_at=datetime.utcnow()))
        else:
            toggle.enabled = enabled
            toggle.updated_at = datetime.utcnow()
        await session.commit()
    if enabled:
        disabled_tools.discard(name)
    else:
        disabled_tools.add(name)
