"""Minimal ORM models. Schema is created by schema.sql, not by metadata."""

from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.knowledge.db import Base
from app.voice.settings import KnowledgeConfig

_EMBED_DIM = KnowledgeConfig.from_env().embedding_dim


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    source_uri: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    lang: Mapped[str] = mapped_column(Text, default="bn")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    ordinal: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    # `search` is a generated tsvector column; queries use raw SQL, so not mapped.
    embedding: Mapped[list[float]] = mapped_column(Vector(_EMBED_DIM))


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(default=None)
    locale: Mapped[str] = mapped_column(Text, default="bn")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    sources: Mapped[dict | None] = mapped_column(JSONB, default=None)
    at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ToolToggle(Base):
    __tablename__ = "tools"

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
