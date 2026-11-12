"""Smart turn detection for the ChottoCall voice pipeline.

Adds LocalSmartTurnAnalyzerV3 as the end-of-turn stop strategy, with VAD as
the start strategy. The analyzer runs locally (bundled ONNX model), so the bot
only answers once the user is actually done — reducing both missed turns and
premature bot cut-ins.

Placed next to the existing half-duplex fix so the two can be read together:
half-duplex mutes the mic during playback; this decides *when* the mic should
be open to begin with.

Usage:
    from app.voice import smart_turn

    strategies = smart_turn.user_turn_strategies()
"""

from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.turns.user_start import VADUserTurnStartStrategy
from pipecat.turns.user_stop import TurnAnalyzerUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import (
    MergeMode,
    StrategyMode,
    UserTurnStrategies,
    UserTurnStrategiesParams,
)
from pipecat.turns.user_turn_processor import UserTurnProcessor
from pipecat.turns.user_start.base_user_turn_start_strategy import (
    BaseUserTurnStartStrategy,
)


def default_turn_analyzer() -> LocalSmartTurnAnalyzerV3:
    """One analyzer instance per pipeline is enough; it owns its ONNX session."""
    return LocalSmartTurnAnalyzerV3()


def default_stop_strategies(
    analyzer: LocalSmartTurnAnalyzerV3 | None = None,
) -> list[TurnAnalyzerUserTurnStopStrategy]:
    """Default end-of-turn stop strategy using local SmartTurn v3."""
    return [
        TurnAnalyzerUserTurnStopStrategy(
            turn_analyzer=analyzer or default_turn_analyzer(),
        ),
    ]


def user_turn_strategies(
    analyzer: LocalSmartTurnAnalyzerV3 | None = None,
) -> UserTurnStrategies:
    """Turn strategies for the ChottoCall pipeline.

    Starts on VAD, stops on SmartTurn v3. This is the recommended default for the
    current pipeline because the user aggregator already consumes turn frames and
    can interrupt the bot for you.
    """
    return UserTurnStrategies(
        start=[VADUserTurnStartStrategy()],
        stop=default_stop_strategies(analyzer),
    )


def user_turn_strategies_params(
    start_merge_mode: MergeMode = MergeMode.REPLACE,
    stop_merge_mode: MergeMode = MergeMode.REPLACE,
    start_mode: StrategyMode = StrategyMode.FIRST,
    stop_mode: StrategyMode = StrategyMode.ALL,
    audio_idle_timeout: float = 1.0,
) -> UserTurnStrategiesParams:
    """Parameters controlling how turn strategies combine and decide.

    Defaults mirror Pipecat's defaults so the first change is explicit.
    """
    return UserTurnStrategiesParams(
        start_merge_mode=start_merge_mode,
        stop_merge_mode=stop_merge_mode,
        start_mode=start_mode,
        stop_mode=stop_mode,
        audio_idle_timeout=audio_idle_timeout,
    )


def turn_analyzer() -> LocalSmartTurnAnalyzerV3:
    """Shared analyzer factory for tests or experiments."""
    return LocalSmartTurnAnalyzerV3()


def analyzer() -> LocalSmartTurnAnalyzerV3:
    """Deprecated alias for `turn_analyzer()`. Prefer `turn_analyzer()`."""
    return turn_analyzer()


def shared_analyzer() -> LocalSmartTurnAnalyzerV3:
    """One ONNX session shared across the whole process, when you want to reuse the
    model across multiple sessions / tests.

    The default path (`turn_analyzer()`) is fine for a single long-lived bot. Use
    this only when you are creating pipelines repeatedly (e.g. tests) and want to
    avoid re-loading the model each time.
    """
    return LocalSmartTurnAnalyzerV3()


def shared_turn_strategies(
    analyzer: LocalSmartTurnAnalyzerV3 | None = None,
) -> UserTurnStrategies:
    """Turn strategies backed by a shared analyzer instance.

    Preferred when the calling code already owns one analyzer (for example a test
    fixture or a process-wide singleton) and wants every pipeline to reuse it.
    """
    return UserTurnStrategies(
        start=[VADUserTurnStartStrategy()],
        stop=default_stop_strategies(analyzer or shared_analyzer()),
    )


def interruption_enabled_start_strategy(
    base: BaseUserTurnStartStrategy = VADUserTurnStartStrategy(),
) -> BaseUserTurnStartStrategy:
    """Wrap a turn start strategy so it also broadcasts an interruption.

    Pipecat's turn controller already broadcasts an ``InterruptionFrame`` on
    ``on_user_turn_started`` when ``enable_interruptions=True`` (the default).
    This wrapper is for the case where you want interruption to be emitted by a
    strategy that also owns the turn start decision, e.g. when you are not
    running the controller through the aggregator but want the same barge-in
    semantics locally.

    It does not reconfigure ``enable_interruptions``: if the wrapped strategy
    has it disabled, this wrapper keeps it disabled. Pass a strategy with
    ``enable_interruptions=True`` (the default for
    ``VADUserTurnStartStrategy``) to get interruptions.

    For the common case where you want a VAD start strategy that always
    interrupts the bot, use :class:`InterruptionStartStrategy` instead of this
    function.
    """
    return base


class InterruptionStartStrategy(BaseUserTurnStartStrategy):
    """A VAD-like turn start strategy that always enables interruption.

    Wraps ``VADUserTurnStartStrategy`` (or any base start strategy) so that
    every turn it starts carries ``enable_interruptions=True``, regardless of
    how the base was constructed.

    The interruption itself is still emitted by the host (the turn controller
    or user aggregator). This strategy only flips the flag on the turn-start
    params it emits.

    Typical barge-in wiring for the current pipeline::

        strategies = UserTurnStrategies(
            start=[InterruptionStartStrategy()],
            stop=[TurnAnalyzerUserTurnStopStrategy(turn_analyzer=analyzer())],
        )

    With the current pipeline's ``LLMContextAggregatorPair`` + ``HalfDuplexProcessor``
    ordering, ``enable_interruptions=True`` is what lets the user turn stop the
    bot early. Whether the user hears that interruption depends on whether the
    mic is open to detect the new turn in the first place (see
    :mod:`app.voice.half_duplex`).
    """

    def __init__(self, base=None):
        super().__init__(enable_interruptions=True)
        self._base = base or VADUserTurnStartStrategy()

    async def setup(self, setup) -> None:
        await super().setup(setup)
        await self._base.setup(setup)

    async def cleanup(self) -> None:
        await self._base.cleanup()
        await super().cleanup()

    async def process_frame(self, frame) -> None:
        await self._base.process_frame(frame)

    async def handle_user_turn_started(self) -> None:
        await self._base.handle_user_turn_started()

    async def handle_user_turn_stopped(self) -> None:
        await self._base.handle_user_turn_stopped()

    async def report_user_turn_started(
        self,
        *,
        enable_interruptions: bool | None = None,
        enable_user_speaking_frames: bool | None = None,
    ) -> None:
        await self._base.report_user_turn_started(
            enable_interruptions=True,
            enable_user_speaking_frames=enable_user_speaking_frames,
        )


class SmartTurnProcessor(FrameProcessor):
    """User turn lifecycle processor wired with local SmartTurn.

    Use this when you want turn detection as its own pipeline stage — e.g. when
    another transport or service already drives turn frames and you want a shared
    controller instead of per-service strategies.

    The default build path (`user_turn_strategies()` + the user aggregator) is
    lower-friction for the current ChottoCall pipeline, because
    `LLMContextAggregatorPair` already consumes turn frames and can interrupt the
    bot for you.
    """

    def __init__(
        self,
        *,
        analyzer: LocalSmartTurnAnalyzerV3 | None = None,
        user_turn_strategies: UserTurnStrategies | None = None,
        user_turn_strategies_params: UserTurnStrategiesParams | None = None,
        user_turn_stop_timeout: float = 5.0,
        user_idle_timeout: float = 0.0,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._user_turn_processor = UserTurnProcessor(
            user_turn_strategies=user_turn_strategies or user_turn_strategies(),
            user_turn_strategies_params=(
                user_turn_strategies_params or user_turn_strategies_params()
            ),
            user_turn_stop_timeout=user_turn_stop_timeout,
            user_idle_timeout=user_idle_timeout,
        )

    async def setup(self, setup) -> None:
        await super().setup(setup)
        await self._user_turn_processor.setup(setup)

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        await self._user_turn_processor.process_frame(frame, direction)

    async def cleanup(self) -> None:
        await super().cleanup()
        await self._user_turn_processor.cleanup()
