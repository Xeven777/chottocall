"""Local-first LLM selection (Ollama or llama.cpp) with Groq fallback.

Env (checked at call time, so one .env for the whole deployment):
    LLM_PROVIDER=ollama|llama.cpp|groq   default llama.cpp
    OLLAMA_BASE_URL=http://localhost:11434/v1
    OLLAMA_MODEL=<name>                  optional; auto-discovered from the server when missing
    LLAMA_CPP_BASE_URL=http://localhost:8080/v1
    LLAMA_CPP_MODEL=<name>               optional; defaults to whatever the llama.cpp server has loaded
    GROQ_API_KEY / GROQ_MODEL            fallback, same as before

Both local servers expose the same OpenAI-compatible API (only the port
differs), so they share one build path. Uses the unified llama.cpp
binary: `llama serve -m <gguf> --chat-template-kwargs
'{"enable_thinking": false}'` (without that flag, LFM-family models
reason first and TTS would try to speak empty text).
For Ollama the default model is ``gemma3:1b``; if the pinned model is
not present, the first local (non-cloud) model is used. For llama.cpp,
any loaded model is fine.
If the local server is unreachable, the pipeline falls back to Groq so a
call never breaks just because the local server is down.
"""

import os

# Load the repo-root .env (like Next.js does) before any env var is read.
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

import httpx
from loguru import logger
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.services.openai.llm import OpenAILLMService

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "llama.cpp").strip().lower()

# provider -> (base_url, pinned model, pipecat service class)
LOCAL_PROVIDERS = {
    "ollama": (
        os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        os.getenv("OLLAMA_MODEL", "gemma3:1b").strip(),
        OLLamaLLMService,
    ),
    "llama.cpp": (
        os.getenv("LLAMA_CPP_BASE_URL", "http://localhost:8080/v1"),
        os.getenv("LLAMA_CPP_MODEL", "").strip(),
        OpenAILLMService,
    ),
}


def _model_names(base_url: str) -> list[str] | None:
    """Model ids on an OpenAI-compatible server, or None when unreachable."""
    try:
        resp = httpx.get(f"{base_url.rstrip('/')}/models", timeout=1.0)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        names = [m["id"] for m in data if m.get("id")]
        if names:
            return names
        # Non-OpenAI shape (older Ollama via /api/tags): fall through to no models.
        return []
    except Exception:
        return None


def _groq(system_instruction: str) -> GroqLLMService:
    return GroqLLMService(
        api_key=GROQ_API_KEY,
        settings=GroqLLMService.Settings(model=GROQ_MODEL, system_instruction=system_instruction),
    )


def _local(
    name: str, base_url: str, pinned: str, cls: type, system_instruction: str
):
    names = _model_names(base_url)
    if names is None:
        logger.warning(
            f"{name} unreachable at {base_url}; falling back to Groq "
            f"(start it with `{'ollama serve' if name == 'ollama' else 'llama serve -m <model>'}`, "
            "or set LLM_PROVIDER=groq)"
        )
        return _groq(system_instruction)

    model = pinned if pinned and pinned in names else None
    if model is None:
        # Pinned (or default) model missing: use the first local model, never a :cloud one.
        local = next((m for m in names if ":cloud" not in m), None)
        if local is None:
            logger.warning(
                f"{name} at {base_url} has no local models (only {names}); "
                "falling back to Groq"
            )
            return _groq(system_instruction)
        if pinned:
            logger.warning(f"Model {pinned!r} not found on {name} {names}; using local model {local!r}")
        model = local

    logger.info(f"LLM: {name} model={model} base_url={base_url}")
    return cls(
        api_key="not-needed",
        base_url=base_url,
        settings=cls.Settings(model=model, system_instruction=system_instruction),
    )


def build_llm(system_instruction: str, provider: str | None = None):
    """Return the LLM service for this session: the local server when reachable, else Groq."""
    provider = (provider or LLM_PROVIDER).strip().lower()
    if provider == "groq":
        return _groq(system_instruction)
    if provider not in LOCAL_PROVIDERS:
        raise ValueError(f"Unknown LLM_PROVIDER {provider!r}; expected one of {sorted(list(LOCAL_PROVIDERS) + ['groq'])}")

    base_url, pinned, cls = LOCAL_PROVIDERS[provider]
    return _local(provider, base_url, pinned, cls, system_instruction)
