"""Async SQLAlchemy engine for the single knowledge/state database."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.voice.settings import KnowledgeConfig


def _async_url(url: str) -> str:
    parts = urlsplit(url)
    scheme = "postgresql+asyncpg" if parts.scheme == "postgresql" else parts.scheme
    # asyncpg takes SSL through connect_args, not URL query parameters.
    query = urlencode(
        [(k, v) for k, v in parse_qsl(parts.query) if k not in {"sslmode", "channel_binding"}]
    )
    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


config = KnowledgeConfig.from_env()
engine = create_async_engine(
    _async_url(config.database_url), connect_args={"ssl": "require"}, pool_pre_ping=True
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
