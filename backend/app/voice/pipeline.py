"""The ChottoCall voice pipeline, independent of how audio reaches it."""

import os

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.transports.base_transport import BaseTransport

from app.voice.half_duplex import HalfDuplexProcessor
from app.voice.llm import build_llm
from app.voice.smart_turn import user_turn_strategies, user_turn_strategies_params
from app.voice.stt_shruti import ShrutiSTTService
from app.voice.tts_mithi import MithiTTSService

ENABLE_BARGE_IN = os.getenv("CHOTTO_BARGE_IN", "0").strip() in {"1", "true", "True", "yes", "YES"}

# Kept as the Mithi fallback; used only when the local model can't produce audio.
SPEECHIFY_API_KEY = os.getenv("SPEECHIFY_API_KEY", "")

# Mithi TTS (local, optional). Paths are relative to cwd, like the STT model.
TTS_MITHI_MODEL_DIR = os.getenv("TTS_MITHI_MODEL_DIR", "models/mithi-v2-flash")
TTS_MITHI_VOICE = os.getenv("TTS_MITHI_VOICE", "satvik")
TTS_MITHI_LANG = os.getenv("TTS_MITHI_LANG", "bn")
TTS_MITHI_DEVICE = os.getenv("TTS_MITHI_DEVICE", "auto")
TTS_MITHI_THREADS = int(os.getenv("TTS_MITHI_THREADS", "0") or 0)

SYSTEM = (
    "তুমি চট্টোকল, একটি বন্ধুত্বপূর্ণ বাংলা ভয়েস সহকারী। "
    "সংক্ষেপে, এক-দুই বাক্যে, সহজ বাংলায় উত্তর দাও। ফোনে শোনার জন্য বলছ, "
    "তাই তালিকা, মার্কডাউন বা ইমোজি নয়।"
)


def build_pipeline(transport: BaseTransport) -> Pipeline:
    """Assemble input -> half-duplex -> VAD -> STT -> LLM -> TTS -> output.

    Turn detection (SmartTurn) is configured through the user aggregator so the
    bot doesn't start answering until the user is actually finished speaking.
    """
    context = LLMContext()
    user_params = LLMUserAggregatorParams(
        user_turn_strategies=user_turn_strategies(),
        user_turn_strategies_params=user_turn_strategies_params(),
        user_turn_stop_timeout=5.0,
        user_idle_timeout=0.0,
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
            # enable_interruptions=True, which the current SmartTurn wiring already
            # provides through the user aggregator.
            HalfDuplexProcessor(barge_in=ENABLE_BARGE_IN),
            VADProcessor(vad_analyzer=SileroVADAnalyzer()),
            ShrutiSTTService(),
            aggregators.user(),
            build_llm(SYSTEM),
            MithiTTSService(
                speechify_api_key=SPEECHIFY_API_KEY,
                model_dir=TTS_MITHI_MODEL_DIR,
                voice=TTS_MITHI_VOICE,
                language=TTS_MITHI_LANG,
                device=TTS_MITHI_DEVICE,
                threads=TTS_MITHI_THREADS,
            ),
            transport.output(),
            aggregators.assistant(),
        ]
    )
