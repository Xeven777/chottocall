"use client"

import { Fragment, useState } from "react"
import {
  CaretDown,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  CircleNotch,
  Clock,
  Trash,
  UserCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { AlponaMark } from "@/components/alpona"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { API_BASE_URL } from "@/lib/api"
import { useLocale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import {
  clearCached,
  getJson,
  TTL,
  useAdminData,
  type MessageRow,
  type SessionRow,
} from "./data"

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  return `${seconds}s`
}

export function SessionsTab() {
  const { t, locale } = useLocale()
  const c = t.admin
  const localeTag = locale === "bn" ? "bn-BD" : "en-GB"
  const [sessions, , reload] = useAdminData<SessionRow[]>(
    "sessions",
    TTL.fresh,
    []
  )
  const [open, setOpen] = useState<{
    id: string
    messages: MessageRow[] | null
  } | null>(null)

  const toggleSession = async (id: string) => {
    if (open?.id === id) {
      setOpen(null)
      return
    }
    setOpen({ id, messages: null })
    try {
      const ended = sessions.find((session) => session.id === id)?.ended_at
      const detail = await getJson<{ messages: MessageRow[] }>(
        `sessions/${id}`,
        ended ? TTL.static : TTL.fresh
      )
      // Ignore a response the user has already clicked away from.
      setOpen((prev) =>
        prev?.id === id ? { id, messages: detail.messages } : prev
      )
    } catch (error) {
      setOpen((prev) => (prev?.id === id ? null : prev))
      toast.error(
        error instanceof Error ? error.message : "Could not load the call"
      )
    }
  }

  const removeSession = async (id: string) => {
    if (!window.confirm(c.deleteConfirm)) return
    const response = await fetch(`${API_BASE_URL}/api/admin/sessions/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      toast.error(await response.text())
      return
    }
    clearCached(`sessions/${id}`)
    setOpen((prev) => (prev?.id === id ? null : prev))
    await reload(true)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c.started}</TableHead>
              <TableHead>{c.duration}</TableHead>
              <TableHead>{c.messages}</TableHead>
              <TableHead>{c.status}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {c.empty}
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((row) => {
                const isOpen = open?.id === row.id
                const end = row.ended_at ? new Date(row.ended_at) : new Date()
                const duration =
                  end.getTime() - new Date(row.started_at).getTime()
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className={cn("cursor-pointer", isOpen && "bg-muted/40")}
                      onClick={() => void toggleSession(row.id)}
                    >
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`session-${row.id}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void toggleSession(row.id)
                          }}
                          className="flex items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {isOpen ? (
                            <CaretDown
                              size={13}
                              weight="bold"
                              className="text-muted-foreground"
                            />
                          ) : (
                            <CaretRight
                              size={13}
                              weight="bold"
                              className="text-muted-foreground"
                            />
                          )}
                          {new Date(row.started_at).toLocaleString(localeTag, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={13} />
                          {formatDuration(duration)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <ChatCircleText size={13} />
                          {row.messages}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.ended_at ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="gap-1.5 font-normal text-muted-foreground"
                            >
                              <CheckCircle size={12} weight="fill" />
                              {c.ended}
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              {new Date(row.ended_at).toLocaleTimeString(
                                localeTag,
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1.5 border-primary/30 font-normal text-primary"
                          >
                            <span className="relative flex size-1.5">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                            </span>
                            {c.live}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={c.deleteCall}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation()
                            void removeSession(row.id)
                          }}
                        >
                          <Trash size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          id={`session-${row.id}`}
                          colSpan={5}
                          className="bg-muted/25 p-0"
                        >
                          <div className="max-h-96 overflow-y-auto px-4 py-4">
                            {open.messages === null ? (
                              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CircleNotch
                                  size={14}
                                  className="animate-spin"
                                />
                                {c.messages}
                              </p>
                            ) : open.messages.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                {c.noMessages}
                              </p>
                            ) : (
                              <ol className="flex flex-col gap-4">
                                {open.messages.map((message) => {
                                  const isUser = message.role === "user"
                                  return (
                                    <li key={message.id} className="flex gap-3">
                                      <span
                                        className={cn(
                                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                                          isUser
                                            ? "bg-secondary text-muted-foreground"
                                            : "bg-primary/10 text-primary"
                                        )}
                                      >
                                        {isUser ? (
                                          <UserCircle size={14} />
                                        ) : (
                                          <AlponaMark className="size-3.5" />
                                        )}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline gap-2">
                                          <span
                                            className={cn(
                                              "text-[11px] font-medium tracking-wide",
                                              isUser
                                                ? "text-muted-foreground"
                                                : "text-primary"
                                            )}
                                          >
                                            {isUser
                                              ? t.speaker.user
                                              : t.speaker.bot}
                                          </span>
                                          <time
                                            lang="en"
                                            className="font-mono text-[10.5px] text-muted-foreground"
                                          >
                                            {new Date(
                                              message.at
                                            ).toLocaleTimeString(localeTag, {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </time>
                                        </div>
                                        <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                                          {message.text}
                                        </p>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ol>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
