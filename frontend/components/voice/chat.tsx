"use client"

import { memo } from "react"
import { Microphone } from "@phosphor-icons/react"

import { AlponaMark } from "@/components/alpona"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { Copy } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Line, Status } from "./use-voice-call"

const LineItem = memo(function LineItem({
  line,
  speaker,
}: {
  line: Line
  speaker: string
}) {
  const isUser = line.who === "user"
  const time = new Date(line.at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <Message align={isUser ? "end" : "start"} className="msg-in">
      <MessageAvatar
        className={cn(
          "mt-0.5 size-7 self-start border bg-card text-primary",
          isUser ? "border-primary/20 bg-primary/10" : "border-border/70"
        )}
      >
        {isUser ? (
          <Microphone size={14} weight="bold" />
        ) : (
          <AlponaMark className="size-4" />
        )}
      </MessageAvatar>
      <div
        className={cn(
          "flex max-w-[min(86%,44ch)] min-w-0 flex-col",
          isUser && "items-end"
        )}
      >
        <MessageHeader className="gap-2 px-1 text-[11.5px] font-normal">
          <span
            className={cn(
              "tracking-[0.06em]",
              !isUser && "font-medium text-primary"
            )}
          >
            {speaker}
          </span>
          <time lang="en" className="font-mono text-[10.5px] tabular-nums">
            {time}
          </time>
        </MessageHeader>
        <MessageContent
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-[1.7] wrap-anywhere",
            isUser
              ? "rounded-tr-md bg-linear-to-br from-alta to-crimson text-primary-foreground"
              : "rounded-tl-md border border-border/70 bg-card text-foreground"
          )}
        >
          {line.text}
        </MessageContent>
      </div>
    </Message>
  )
})

const PhraseChips = memo(function PhraseChips({
  t,
  onSelect,
}: {
  t: Copy
  onSelect: (phrase: string) => void
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 text-left">
      {t.empty.phrases.map((phrase) => (
        <Button
          key={phrase}
          variant="outline"
          size="sm"
          onClick={() => onSelect(phrase)}
          className="h-8 rounded-full border-border/80 bg-card/70 px-3.5 text-[12.5px] font-normal text-foreground/85 hover:border-primary/45 hover:bg-primary/5"
        >
          {phrase}
        </Button>
      ))}
    </div>
  )
})

export const TranscriptPanel = memo(function TranscriptPanel({
  t,
  status,
  lines,
  onStart,
  onSelectPrompt,
}: {
  t: Copy
  status: Status
  lines: Line[]
  onStart: () => void
  onSelectPrompt: (phrase: string) => void
}) {
  const live = status === "live"
  const reviewing = lines.length > 0 && !live && status !== "connecting"
  return (
    <section
      aria-label={t.transcript}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/90 shadow-md"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight">
            {reviewing ? t.review.title : t.transcript}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {lines.length === 0 ? t.transcriptSub : t.lineCount(lines.length)}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="h-7 gap-2 rounded-full bg-primary/8 text-primary"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-primary" : "bg-muted-foreground/45"
            )}
          />
          {reviewing
            ? t.transcriptBadge.recap
            : live
              ? t.transcriptBadge.live
              : t.transcriptBadge.idle}
        </Badge>
      </header>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              className={cn(
                "gap-5 px-5 py-5 sm:px-6",
                lines.length === 0 && "justify-center"
              )}
            >
              {lines.length === 0 ? (
                <Empty className="border-0 p-2">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AlponaMark className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-[18px]">
                      {t.empty.title}
                    </EmptyTitle>
                    <EmptyDescription className="text-[13px] leading-[1.7]">
                      {t.empty.description}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="mt-2">
                    <p className="tracking-label text-[10.5px] font-medium text-muted-foreground uppercase">
                      {t.empty.trySaying}
                    </p>
                    <PhraseChips t={t} onSelect={onSelectPrompt} />
                  </EmptyContent>
                </Empty>
              ) : (
                <div
                  role="log"
                  aria-live="polite"
                  aria-label={t.transcript}
                  className="flex flex-col gap-5"
                >
                  {lines.map((line) => (
                    <MessageScrollerItem
                      key={line.id}
                      messageId={line.id}
                      scrollAnchor={line.who === "user"}
                    >
                      <LineItem
                        line={line}
                        speaker={
                          line.who === "user" ? t.speaker.user : t.speaker.bot
                        }
                      />
                    </MessageScrollerItem>
                  ))}
                </div>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            <span className="sr-only">{t.transcriptJump}</span>
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>

      {reviewing && (
        <footer className="flex items-center justify-between gap-3 border-t border-border/50 bg-secondary/25 px-5 py-3 sm:px-6">
          <p className="text-[12px] text-muted-foreground">{t.review.tip}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onStart}
            className="h-8 rounded-full"
          >
            <Microphone size={14} weight="fill" />
            {t.review.newCall}
          </Button>
        </footer>
      )}
    </section>
  )
})
