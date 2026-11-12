"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PipecatClient } from "@pipecat-ai/client-js"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { ThinkingOrb, type OrbState } from "thinking-orbs"
import { useTheme } from "next-themes"
import {
  ArrowUpRight,
  Microphone,
  MicrophoneSlash,
  Moon,
  PhoneDisconnect,
  Sun,
  Translate,
  WarningCircle,
  Waveform,
  Waves,
} from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const OFFER_URL = "http://localhost:8000/api/offer"

type Status = "idle" | "connecting" | "live" | "error"
type Line = { who: "user" | "bot"; text: string; at: number }

const TRY_SAYING = [
  "আসসালামু আলাইকুম, কেমন আছো?",
  "আজকের আবহাওয়া কেমন?",
  "আমাকে একটা গল্প বলো",
] as const

const DOT_CLASS: Record<Status, string> = {
  idle: "bg-muted-foreground/50",
  connecting: "bg-primary/60",
  live: "bg-primary",
  error: "bg-destructive",
}

const ORB_STATE: Record<Status, OrbState> = {
  idle: "breathing",
  connecting: "connecting",
  live: "listening",
  error: "breathing",
}

function statusCopy(status: Status, muted: boolean) {
  switch (status) {
    case "live":
      return muted
        ? { headline: "Mic muted", subline: "Tap the mic to unmute and keep talking." }
        : { headline: "Listening — কথা বলুন", subline: "Speak naturally. You can interrupt anytime." }
    case "connecting":
      return { headline: "Connecting…", subline: "Allow the mic, then say hello." }
    case "error":
      return { headline: "Connection paused", subline: "Call first, allow the mic, then speak Bengali." }
    default:
      return { headline: "Ready to talk", subline: "Call first, allow the mic, then speak Bengali." }
  }
}

function formatClock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/* Isolated ticker: mounts only while live, so call ticks never re-render the page. */
const CallTimer = memo(function CallTimer() {
  const [s, setS] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = window.setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums text-muted-foreground">{formatClock(s)}</span>
})

const StatusDot = memo(function StatusDot({ status }: { status: Status }) {
  return (
    <span className="relative flex size-2.5">
      {status === "live" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", DOT_CLASS[status])} />
    </span>
  )
})

const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const toggle = useCallback(() => setTheme(dark ? "light" : "dark"), [dark, setTheme])
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
})

/* Orb depends only on status, so transcript/message updates never re-render its canvas. */
const OrbStage = memo(function OrbStage({ status }: { status: Status }) {
  const live = status === "live"
  return (
    <div className="relative mb-6 flex size-36 items-center justify-center rounded-full border border-dashed border-border bg-muted/40 sm:size-44">
      <div
        aria-hidden
        className={cn("absolute inset-3 rounded-full border border-border/60", live && "orb-ring")}
      />
      <ThinkingOrb state={ORB_STATE[status]} size={64} aria-label="Assistant status" />
    </div>
  )
})

const CallActions = memo(function CallActions({
  live,
  connecting,
  muted,
  onStart,
  onStop,
  onToggleMute,
}: {
  live: boolean
  connecting: boolean
  muted: boolean
  onStart: () => void
  onStop: () => void
  onToggleMute: () => void
}) {
  if (live)
    return (
      <div className="flex gap-3">
        <Button
          size="lg"
          variant="destructive"
          onClick={onStop}
          className="h-13 flex-1 rounded-full text-base shadow-none"
          aria-label="End call"
        >
          <PhoneDisconnect size={18} weight="fill" />
          End call
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          className={cn(
            "h-13 w-15 shrink-0 rounded-full",
            muted && "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          {muted ? <MicrophoneSlash size={18} /> : <Microphone size={18} />}
        </Button>
      </div>
    )
  return (
    <Button
      size="lg"
      disabled={connecting}
      onClick={onStart}
      className="h-13 w-full text-base"
      aria-label="Start a voice call"
    >
      {connecting ? (
        <>
          <Waveform size={18} className="animate-pulse" />
          Connecting…
        </>
      ) : (
        <>
          <Microphone size={18} weight="fill" />
          Start call
        </>
      )}
    </Button>
  )
})

const LineItem = memo(function LineItem({ line }: { line: Line }) {
  const isUser = line.who === "user"
  const time = useMemo(
    () => new Date(line.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [line.at]
  )
  return (
    <li className={cn("msg-in flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar size="sm" aria-label={isUser ? "You" : "ChottoCall"} className="mt-1 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-bold",
            isUser ? "bg-foreground text-background" : "bg-primary/15 text-primary"
          )}
        >
          {isUser ? "You" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div className={cn("min-w-0 max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser ? "rounded-tr-md bg-foreground text-background" : "rounded-tl-md border border-border bg-muted/70"
          )}
        >
          <p className="font-bengali wrap-anywhere">{line.text}</p>
        </div>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {isUser ? "You" : "ChottoCall"} · {time}
        </p>
      </div>
    </li>
  )
})

const TrySayingList = memo(function TrySayingList() {
  return (
    <ItemGroup className="w-full gap-2 text-left">
      {TRY_SAYING.map((phrase) => (
        <Item key={phrase} variant="outline" size="xs">
          <ItemContent>
            <span className="font-bengali text-sm">{phrase}</span>
          </ItemContent>
          <ItemActions>
            <ArrowUpRight size={14} className="shrink-0 text-muted-foreground" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
})

export function VoiceCall() {
  const clientRef = useRef<PipecatClient | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollWrapRef = useRef<HTMLDivElement | null>(null)

  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [muted, setMuted] = useState(false)

  const addLine = useCallback((line: Omit<Line, "at">) => {
    setLines((prev) => [...prev.slice(-30), { ...line, at: Date.now() }])
  }, [])

  const getClient = useCallback((): PipecatClient => {
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
          setMuted(false)
        },
        onUserInput: (data) => {
          if (data.final) addLine({ who: "user", text: data.text })
        },
        onBotOutput: (data) => {
          if (data.spoken_status === "new") addLine({ who: "bot", text: data.text })
        },
        onTrackStarted: (track) => {
          if (track.kind !== "audio") return
          const audio = audioRef.current
          if (!audio) return
          audio.srcObject = new MediaStream([track])
          audio.play().catch(() => setError("Browser blocked playback — click Call again."))
        },
        onError: (message) => {
          const detail = (message.data as { error?: string } | null)?.error
          setStatus("error")
          setError(detail ?? "Connection failed. Check the backend is running.")
        },
      },
    })
    clientRef.current = client
    return client
  }, [addLine])

  const start = useCallback(async () => {
    setError(null)
    setStatus("connecting")
    try {
      const client = getClient()
      client.enableMic(true)
      setMuted(false)
      await client.initDevices()
      await client.connect()
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [getClient])

  const stop = useCallback(async () => {
    await clientRef.current?.disconnect()
    setStatus("idle")
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      clientRef.current?.enableMic(prev)
      return !prev
    })
  }, [])

  useEffect(() => {
    const viewport = scrollWrapRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [lines])

  const copy = useMemo(() => statusCopy(status, muted), [status, muted])
  const live = status === "live"
  const connecting = status === "connecting"

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-2xl -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
              <Waves size={19} weight="bold" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">ChottoCall</p>
              <p className="text-xs text-muted-foreground">Bengali voice assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden h-8 gap-1.5 px-3 sm:inline-flex">
              <Translate size={14} />
              <span className="font-bengali">বাংলা</span>
              <span aria-hidden>·</span>
              <span>Live transcript</span>
            </Badge>
            <Badge variant="outline" className="h-8 gap-2 px-3 capitalize">
              <StatusDot status={status} />
              {status === "live" ? (muted ? "Muted" : "Live") : status}
              {live && <CallTimer />}
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="grid flex-1 gap-5 px-5 pb-6 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
          <Card aria-label="Call controls" className="rise-in justify-center">
            <CardContent className="flex flex-1 flex-col justify-center">
              <div className="flex flex-col items-center text-center">
                <OrbStage status={status} />

                <p aria-live="polite" className="text-balance text-2xl font-semibold tracking-tight">
                  {copy.headline}
                </p>
                <p
                  className={cn(
                    "mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground",
                    live && "font-bengali text-base"
                  )}
                >
                  {copy.subline}
                </p>

                <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
                  <CallActions
                    live={live}
                    connecting={connecting}
                    muted={muted}
                    onStart={start}
                    onStop={stop}
                    onToggleMute={toggleMute}
                  />

                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                    <span>WebRTC audio</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>Interrupt anytime</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="inline-flex items-center gap-1.5">
                      Keys: <Kbd>D</Kbd> theme
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mt-6">
                  <WarningCircle size={16} />
                  <AlertTitle>Could not connect</AlertTitle>
                  <AlertDescription>
                    {error} Start the backend, open this page over localhost, then try again.
                  </AlertDescription>
                </Alert>
              )}

              <audio ref={audioRef} autoPlay playsInline hidden />
            </CardContent>
          </Card>

          <Card aria-label="Transcript" className="rise-in-2 gap-0 py-0">
            <CardHeader className="border-b px-5 py-4 sm:px-6">
              <div>
                <CardTitle>Conversation</CardTitle>
                <CardDescription>
                  {lines.length === 0 ? "Nothing yet — your chat lands here" : `${lines.length} messages`}
                </CardDescription>
              </div>
              <CardAction>
                <Badge variant="secondary" className="gap-1.5">
                  <span className={cn("size-1.5 rounded-full", live ? "bg-primary" : "bg-muted-foreground/50")} />
                  {live ? "Recording voice" : "Paused"}
                </Badge>
              </CardAction>
            </CardHeader>

            <div ref={scrollWrapRef} className="flex min-h-64 flex-1 flex-col lg:min-h-112">
              <ScrollArea className="h-full min-h-64 flex-1 lg:min-h-112">
                <div className="px-5 py-6 sm:px-6">
                  {lines.length === 0 ? (
                    <Empty className="border-0 p-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Waveform size={20} />
                        </EmptyMedia>
                        <EmptyTitle>Start speaking</EmptyTitle>
                        <EmptyDescription>
                          Start a call and speak Bengali. What you say and what the assistant replies will appear here.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Try saying</p>
                        <TrySayingList />
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <ol className="flex flex-col gap-4">
                      {lines.map((line, i) => (
                        <LineItem key={`${line.at}-${i}`} line={line} />
                      ))}
                    </ol>
                  )}
                </div>
              </ScrollArea>
            </div>

            <CardFooter className="border-t px-5 py-3 sm:px-6">
              <p className="text-xs text-muted-foreground">
                Tip: use headphones so the assistant does not hear itself.
              </p>
            </CardFooter>
          </Card>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 pb-5 text-xs text-muted-foreground sm:px-8">
          <p>ChottoCall — browser voice, Bengali first.</p>
          <p className="inline-flex items-center gap-1.5">
            Allow the mic when prompted. Interrupt naturally, no push-to-talk needed.{" "}
            <KbdGroup>
              <Kbd>D</Kbd>
            </KbdGroup>
          </p>
        </footer>
      </div>
    </div>
  )
}
