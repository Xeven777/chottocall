"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PipecatClient } from "@pipecat-ai/client-js"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { ThinkingOrb, type OrbState } from "thinking-orbs"
import { useTheme } from "next-themes"
import {
  Microphone,
  MicrophoneSlash,
  Moon,
  PhoneDisconnect,
  Sun,
  WarningCircle,
  Waveform,
} from "@phosphor-icons/react"

import { AlponaMark, AlponaRing, AlponaRule } from "@/components/alpona"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
import { Item, ItemContent, ItemGroup } from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { API_BASE_URL } from "@/lib/api"
import { useLocale, type Copy, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const OFFER_URL = `${API_BASE_URL}/api/offer`

type Status = "idle" | "connecting" | "live" | "error"
type Line = { who: "user" | "bot"; text: string; at: number }
type CallError = { code: "playback" } | { code: "connection"; detail?: string }

const DOT_CLASS: Record<Status, string> = {
  idle: "bg-muted-foreground/45",
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
  return (
    <span lang="en" className="font-mono text-[11px] tabular-nums text-muted-foreground">
      {formatClock(s)}
    </span>
  )
})

const StatusDot = memo(function StatusDot({ status }: { status: Status }) {
  return (
    <span className="relative flex size-1.5">
      {status === "live" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
      )}
      <span className={cn("relative inline-flex size-1.5 rounded-full", DOT_CLASS[status])} />
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
      className="rounded-full"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
})

const LangToggle = memo(function LangToggle({
  locale,
  onChange,
  label,
}: {
  locale: Locale
  onChange: (locale: Locale) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-border/80 bg-card/60 p-0.5"
    >
      {(["bn", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-5.5 rounded-sm px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            locale === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  )
})

/* The orb depends only on status, so transcript updates never re-render its canvas. */
const OrbStage = memo(function OrbStage({ status }: { status: Status }) {
  const live = status === "live"
  return (
    <div className="relative flex size-36 shrink-0 items-center justify-center sm:size-40">
      <AlponaRing className="absolute inset-0 text-primary" listening={live} />
      <div className="absolute inset-9 rounded-full border border-border/50 bg-card/50" />
      <ThinkingOrb state={ORB_STATE[status]} size={64} aria-label="Assistant status" />
    </div>
  )
})

const CallActions = memo(function CallActions({
  t,
  live,
  connecting,
  muted,
  onStart,
  onStop,
  onToggleMute,
}: {
  t: Copy
  live: boolean
  connecting: boolean
  muted: boolean
  onStart: () => void
  onStop: () => void
  onToggleMute: () => void
}) {
  if (live)
    return (
      <div className="flex gap-2.5">
        <Button
          size="lg"
          variant="destructive"
          onClick={onStop}
          className="h-12 flex-1 text-[15px]"
          aria-label={t.end}
        >
          <PhoneDisconnect size={18} weight="fill" />
          {t.end}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? t.unmute : t.mute}
          className={cn(
            "h-12 w-13 shrink-0 px-0",
            muted &&
              "border-destructive/35 bg-destructive/8 text-destructive hover:bg-destructive/12"
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
      className="h-12 w-full text-[15px]"
      aria-label={t.startAria}
    >
      {connecting ? (
        <>
          <Waveform size={18} className="animate-pulse" />
          {t.connecting}
        </>
      ) : (
        <>
          <Microphone size={18} weight="fill" />
          {t.start}
        </>
      )}
    </Button>
  )
})

const LineItem = memo(function LineItem({ line, speaker }: { line: Line; speaker: string }) {
  const isUser = line.who === "user"
  const time = useMemo(
    () => new Date(line.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [line.at]
  )
  return (
    <li className={cn("msg-in group/line", isUser && "text-right")}>
      <div className={cn("flex items-center gap-2 text-muted-foreground", isUser && "justify-end")}>
        <span
          className={cn("text-[11px] tracking-[0.06em]", isUser ? "text-muted-foreground" : "text-primary")}
        >
          {speaker}
        </span>
        <span aria-hidden className="h-px w-3.5 bg-border" />
        <time lang="en" className="font-mono text-[10.5px] tabular-nums">
          {time}
        </time>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[15px] leading-[1.75] wrap-anywhere",
          isUser ? "border-r-2 border-primary/40 pr-3.5" : "border-l-2 border-primary/40 pl-3.5"
        )}
      >
        {line.text}
      </p>
    </li>
  )
})

const TrySayingList = memo(function TrySayingList({ t }: { t: Copy }) {
  return (
    <ItemGroup className="w-full gap-2 text-left">
      {t.empty.phrases.map((phrase) => (
        <Item key={phrase} variant="outline" size="xs">
          <ItemContent>
            <span className="text-[13.5px] leading-relaxed text-foreground/85">{phrase}</span>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
})

export function VoiceCall() {
  const { locale, setLocale, t } = useLocale()
  const clientRef = useRef<PipecatClient | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollWrapRef = useRef<HTMLDivElement | null>(null)

  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<CallError | null>(null)
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
          audio.play().catch(() => setError({ code: "playback" }))
        },
        onError: (message) => {
          const detail = (message.data as { error?: string } | null)?.error
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
    setStatus("connecting")
    try {
      const client = getClient()
      client.enableMic(true)
      setMuted(false)
      await client.initDevices()
      await client.connect()
    } catch (e) {
      setStatus("error")
      setError({ code: "connection", detail: e instanceof Error ? e.message : String(e) })
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

  const copy = useMemo(() => {
    if (status === "live" && muted) return t.status.muted
    if (status === "error") return t.status.error
    if (status === "connecting") return t.status.connecting
    if (status === "live") return t.status.live
    return t.status.idle
  }, [status, muted, t])

  const live = status === "live"
  const connecting = status === "connecting"
  const headFont = locale === "bn" ? "font-bengali" : "font-heading"

  return (
    <div
      lang={locale}
      className="relative min-h-dvh overflow-hidden"
      suppressHydrationWarning
    >
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="alpona-field absolute inset-0 mask-[radial-gradient(ellipse_72%_52%_at_50%_-6%,black,transparent)] opacity-60" />
        <div className="absolute -top-72 left-1/2 size-160 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_13%,transparent),transparent_68%)]" />
        <div className="absolute -right-32 -bottom-48 size-120 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_85%,transparent),transparent_72%)] opacity-50" />
      </div>
      <div
        aria-hidden
        className="paper-grain pointer-events-none fixed inset-0 z-20"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-5 sm:px-10">
          <div className="rise-in flex min-w-0 items-center gap-3">
            <AlponaMark className="size-9 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[17px] leading-none font-semibold tracking-tight">
                {t.brand}
              </p>
              <p className="mt-1.5 hidden font-heading text-[11.5px] text-muted-foreground italic sm:block">
                {t.tagline}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LangToggle
              locale={locale}
              onChange={setLocale}
              label={t.switchLanguage}
            />
            <Badge
              variant="outline"
              className="h-7 gap-2 px-2.5 text-foreground"
            >
              <StatusDot status={status} />
              <span>
                {live && muted ? t.mutedLabel : t.statusLabel[status]}
              </span>
              {live && (
                <span className="hidden sm:inline-flex">
                  <CallTimer />
                </span>
              )}
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="grid flex-1 items-start gap-10 px-5 pt-8 pb-8 sm:px-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] lg:gap-14 lg:pt-14">
          <section aria-label={t.startAria} className="flex flex-col">
            <p className="rise-in-1 tracking-label text-[10.5px] font-medium text-muted-foreground/90 uppercase">
              {t.eyebrow}
            </p>
            <h1
              className={cn(
                "rise-in-1 mt-4 max-w-[16ch] text-[clamp(2.5rem,6vw,3.9rem)] leading-[1.06] font-semibold tracking-tight text-balance",
                headFont
              )}
            >
              {t.headline}
            </h1>
            <p className="rise-in-2 mt-4 max-w-[42ch] text-[15px] leading-[1.8] text-pretty text-muted-foreground">
              {t.intro}
            </p>

            <div className="rise-in-2 mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
              <OrbStage status={status} />
              <div className="min-w-0">
                <p
                  aria-live="polite"
                  className={cn(
                    "text-2xl leading-snug font-semibold tracking-tight text-balance",
                    headFont
                  )}
                >
                  {copy.headline}
                  {live && !muted && (
                    <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-primary align-middle" />
                  )}
                </p>
                <p className="mt-2 max-w-[32ch] text-[13.5px] leading-[1.75] text-pretty text-muted-foreground">
                  {copy.subline}
                </p>
              </div>
            </div>

            <div className="rise-in-3 mt-9 w-full max-w-md">
              <CallActions
                t={t}
                live={live}
                connecting={connecting}
                muted={muted}
                onStart={start}
                onStop={stop}
                onToggleMute={toggleMute}
              />

              <AlponaRule className="mt-7 w-full" />

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>{t.meta.transport}</span>
                <span aria-hidden className="size-1 rounded-full bg-border" />
                <span>{t.meta.anytime}</span>
                <span aria-hidden className="size-1 rounded-full bg-border" />
                <span className="inline-flex items-center gap-1.5">
                  <span>{t.meta.theme}</span>
                  <Kbd>D</Kbd>
                </span>
              </div>

              {error && (
                <Alert variant="destructive" className="mt-6">
                  <WarningCircle size={16} />
                  <AlertTitle className="text-[13.5px]">
                    {t.errorTitle}
                  </AlertTitle>
                  <AlertDescription className="text-[12.5px] leading-relaxed">
                    <span>
                      {error.code === "playback"
                        ? t.errorPlayback
                        : t.errorHint}
                    </span>
                    {error.code === "connection" && error.detail && (
                      <span className="mt-1 block font-mono text-[11px] wrap-break-word opacity-80">
                        {error.detail}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <audio ref={audioRef} autoPlay playsInline hidden />
            </div>
          </section>

          <Card
            aria-label={t.transcript}
            className="rise-in-2 gap-0 overflow-hidden py-0"
          >
            <div aria-hidden className="stitch h-0.75 w-full opacity-70" />
            <CardHeader className="px-6 pt-5 pb-4">
              <div>
                <CardTitle className="text-[17px]">{t.transcript}</CardTitle>
                <CardDescription className="mt-1 text-[12.5px]">
                  {lines.length === 0
                    ? t.transcriptSub
                    : t.lineCount(lines.length)}
                </CardDescription>
              </div>
              <CardAction>
                <Badge
                  variant="secondary"
                  className="gap-2 bg-primary/8 text-primary"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      live ? "bg-primary" : "bg-muted-foreground/45"
                    )}
                  />
                  <span>
                    {live
                      ? muted
                        ? t.transcriptBadge.muted
                        : t.transcriptBadge.live
                      : t.transcriptBadge.idle}
                  </span>
                </Badge>
              </CardAction>
            </CardHeader>

            <div aria-hidden className="stitch-soft mx-6 h-px opacity-80" />

            <div
              ref={scrollWrapRef}
              className="flex min-h-64 flex-1 flex-col lg:min-h-120"
            >
              <ScrollArea className="h-full min-h-64 flex-1 lg:min-h-120">
                <div className="px-6 py-6">
                  {lines.length === 0 ? (
                    <Empty className="border-0 p-2">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <AlponaMark className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle className="text-[17px]">
                          {t.empty.title}
                        </EmptyTitle>
                        <EmptyDescription className="text-[13px] leading-[1.75]">
                          {t.empty.description}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="mt-2">
                        <p className="tracking-label mt-2 text-[10px] font-medium text-muted-foreground uppercase">
                          {t.empty.trySaying}
                        </p>
                        <TrySayingList t={t} />
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <ol className="flex flex-col gap-6">
                      {lines.map((line, i) => (
                        <LineItem
                          key={`${line.at}-${i}`}
                          line={line}
                          speaker={
                            line.who === "user" ? t.speaker.user : t.speaker.bot
                          }
                        />
                      ))}
                    </ol>
                  )}
                </div>
              </ScrollArea>
            </div>

            <CardFooter className="border-t border-border/70 bg-secondary/25 px-6 py-3.5">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {t.footer.tip}
              </p>
            </CardFooter>
          </Card>
        </main>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4 text-[11.5px] text-muted-foreground sm:px-10">
          <p>{t.footer.line}</p>
          <p className="flex items-center gap-1.5">
            <span>{t.footer.permission}</span>
            <span aria-hidden className="size-1 rounded-full bg-border" />
            <span
              lang="en"
              className="font-mono text-[10.5px] tracking-[0.08em] uppercase"
            >
              WebRTC
            </span>
          </p>
        </footer>
      </div>
    </div>
  )
}
