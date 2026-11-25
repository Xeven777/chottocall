"""The ChottoCall voice pipeline, independent of how audio reaches it.

Provider selection lives in :mod:`app.voice.providers`; this module only wires
the stages in the order they must run:

    input -> half-duplex -> VAD -> STT -> user aggregator -> LLM -> TTS
          -> output -> assistant aggregator
"""

from pipecat.frames.frames import TTSSpeakFrame
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
from app.knowledge.registry import enabled_tools

SYSTEM = (
    "তুমি চট্টোকল, একটি বন্ধুত্বপূর্ণ বাংলা ভয়েস সহকারী। "
    "সংক্ষেপে, এক-দুই বাক্যে, সহজ বাংলায় উত্তর দাও। ফোনে শোনার জন্য বলছ, "
    "তাই তালিকা, মার্কডাউন বা ইমোজি নয়। "
    "তথ্যের প্রশ্নে search_knowledge টুল ব্যবহার করুন এবং টুলের পাঠ্য থেকে বাংলায় উত্তর দিন "
    "(ইংরেজি হলে অনুবাদ করুন); ফাইলের নাম উচ্চারণ করবেন না। "
    "টুল যদি কেবল 'আমার কাছে এই তথ্য নেই' বলে, তবেই সেটি বলুন; অন্যথায় 'তথ্য নেই' বলবেন না "
    "এবং কোনো তথ্য বানাবেন না।"
)

# Spoken the moment a tool starts, so the caller never hears dead air while it
# runs. Deterministic: the model cannot skip it. If the model also says
# something first, both are heard — keep this short.
BRIDGING = "একটু দেখে নিচ্ছি।"


def build_pipeline(transport: BaseTransport) -> Pipeline:
    """Assemble the pipeline around ``transport`` using the configured providers."""
    context = LLMContext(tools=enabled_tools())
    turn = build_turn(TurnConfig.from_env())
    user_params = LLMUserAggregatorParams(
        user_turn_strategies=turn.strategies,
        user_turn_strategies_params=turn.params,
        user_turn_stop_timeout=turn.stop_timeout_s,
        user_idle_timeout=turn.idle_timeout_s,
    )
    aggregators = LLMContextAggregatorPair(context, user_params=user_params)

    llm = build_llm(LLMConfig.from_env(), system_instruction=SYSTEM)

    # Fires once per tool batch, before the tool runs. Pushing straight to TTS
    # keeps the acknowledgement independent of what the model chose to say.
    @llm.event_handler("on_function_calls_started")
    async def _acknowledge(service, function_calls):
        await service.push_frame(TTSSpeakFrame(BRIDGING, append_to_context=False))

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
            llm,
            build_tts(TTSConfig.from_env()),
            transport.output(),
            aggregators.assistant(),
        ]
    )
