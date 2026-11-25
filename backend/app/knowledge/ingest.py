"""PDF/Markdown -> plain text -> sentence chunks -> embeddings -> Postgres.

    cd backend && uv run python -m app.knowledge.ingest path/to/file.pdf
"""

import asyncio
import hashlib
import re
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import pypdfium2 as pdfium
from sqlalchemy import delete, select

from app.knowledge.db import SessionLocal
from app.knowledge.embedding import embed
from app.knowledge.models import Chunk, Document
from app.voice.settings import KnowledgeConfig

_SENTENCE = re.compile(r"(?<=[।.!?])\s+|\n+")


def chunk_text(text: str, size: int) -> list[str]:
    chunks: list[str] = []
    current = ""
    for piece in _SENTENCE.split(text):
        piece = piece.strip()
        if not piece:
            continue
        if current and len(current) + len(piece) + 1 > size:
            chunks.append(current)
            current = piece
        else:
            current = f"{current} {piece}".strip()
    if current:
        chunks.append(current)
    return chunks


async def _to_markdown(path: Path) -> str:
    if path.suffix.lower() in {".md", ".markdown", ".txt", ".text"}:
        return path.read_text(encoding="utf-8", errors="replace")
    # Plain text extraction: no HF model download and no transformers/torchvision
    # import (torchvision 0.29 does not match this project's torch 2.15 CPU wheel).
    def read_pdf() -> str:
        document = pdfium.PdfDocument(str(path))
        pages = []
        for page in document:
            textpage = page.get_textpage()
            pages.append(textpage.get_text_range())
            textpage.close()
        document.close()
        return "\n\n".join(pages)

    return await asyncio.to_thread(read_pdf)


async def ingest_path(path: Path, *, title: str | None = None, raw: bytes | None = None) -> dict:
    config = KnowledgeConfig.from_env()
    if raw is None:
        raw = path.read_bytes()
    content_hash = hashlib.sha256(raw).hexdigest()
    markdown = await _to_markdown(path)
    chunks = chunk_text(markdown, config.chunk_chars)
    if not chunks:
        raise ValueError(f"no text found in {path.name}")

    async with SessionLocal() as session:
        existing = (
            await session.execute(select(Document).where(Document.content_hash == content_hash))
        ).scalar_one_or_none()
        if existing:
            document = existing
            document.title = title or path.name
            await session.execute(delete(Chunk).where(Chunk.document_id == document.id))
        else:
            document = Document(
                id=uuid4(),
                title=title or path.name,
                source_uri=path.name,
                content_hash=content_hash,
                created_at=datetime.utcnow(),
            )
            session.add(document)
        await session.flush()

        for start in range(0, len(chunks), 16):
            batch = chunks[start : start + 16]
            vectors = await embed(batch, query=False)
            session.add_all(
                Chunk(
                    id=uuid4(),
                    document_id=document.id,
                    ordinal=start + i,
                    content=text,
                    embedding=vector,
                )
                for i, (text, vector) in enumerate(zip(batch, vectors))
            )
        await session.commit()

    return {"document_id": str(document.id), "title": document.title, "chunks": len(chunks)}


async def _main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m app.knowledge.ingest <file>")
    path = Path(sys.argv[1])
    uploads = Path(KnowledgeConfig.from_env().upload_dir)
    if not path.exists() and (uploads / path.name).exists():
        path = uploads / path.name
    print(await ingest_path(path))


if __name__ == "__main__":
    asyncio.run(_main())
