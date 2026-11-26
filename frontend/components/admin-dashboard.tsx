"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/lib/i18n"

const loading = () => <Skeleton className="h-40 w-full" />

const tabs = {
  overview: dynamic(
    () => import("./admin/overview-tab").then((m) => m.OverviewTab),
    { loading }
  ),
  knowledge: dynamic(
    () => import("./admin/knowledge-tab").then((m) => m.KnowledgeTab),
    { loading }
  ),
  tools: dynamic(() => import("./admin/tools-tab").then((m) => m.ToolsTab), {
    loading,
  }),
  sessions: dynamic(
    () => import("./admin/sessions-tab").then((m) => m.SessionsTab),
    { loading }
  ),
}

type TabKey = keyof typeof tabs

export function AdminDashboard() {
  const { t } = useLocale()
  const router = useRouter()
  const c = t.admin
  const [tab, setTab] = useState<TabKey>("overview")
  const ActiveTab = tabs[tab]

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="alpona-field absolute inset-0 mask-[radial-gradient(ellipse_70%_52%_at_50%_-8%,black,transparent)] opacity-40" />
        <div className="absolute -top-64 left-1/2 size-168 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand-saffron)_14%,transparent),transparent_68%)]" />
      </div>
      <div
        aria-hidden
        className="paper-grain pointer-events-none fixed inset-0 z-20"
      />

      <main className="relative z-10 mx-auto min-h-dvh w-full max-w-5xl px-5 py-10 sm:px-10">
        <div className="mb-9 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-alta to-crimson ring-1 ring-primary/20">
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
            <div>
              <p className="tracking-label text-[10.5px] font-medium text-muted-foreground uppercase">
                {t.brand}
              </p>
              <h1 className="mt-1 font-heading text-3xl leading-none font-semibold tracking-tight">
                {c.title}
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => router.push("/")}
          >
            <ArrowLeft size={16} />
            {c.back}
          </Button>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value in tabs) setTab(value as TabKey)
          }}
        >
          <TabsList className="rounded-full border border-border/60 bg-card/70 p-1 backdrop-blur">
            <TabsTrigger value="overview">{c.overview}</TabsTrigger>
            <TabsTrigger value="knowledge">{c.knowledge}</TabsTrigger>
            <TabsTrigger value="tools">{c.tools}</TabsTrigger>
            <TabsTrigger value="sessions">{c.sessions}</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-6 space-y-5">
            <ActiveTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
