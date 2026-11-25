"""Embeddings from the local llama.cpp server, using EmbeddingGemma 2 prefixes."""

import math

import httpx

from app.voice.settings import KnowledgeConfig


_client: httpx.AsyncClient | None = None


async def _http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


def _truncate_normalize(vector: list[float], dim: int) -> list[float]:
    # Slicing a unit vector breaks its length; renormalize or scores silently lie.
    head = vector[:dim]
    norm = math.sqrt(sum(v * v for v in head)) or 1.0
    return [v / norm for v in head]


async def embed(texts: list[str], *, query: bool) -> list[list[float]]:
    """Embed queries with the search prefix, documents with the document prefix."""
    config = KnowledgeConfig.from_env()
    prefix = "task: search result | query: "
    prepared = [(prefix + t) if query else ("title: none | text: " + t) for t in texts]
    client = await _http_client()
    response = await client.post(
        f"{config.embedding_base_url}/embeddings",
        json={"model": config.embedding_model, "input": prepared},
    )
    response.raise_for_status()
    data = sorted(response.json()["data"], key=lambda item: item["index"])
    return [_truncate_normalize(item["embedding"], config.embedding_dim) for item in data]
