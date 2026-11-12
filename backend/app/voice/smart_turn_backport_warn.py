"""Backup note for the local SmartTurn v3 backport used in this project.

The `LocalSmartTurnAnalyzerV3` class loaded here is the version shipped inside
this project's pipecat venv. It is NOT the intended production path for ChottoCall
and is only being used because the user has not yet switched to a local LLM/STT
stack.

Verified from this install's source (pipecat 1.15.0, backport copy):

1. `TurnAnalyzerUserTurnStopStrategy` decides end-of-turn by combining the local
   `LocalSmartTurnAnalyzerV3` result with an STT transcript / STT timeout safety net.
   After the strategy decides to stop, it calls
   `BaseUserTurnStopStrategy._fire_user_turn_stopped()`, which in turn calls
   `_call_event_handler("on_user_turn_stopped", UserTurnStoppedParams(...))`.
   That event path exists in this backport.

2. What this backport does NOT carry from upstream Pipecat: the `@logs`-style
   interruption bookkeeping you might expect around
   "assistant response interrupted because the user resumed speech". In this
   backport, the stop strategy still reaches `on_user_turn_stopped`, but the
   paired interruption path whose job is to say "assistant response interrupted
   because the user resumed speech" is not wired up in the same way, so that
   message does not appear here.

Practical impact for ChottoCall:
- SmartTurn still gates the LLM trigger (the bot waits for a real turn end),
   which is the primary fix the user asked for.
- Turn-start/stop lifecycle events are present, but extra interruption/lifecycle
   logging is degraded until a pipecat upgrade or a real local stack lands.
   Treat missing logs as a backport artifact, not a bug in the wiring below.

To improve observability later (non-blocking):
- Upgrade pipecat, or
- Swap in a real local LLM stack with the upstream turn diagnostics intact, or
- Add your own logging wrapper around
   `VADUserTurnStartStrategy`/`TurnAnalyzerUserTurnStopStrategy` and the
   `on_user_turn_stopped` / `on_user_turn_started` event handlers if you need
   per-turn traces before the upgrade lands.

This file is intentionally not imported by the pipeline. It exists so that if
someone later debugs "where did my smart-turn logs go", the answer is here rather
than buried in a backport.
"""
