"""Demo tools: fake lookups that sleep 2-3s so async tool calls are visible.

Each is registered async (``cancel_on_interruption=False``): the model speaks a
bridging line, the tool runs in the background, and the result is spoken when it
lands. Schemas are inferred from the signature and docstring, so adding a tool is
just another decorated function in ``TOOLS``.
"""

import asyncio

from pipecat.adapters.llm.schemas.direct_function import tool_options

# shortcut: every body is a sleep plus a canned answer; swap in the real API/DB
# call when these stop being demos, keeping the signature and return-a-string shape.
# The hardcoded facts (weather, branch addresses) are the other fake part.


@tool_options(cancel_on_interruption=False, timeout_secs=10)
async def get_weather(params, city: str):
    """Get the current weather for a city.

    Args:
        city: Name of the city.
    """
    await asyncio.sleep(2)
    return f"{city}-তে এখন ২৮ ডিগ্রি সেলসিয়াস, আকাশ হালকা মেঘলা।"


@tool_options(cancel_on_interruption=False, timeout_secs=10)
async def check_order_status(params, order_id: str):
    """Check where an order is right now.

    Args:
        order_id: The order number to look up.
    """
    await asyncio.sleep(3)
    return f"অর্ডার {order_id} কুরিয়ারে আছে এবং আজ বিকেলে পৌঁছে যাওয়ার কথা।"

@tool_options(cancel_on_interruption=False, timeout_secs=10)
async def book_appointment(params, day: str, time: str):
    """Book an appointment for a day and time.

    Args:
        day: Preferred day, for example "সোমবার".
        time: Preferred time, for example "সন্ধ্যা ৬টা".
    """
    await asyncio.sleep(3)
    return f"{day} {time}-এ আপনার অ্যাপয়েন্টমেন্ট বুক হয়েছে।"


@tool_options(cancel_on_interruption=False, timeout_secs=10)
async def find_nearest_branch(params, area: str):
    """Find the nearest branch office for an area.

    Args:
        area: The area or neighborhood name.
    """
    await asyncio.sleep(2)
    return f"{area}-এর সবচেয়ে কাছের শাখা স্টেশন রোডে, খোলা আছে সন্ধ্যা ৭টা পর্যন্ত।"


TOOLS = [get_weather, check_order_status, book_appointment, find_nearest_branch]
