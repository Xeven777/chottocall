"""LLM providers: local-first (llama.cpp, Ollama) with a hosted Groq fallback.

All three speak the OpenAI-compatible API, so the local ones share one build
path; only the port and the request extras differ. The preference chain comes
from ``LLM_PROVIDER`` (default ``llama.cpp,ollama,groq``) and availability is
decided by probing ``GET {base_url}/models``, lazily and in order, so a working
llama.cpp server never pays for an Ollama probe.

For a reasoning-capable model, run llama.cpp with ``-rea off`` (or
``--reasoning off``; the old ``--chat-template-kwargs '{"enable_thinking":
false}'`` is deprecated). Every request also carries ``enable_thinking: false``
and is capped at ``LLM_MAX_TOKENS``: uncapped, a reasoning model generates
thousands of tokens per turn — 45s+ of audio nobody hears.
"""

import httpx
from loguru import logger
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.llm_service import LLMService
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.services.openai.llm import OpenAILLMService

from app.voice.providers.base import ProviderRegistry
from app.voice.settings import LLMConfig

llm_providers: ProviderRegistry[LLMConfig, LLMService] = ProviderRegistry("LLM")

# Per-request "don't think". Newer llama.cpp builds read `enable_thinking`
# straight from the (extra) request body, older ones only look inside
# `chat_template_kwargs`, so send both — the server ignores what it does not
# know.
NO_THINKING = {
    "enable_thinking": False,
    "chat_template_kwargs": {"enable_thinking": False},
}


def _model_names(base_url: str, timeout_s: float) -> list[str] | None:
    """Model ids on an OpenAI-compatible server, or None when unreachable."""
    try:
        resp = httpx.get(f"{base_url.rstrip('/')}/models", timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return [m["id"] for m in data if m.get("id")]
    except Exception as exc:
        logger.debug(f"model probe failed for {base_url}: {type(exc).__name__}: {exc}")
        return None


def _choose_model(name: str, names: list[str], pinned: str) -> str:
    """Pinned model when served, else the first local (never a ``:cloud``) one."""
    if pinned and pinned in names:
        return pinned
    local = next((model for model in names if ":cloud" not in model), None)
    if local is None:
        raise RuntimeError(
            f"{name} has no local models (only {names}); start one or pin a valid model"
        )
    if pinned:
        logger.warning(f"Model {pinned!r} not found on {name} {names}; using {local!r}")
    return local


def _build_local(
    service_cls,
    name: str,
    base_url: str,
    pinned: str,
    config: LLMConfig,
    system_instruction: str,
    **settings_extra,
) -> LLMService:
    """Probe the server once and build its service.

    An unreachable server raises, and the registry moves to the next provider
    in the chain — so availability costs one probe, not two.
    """
    names = _model_names(base_url, config.probe_timeout_s)
    if not names:
        raise RuntimeError(f"{name} at {base_url} is unreachable or serves no models")
    model = _choose_model(name, names, pinned)
    logger.info(
        f"LLM: {name} model={model} base_url={base_url} max_tokens={config.max_tokens}"
    )
    return service_cls(
        api_key="not-needed",
        base_url=base_url,
        settings=service_cls.Settings(
            model=model,
            system_instruction=system_instruction,
            max_tokens=config.max_tokens,
            **settings_extra,
        ),
    )


@llm_providers.register("groq", available=lambda config: bool(config.groq_api_key))
def build_groq(config: LLMConfig, *, system_instruction: str = "") -> LLMService:
    logger.info(f"LLM: groq model={config.groq_model} max_tokens={config.max_tokens}")
    return GroqLLMService(
        api_key=config.groq_api_key,
        settings=GroqLLMService.Settings(
            model=config.groq_model,
            system_instruction=system_instruction,
            max_tokens=config.max_tokens,
        ),
    )


@llm_providers.register("llama.cpp")
def build_llama_cpp(config: LLMConfig, *, system_instruction: str = "") -> LLMService:
    return _build_local(
        OpenAILLMService,
        "llama.cpp",
        config.llama_cpp_base_url,
        config.llama_cpp_model,
        config,
        system_instruction,
        # Only llama.cpp understands these; Ollama's endpoint gets nothing extra.
        extra={"extra_body": dict(NO_THINKING)},
    )


@llm_providers.register("ollama")
def build_ollama(config: LLMConfig, *, system_instruction: str = "") -> LLMService:
    return _build_local(
        OLLamaLLMService,
        "ollama",
        config.ollama_base_url,
        config.ollama_model,
        config,
        system_instruction,
    )
