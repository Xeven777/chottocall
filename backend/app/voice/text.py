"""Text cleanup shared by every TTS provider.

The small local LLM keeps emitting emoji despite the system prompt, and TTS
engines either read them out or render them as garbage. Applied as a pipecat
``text_transform`` before aggregation, so it runs for local and hosted voices
alike.
"""

import re

_EMOJI_RE = re.compile(
    r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u20E3]"
)


async def strip_emoji(text: str, text_type: str) -> str:
    """Remove emoji and collapse the gaps they leave behind."""
    return re.sub(r"  +", " ", _EMOJI_RE.sub("", text)).strip()
