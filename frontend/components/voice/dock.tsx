"use client"

import { memo } from "react"
import {
  Headphones,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  Waveform,
} from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import type { Copy } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Status } from "./use-voice-call"

const roundBtn =
  "size-14 shrink-0 rounded-full border border-border/70 bg-card px-0 text-foreground shadow-sm hover:bg-secondary active:scale-95"

export const Dock = memo(function Dock({
  t,
  status,
  muted,
  onStart,
  onStop,
  onToggleMute,
}: {
  t: Copy
  status: Status
  muted: boolean
  onStart: () => void
  onStop: () => void
  onToggleMute: () => void
}) {
  const reduce = useReducedMotion()
  const live = status === "live"
  const connecting = status === "connecting"
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-4">
        <AnimatePresence initial={false}>
          {live && (
            <motion.div
              key="mute"
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
            >
              <Button
                variant="outline"
                onClick={onToggleMute}
                aria-pressed={muted}
                aria-label={muted ? t.unmute : t.mute}
                className={cn(
                  roundBtn,
                  muted &&
                    "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                )}
              >
                {muted ? (
                  <MicrophoneSlash size={22} />
                ) : (
                  <Microphone size={22} />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {live ? (
          <Button
            onClick={onStop}
            aria-label={t.end}
            className="h-14 rounded-full bg-mahogany px-8 text-[15px] text-cream shadow-md hover:bg-mahogany/90 active:scale-95"
          >
            <PhoneDisconnect size={20} weight="fill" />
            {t.end}
          </Button>
        ) : (
          <Button
            variant="gold"
            disabled={connecting}
            onClick={onStart}
            aria-label={t.startAria}
            className="h-14 rounded-full px-8 text-[15px] active:scale-95"
          >
            {connecting ? (
              <Waveform
                size={20}
                className="animate-pulse motion-reduce:animate-none"
              />
            ) : (
              <Microphone size={20} weight="fill" />
            )}
            {connecting ? t.connecting : t.start}
          </Button>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {live ? <Headphones size={13} /> : <Microphone size={13} />}
        {live ? t.footer.tip : t.orbHint}
      </p>
    </div>
  )
})
