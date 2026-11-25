"""Hybrid retrieval: pgvector cosine + Postgres full-text, fused with RRF."""

from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import Integer, bindparam, select, text

from app.knowledge.db import SessionLocal
from app.knowledge.embedding import embed
from app.knowledge.models import Chunk, Document
from app.voice.settings import KnowledgeConfig

NO_ANSWER = "আমার কাছে এই তথ্য নেই।"


def _rrf(rankings: list[list[UUID]], k: int) -> dict[UUID, float]:
    scores: dict[UUID, float] = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking, start=1):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return scores


async def search(query: str) -> list[dict[str, str]]:
    config = KnowledgeConfig.from_env()
    vector = (await embed([query], query=True))[0]

    vector_sql = text(
        "SELECT id, 1 - (embedding <=> :q) AS score FROM chunks "
        "ORDER BY embedding <=> :q LIMIT :k"
    ).bindparams(bindparam("q", type_=Vector(config.embedding_dim)), bindparam("k", type_=Integer))
    fts_sql = text(
        "SELECT id FROM chunks WHERE search @@ plainto_tsquery('simple', :q) "
        "ORDER BY ts_rank_cd(search, plainto_tsquery('simple', :q)) DESC LIMIT :k"
    ).bindparams(bindparam("q"), bindparam("k", type_=Integer))

    async with SessionLocal() as session:
        dense = (await session.execute(vector_sql, {"q": vector, "k": config.candidate_k})).all()
        sparse = (await session.execute(fts_sql, {"q": query, "k": config.candidate_k})).all()

        best_dense = max((row.score for row in dense), default=0.0)
        # A pure lexical hit is not evidence: "invoice" matches English text in
        # unrelated documents. Every answer must clear the dense gate.
        if best_dense < config.min_score:
            return []

        fused = sorted(
            _rrf([[row.id for row in dense], [row.id for row in sparse]], config.rrf_k).items(),
            key=lambda item: item[1],
            reverse=True,
        )
        ids = [chunk_id for chunk_id, _ in fused]
        if not ids:
            return []

        rows = (
            await session.execute(
                select(Chunk.id, Chunk.document_id, Chunk.content, Document.title, Document.source_uri)
                .join(Document, Chunk.document_id == Document.id)
                .where(Chunk.id.in_(ids))
            )
        ).all()
        by_id = {row[0]: row for row in rows}
        ranked = [by_id[chunk_id] for chunk_id in ids if chunk_id in by_id]
        if not ranked:
            return []

        # Stay inside one document: mixing invoice + receipt + CV confuses the
        # small LLM into abstaining. Two chunks, capped, are enough to answer.
        best_document = ranked[0][1]
        picked = [row for row in ranked if row[1] == best_document][:2]
        return [
            {
                "content": row[2][:1200],
                "title": row[3],
                "source_uri": row[4],
            }
            for row in picked
        ]
