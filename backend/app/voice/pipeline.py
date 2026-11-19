"""The ChottoCall voice pipeline, independent of how audio reaches it.

Provider selection lives in :mod:`app.voice.providers`; this module only wires
the stages in the order they must run:

    input -> half-duplex -> VAD -> STT -> user aggregator -> LLM -> TTS
          -> output -> assistant aggregator
"""

from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.transports.base_transport import BaseTransport

from app.voice.half_duplex import HalfDuplexProcessor
from app.voice.providers import (
    build_llm,
    build_stt,
    build_tts,
    build_turn,
    build_vad,
)
from app.voice.settings import (
    LLMConfig,
    STTConfig,
    TTSConfig,
    TurnConfig,
    VADConfig,
    barge_in_enabled,
)

SYSTEM = (
    "তুমি চট্টোকল, একটি বন্ধুত্বপূর্ণ বাংলা ভয়েস সহকারী। "
    "সংক্ষেপে, এক-দুই বাক্যে, সহজ বাংলায় উত্তর দাও। ফোনে শোনার জন্য বলছ, "
    "তাই তালিকা, মার্কডাউন বা ইমোজি নয়।"
)


def build_pipeline(transport: BaseTransport) -> Pipeline:
    """Assemble the pipeline around ``transport`` using the configured providers."""
    context = LLMContext()
    turn = build_turn(TurnConfig.from_env())
    user_params = LLMUserAggregatorParams(
        user_turn_strategies=turn.strategies,
        user_turn_strategies_params=turn.params,
        user_turn_stop_timeout=turn.stop_timeout_s,
        user_idle_timeout=turn.idle_timeout_s,
    )
    aggregators = LLMContextAggregatorPair(context, user_params=user_params)

    return Pipeline(
        [
            transport.input(),
            # Before VAD, so the bot's own voice never looks like the user speaking.
            #
            # By default the mic is muted during bot speech (half-duplex), which
            # prevents barge-in entirely. Set CHOTTO_BARGE_IN=1 to open the mic
            # during playback; interruptions still require turn detection with
            # enable_interruptions=True, which the SmartTurn wiring provides
            # through the user aggregator.
            HalfDuplexProcessor(barge_in=barge_in_enabled()),
            VADProcessor(vad_analyzer=build_vad(VADConfig.from_env())),
            build_stt(STTConfig.from_env()),
            aggregators.user(),
            build_llm(LLMConfig.from_env(), system_instruction=SYSTEM),
            build_tts(TTSConfig.from_env()),
            transport.output(),
            aggregators.assistant(),
        ]
    )
