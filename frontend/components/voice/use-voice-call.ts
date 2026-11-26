"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PipecatClient } from "@pipecat-ai/client-js"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"

import { API_BASE_URL } from "@/lib/api"

const OFFER_URL = `${API_BASE_URL}/api/offer`

export type Status = "idle" | "connecting" | "live" | "error"
export type Speaker = "none" | "user" | "bot"
export type Line = { id: string; who: "user" | "bot"; text: string; at: number }
export type CallError =
  { code: "playback" } | { code: "connection"; detail?: string }

export function useVoiceCall() {
  const clientRef = useRef<PipecatClient | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [status, setStatus] = useState<Status>("idle")
  const statusRef = useRef<Status>("idle")
  /* Mutable mic/bot loudness, written by audio-level callbacks and polled by the orb. */
  const levelsRef = useRef({ user: 0, bot: 0 })
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const [speaker, setSpeaker] = useState<Speaker>("none")
  const [muted, setMuted] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<CallError | null>(null)

  const addLine = useCallback((who: Line["who"], text: string) => {
    setLines((prev) => [
      ...prev.slice(-30),
      { id: crypto.randomUUID(), who, text, at: Date.now() },
    ])
  }, [])

  const getClient = useCallback(() => {
    if (clientRef.current) return clientRef.current
    const client = new PipecatClient({
      transport: new SmallWebRTCTransport({
        webrtcRequestParams: { endpoint: OFFER_URL },
      }),
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => setStatus("live"),
        onDisconnected: () => {
          setStatus("idle")
          setSpeaker("none")
          setMuted(false)
        },
        onLocalAudioLevel: (level) => {
          levelsRef.current.user = level
        },
        onRemoteAudioLevel: (level, participant) => {
          if (!participant.local) levelsRef.current.bot = level
        },
        onUserStartedSpeaking: () => setSpeaker("user"),
        onUserStoppedSpeaking: () => setSpeaker("none"),
        onBotStartedSpeaking: () => setSpeaker("bot"),
        onBotStoppedSpeaking: () => setSpeaker("none"),
        onUserInput: (d) => {
          if (d.final) addLine("user", d.text)
        },
        onBotOutput: (d) => {
          if (d.spoken_status === "new") addLine("bot", d.text)
        },
        onTrackStarted: (track) => {
          const audio = audioRef.current
          if (track.kind !== "audio" || !audio) return
          audio.srcObject = new MediaStream([track])
          audio.play().catch(() => setError({ code: "playback" }))
        },
        onError: (m) => {
          const detail = (m.data as { error?: string } | null)?.error
          // Non-fatal send hiccups while live shouldn't kill an active call
          if (statusRef.current === "live") return
          setStatus("error")
          setError({ code: "connection", detail })
        },
      },
    })
    clientRef.current = client
    return client
  }, [addLine])

  const start = useCallback(async () => {
    setError(null)
    setLines([])
    setStatus("connecting")
    setMuted(false)
    try {
      const client = getClient()
      await client.initDevices()
      await client.connect()
      // enableMic sends a datachannel message, so it must come after connect
      client.enableMic(true)
    } catch (e) {
      setStatus("error")
      setError({
        code: "connection",
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [getClient])

  const stop = useCallback(async () => {
    await clientRef.current?.disconnect()
    setStatus("idle")
    setSpeaker("none")
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      clientRef.current?.enableMic(prev)
      return !prev
    })
  }, [])

  useEffect(() => () => void clientRef.current?.disconnect(), [])

  return {
    audioRef,
    levelsRef,
    status,
    speaker,
    muted,
    lines,
    error,
    start,
    stop,
    toggleMute,
  }
}
