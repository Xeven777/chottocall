"""Turn detection providers.

``smart_turn`` (default) ends the user's turn with the local SmartTurn v3 ONNX
analyzer, so the bot answers when the user is actually done instead of on a
fixed silence window. ``speech_timeout`` is the dependency-free alternative
(shorter model load, slightly more cut-ins) and is also a useful A/B baseline.
"""

from dataclasses import dataclass

from pipecat.turns.user_start import VADUserTurnStartStrategy
from pipecat.turns.user_stop import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import (
    UserTurnStrategies,
    UserTurnStrategiesParams,
)

from app.voice.providers.base import ProviderRegistry
from app.voice.settings import TurnConfig


@dataclass(frozen=True, slots=True)
class TurnDetector:
    """Everything the user aggregator needs to decide when a turn is over."""

    strategies: UserTurnStrategies
    params: UserTurnStrategiesParams
    stop_timeout_s: float
    idle_timeout_s: float


turn_providers: ProviderRegistry[TurnConfig, TurnDetector] = ProviderRegistry(
    "turn detection"
)


@turn_providers.register("smart_turn")
def build_smart_turn(config: TurnConfig) -> TurnDetector:
    from app.voice.smart_turn import (
        user_turn_strategies,
        user_turn_strategies_params,
    )

    return TurnDetector(
        strategies=user_turn_strategies(),
        params=user_turn_strategies_params(),
        stop_timeout_s=config.stop_timeout_s,
        idle_timeout_s=config.idle_timeout_s,
    )


@turn_providers.register("speech_timeout")
def build_speech_timeout(config: TurnConfig) -> TurnDetector:
    return TurnDetector(
        strategies=UserTurnStrategies(
            start=[VADUserTurnStartStrategy()],
            stop=[SpeechTimeoutUserTurnStopStrategy()],
        ),
        params=UserTurnStrategiesParams(),
        stop_timeout_s=config.stop_timeout_s,
        idle_timeout_s=config.idle_timeout_s,
    )
