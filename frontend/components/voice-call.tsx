"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import { ChatCircleDots, Moon, Sun, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale, type Copy, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Dock } from "@/components/voice/dock"
import { Orb, orbMode } from "@/components/voice/orb"
import { TranscriptPanel } from "@/components/voice/chat"
import { useVoiceCall, type Status } from "@/components/voice/use-voice-call"

const EASE = [0.22, 1, 0.36, 1] as const
const STATUS_KEY = {
  idle: "idle",
  connecting: "connecting",
  live: "live",
  error: "error",
} as const

function formatClock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

const CallTimer = memo(function CallTimer() {
  const [s, setS] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = window.setInterval(
      () => setS(Math.floor((Date.now() - t0) / 1000)),
      1000
    )
    return () => window.clearInterval(id)
  }, [])
  return (
    <span lang="en" className="font-mono text-[11px] tabular-nums opacity-80">
      {formatClock(s)}
    </span>
  )
})

const StatusDot = memo(function StatusDot({ status }: { status: Status }) {
  return (
    <span className="relative flex size-1.5">
      {status === "live" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      )}
      <span
        className={cn(
          "relative inline-flex size-1.5 rounded-full",
          status === "live"
            ? "bg-primary"
            : status === "error"
              ? "bg-destructive"
              : "bg-muted-foreground/45"
        )}
      />
    </span>
  )
})

const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const toggle = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme]
  )
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 rounded-full border border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <Sun size={16} className="hidden dark:block" />
      <Moon size={16} className="dark:hidden" />
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
  const reduce = useReducedMotion()
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-9 items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5"
    >
      {(["bn", "en"] as const).map((option) => {
        const active = locale === option
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "relative h-8 min-w-12 rounded-full px-3 text-[12px] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "text-cream"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 rounded-full bg-linear-to-b from-alta to-crimson"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
            <span className="relative">{option === "bn" ? "বাংলা" : "EN"}</span>
          </button>
        )
      })}
    </div>
  )
})

const BrandMark = memo(function BrandMark({ t }: { t: Copy }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-alta to-crimson shadow-md ring-1 ring-primary/20">
        <Image
          src="/logo.svg"
          alt=""
          width={34}
          height={34}
          priority
          unoptimized
          className="size-8 object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="font-heading text-[19px] leading-none font-semibold tracking-tight">
          {t.brand}
        </p>
        <p className="mt-1 hidden truncate text-[11px] tracking-[0.14em] text-muted-foreground uppercase sm:block">
          {t.tagline}
        </p>
      </div>
    </div>
  )
})

export function VoiceCall() {
  const { locale, setLocale, t } = useLocale()
  const reduce = useReducedMotion()
  const {
    audioRef,
    status,
    speaker,
    muted,
    lines,
    error,
    start,
    stop,
    toggleMute,
    levelsRef,
  } = useVoiceCall()
  const [prompt, setPrompt] = useState<string | null>(null)

  const rise = useCallback(
    (delay = 0) => ({
      initial: reduce ? false : { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.45, delay, ease: EASE },
    }),
    [reduce]
  )

  useEffect(() => {
    if (!error) return
    if (error.code === "playback")
      toast.error(t.errorTitle, { description: t.errorPlayback })
    else toast.error(t.errorTitle, { description: error.detail ?? t.errorHint })
  }, [error, t])

  const mode = orbMode(status, speaker, muted)
  const live = status === "live"

  const activateOrb = useCallback(() => {
    if (status === "connecting") return
    if (live) {
      toggleMute()
      return
    }
    void start()
  }, [live, start, status, toggleMute])

  const copy = useMemo(
    () =>
      live && muted
        ? t.status.muted
        : t.status[STATUS_KEY[status] as keyof typeof t.status],
    [status, muted, live, t]
  )

  return (
    <div
      lang={locale}
      className="relative flex min-h-dvh flex-col overflow-x-clip bg-background"
      suppressHydrationWarning
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_75%_42%_at_50%_0%,color-mix(in_oklch,var(--brand-saffron)_34%,transparent),transparent_78%),radial-gradient(ellipse_90%_50%_at_50%_24%,rgba(212,220,255,0.35),transparent_82%)] dark:opacity-35"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-5 sm:px-8 sm:py-7">
        <motion.header
          {...rise()}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <BrandMark t={t} />
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-9 gap-2 rounded-full border-border/70 bg-card/80 px-3.5 text-foreground"
            >
              <StatusDot status={status} />
              <span>
                {live && muted ? t.mutedLabel : t.statusLabel[status]}
              </span>
              {live && <CallTimer />}
            </Badge>
            <LangToggle
              locale={locale}
              onChange={setLocale}
              label={t.switchLanguage}
            />
            <ThemeToggle />
          </div>
        </motion.header>

        <main className="my-auto grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <motion.section
            {...rise(0.06)}
            aria-label={t.startAria}
            className="flex flex-col items-center gap-6 text-center"
          >
            <Orb
              mode={mode}
              levelsRef={levelsRef}
              label={
                live
                  ? muted
                    ? t.unmute
                    : t.mute
                  : status === "connecting"
                    ? t.connecting
                    : t.startAria
              }
              disabled={status === "connecting"}
              onClick={activateOrb}
            />
            <div aria-live="polite" className="min-h-20 max-w-md">
              <motion.div
                key={`${status}-${muted}`}
                initial={
                  reduce ? false : { opacity: 0, y: 6, filter: "blur(4px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <p className="font-heading text-2xl leading-snug font-semibold tracking-tight text-balance text-primary">
                  {copy.headline}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {copy.subline}
                </p>
              </motion.div>
            </div>

            <AnimatePresence initial={false}>
              {prompt && (
                <motion.div
                  key={prompt}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="flex max-w-md items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-left text-[13px] leading-relaxed"
                >
                  <ChatCircleDots
                    size={15}
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-muted-foreground">
                      {t.suggestion.prompt}
                    </span>{" "}
                    <span lang={locale} className="font-medium">
                      {prompt}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrompt(null)}
                    aria-label={t.suggestion.dismiss}
                    className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          <motion.section
            {...rise(0.12)}
            className="flex min-h-96 min-w-0 flex-col lg:h-[70vh]"
          >
            <TranscriptPanel
              t={t}
              status={status}
              lines={lines}
              onStart={start}
              onSelectPrompt={setPrompt}
            />
          </motion.section>
        </main>

        <motion.footer
          {...rise(0.18)}
          className="flex flex-col items-center gap-3"
        >
          <Dock
            t={t}
            status={status}
            muted={muted}
            onStart={start}
            onStop={stop}
            onToggleMute={toggleMute}
          />
        </motion.footer>
        <audio ref={audioRef} autoPlay playsInline hidden />
      </div>
    </div>
  )
}
