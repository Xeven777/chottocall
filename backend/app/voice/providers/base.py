"""The provider seam shared by every voice component.

The pipeline never names a concrete implementation. Each component (STT, LLM,
TTS, VAD, turn detection) owns a :class:`ProviderRegistry`, and configuration
holds a comma-separated preference chain such as ``mithi,speechify``. The first
provider that reports itself available is built; TTS also keeps the rest as
runtime fallbacks.

Adding a provider is one decorated factory in the component's module::

    @tts_providers.register("my-tts")
    def build_my_tts(config: TTSConfig) -> TTSService:
        return MyTTSService(...)

Nothing in the pipeline, settings, or API changes — the env setting picks it.

Factories receive the component's config plus any component-specific keyword
arguments and return a pipecat service (``STTService``, ``LLMService``,
``TTSService``, ``VADAnalyzer``) or a :class:`TurnDetector`.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

from loguru import logger

S = TypeVar("S")
T = TypeVar("T")


class ProviderUnavailable(RuntimeError):
    """No provider in the requested chain could be built."""


@dataclass(frozen=True, slots=True)
class Provider(Generic[S, T]):
    """One registered implementation of a voice component."""

    name: str
    build: Callable[..., T]
    available: Callable[[S], bool]


class ProviderRegistry(Generic[S, T]):
    """Named providers for one component kind, resolved from a preference chain."""

    def __init__(self, kind: str) -> None:
        self._kind = kind
        self._providers: dict[str, Provider[S, T]] = {}

    @property
    def kind(self) -> str:
        return self._kind

    def names(self) -> list[str]:
        return list(self._providers)

    def register(
        self, name: str, *, available: Callable[[S], bool] | None = None
    ) -> Callable[[Callable[..., T]], Callable[..., T]]:
        """Decorator registering a factory. ``available`` defaults to always."""

        def decorate(build: Callable[..., T]) -> Callable[..., T]:
            if name in self._providers:
                raise ValueError(f"{self._kind} provider {name!r} is already registered")
            self._providers[name] = Provider(
                name=name,
                build=build,
                available=available or (lambda _config: True),
            )
            return build

        return decorate

    def candidates(self, spec: str) -> list[Provider[S, T]]:
        """Providers named in ``spec``, in order. Validates names, probes nothing."""
        names = [part.strip() for part in spec.split(",") if part.strip()]
        if not names:
            raise ProviderUnavailable(f"empty {self._kind} provider chain")
        unknown = [name for name in names if name not in self._providers]
        if unknown:
            raise ProviderUnavailable(
                f"unknown {self._kind} provider(s) {unknown}; "
                f"known: {self.names()}"
            )
        return [self._providers[name] for name in names]

    def resolve(self, spec: str, config: S, **kwargs) -> tuple[str, T]:
        """Build the first available provider in ``spec``.

        A provider that claims availability but fails to build (missing model,
        dead socket, bad config) is logged and skipped, so the chain also covers
        construction failures. Availability is probed lazily, in order, so a
        later provider is never contacted when an earlier one works.
        """
        for provider in self.candidates(spec):
            if not self._is_available(provider, config):
                continue
            try:
                service = provider.build(config, **kwargs)
            except Exception as exc:
                logger.warning(
                    f"{self._kind} provider {provider.name!r} failed to build "
                    f"({type(exc).__name__}: {exc}); trying the next one"
                )
                continue
            logger.info(f"{self._kind}: {provider.name}")
            return provider.name, service
        raise ProviderUnavailable(
            f"no available {self._kind} provider in {spec!r}; "
            f"registered: {self.names()}"
        )

    def build_all(self, spec: str, config: S, **kwargs) -> list[tuple[str, T]]:
        """Every available provider in ``spec``, in order (used for TTS fallback)."""
        built: list[tuple[str, T]] = []
        for provider in self.candidates(spec):
            if not self._is_available(provider, config):
                continue
            try:
                built.append((provider.name, provider.build(config, **kwargs)))
            except Exception as exc:
                logger.warning(
                    f"{self._kind} provider {provider.name!r} failed to build "
                    f"({type(exc).__name__}: {exc}); skipping it"
                )
        if not built:
            raise ProviderUnavailable(
                f"no available {self._kind} provider in {spec!r}; "
                f"registered: {self.names()}"
            )
        return built

    def _is_available(self, provider: Provider[S, T], config: S) -> bool:
        try:
            available = provider.available(config)
        except Exception as exc:
            logger.debug(
                f"{self._kind} provider {provider.name!r} availability check "
                f"failed: {type(exc).__name__}: {exc}"
            )
            return False
        if not available:
            logger.debug(f"{self._kind} provider {provider.name!r} is unavailable")
        return available
