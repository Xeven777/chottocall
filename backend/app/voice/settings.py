"""Typed, per-call snapshots of the environment.

Configuration is read when a call starts (``from_env``), not at import time, so
changing ``.env`` does not require re-importing the app and tests can build a
config without touching ``os.environ``.

Each component gets one dataclass and one ``*_PROVIDER`` chain: a comma-separated
list of provider names in preference order (``TTS_PROVIDER=mithi,speechify``).
See :mod:`app.voice.providers` for how a chain is resolved.
"""

import os
from dataclasses import dataclass

from dotenv import find_dotenv, load_dotenv
from loguru import logger

# The repo-root .env, like Next.js does. Idempotent; safe to import anywhere.
load_dotenv(find_dotenv())


def _text(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _int(name: str, default: int) -> int:
    return _number(name, default, int)


def _float(name: str, default: float) -> float:
    return _number(name, default, float)


def _number(name: str, default, cast):
    raw = _text(name, str(default))
    try:
        return cast(raw)
    except ValueError:
        logger.warning(f"{name}={raw!r} is not a number; using {default}")
        return default


def _chain(name: str, default: str, *, ensure_last: str | None = None) -> str:
    """Normalise ``a, b ,c`` and optionally append a guaranteed fallback."""
    names = [part.strip() for part in _text(name, default).split(",") if part.strip()]
    if not names:
        names = [part.strip() for part in default.split(",") if part.strip()]
    if ensure_last and ensure_last not in names:
        names.append(ensure_last)
    return ",".join(names)


@dataclass(frozen=True, slots=True)
class LLMConfig:
    """LLM provider preference chain and per-provider connection settings."""

    providers: str
    max_tokens: int
    probe_timeout_s: float
    groq_api_key: str
    groq_model: str
    llama_cpp_base_url: str
    llama_cpp_model: str
    ollama_base_url: str
    ollama_model: str

    @classmethod
    def from_env(cls) -> "LLMConfig":
        return cls(
            # Groq is appended when missing: a local-only setting still never
            # leaves a call without an LLM.
            providers=_chain(
                "LLM_PROVIDER", "llama.cpp,ollama,groq", ensure_last="groq"
            ),
            max_tokens=_int("LLM_MAX_TOKENS", 256),
            probe_timeout_s=_float("LLM_PROBE_TIMEOUT", 15.0),
            groq_api_key=_text("GROQ_API_KEY"),
            groq_model=_text("GROQ_MODEL", "openai/gpt-oss-20b"),
            llama_cpp_base_url=_text("LLAMA_CPP_BASE_URL", "http://localhost:8080/v1"),
            llama_cpp_model=_text("LLAMA_CPP_MODEL"),
            ollama_base_url=_text("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            ollama_model=_text("OLLAMA_MODEL", "gemma3:1b"),
        )


@dataclass(frozen=True, slots=True)
class STTConfig:
    """Speech-to-text provider preference chain."""

    providers: str
    shruti_weights: str

    @classmethod
    def from_env(cls) -> "STTConfig":
        return cls(
            providers=_chain("STT_PROVIDER", "shruti"),
            shruti_weights=_text("SHRUTI_WEIGHTS", "models/shruti-bengali.cact"),
        )


@dataclass(frozen=True, slots=True)
class TTSConfig:
    """TTS provider preference chain (first available speaks, the next is fallback)."""

    providers: str
    tiny_swara_dir: str
    tiny_swara_model: str
    tiny_swara_voice: str
    tiny_swara_speed: float
    mithi_model_dir: str
    mithi_voice: str
    mithi_lang: str
    mithi_device: str
    mithi_threads: int
    speechify_api_key: str
    speechify_voice: str
    speechify_model: str
    speechify_language: str

    @classmethod
    def from_env(cls) -> "TTSConfig":
        return cls(
            providers=_chain("TTS_PROVIDER", "tiny-swara,mithi,speechify"),
            tiny_swara_dir=_text("TTS_TINY_SWARA_DIR", "models/tiny-swara"),
            tiny_swara_model=_text("TTS_TINY_SWARA_MODEL"),
            tiny_swara_voice=_text("TTS_TINY_SWARA_VOICE", "BM"),
            tiny_swara_speed=_float("TTS_TINY_SWARA_SPEED", 1.0),
            mithi_model_dir=_text("TTS_MITHI_MODEL_DIR", "models/mithi-v2-flash"),
            mithi_voice=_text("TTS_MITHI_VOICE", "satvik"),
            mithi_lang=_text("TTS_MITHI_LANG", "bn"),
            mithi_device=_text("TTS_MITHI_DEVICE", "auto"),
            mithi_threads=_int("TTS_MITHI_THREADS", 0),
            speechify_api_key=_text("SPEECHIFY_API_KEY"),
            speechify_voice=_text("SPEECHIFY_VOICE", "ritwik"),
            # simba-3.2 is English-only; 3.5 speaks Bengali.
            speechify_model=_text("SPEECHIFY_MODEL", "simba-3.5"),
            speechify_language=_text("SPEECHIFY_LANGUAGE", "bn-IN"),
        )


@dataclass(frozen=True, slots=True)
class VADConfig:
    """Voice-activity-detection provider preference chain."""

    providers: str

    @classmethod
    def from_env(cls) -> "VADConfig":
        return cls(providers=_chain("VAD_PROVIDER", "silero"))


@dataclass(frozen=True, slots=True)
class TurnConfig:
    """Turn-detection provider chain and aggregator timeouts."""

    providers: str
    stop_timeout_s: float
    idle_timeout_s: float

    @classmethod
    def from_env(cls) -> "TurnConfig":
        return cls(
            providers=_chain("TURN_PROVIDER", "smart_turn"),
            stop_timeout_s=_float("TURN_STOP_TIMEOUT", 5.0),
            idle_timeout_s=_float("TURN_IDLE_TIMEOUT", 0.0),
        )


def barge_in_enabled() -> bool:
    """Half-duplex is the default; ``CHOTTO_BARGE_IN=1`` keeps the mic open."""
    return _text("CHOTTO_BARGE_IN", "0").lower() in {"1", "true", "yes", "on"}
