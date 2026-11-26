"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "@phosphor-icons/react"
import { Toaster } from "sonner"
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
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-10 sm:px-10">
      <Toaster richColors />
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{c.title}</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
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
        <TabsList>
          <TabsTrigger value="overview">{c.overview}</TabsTrigger>
          <TabsTrigger value="knowledge">{c.knowledge}</TabsTrigger>
          <TabsTrigger value="tools">{c.tools}</TabsTrigger>
          <TabsTrigger value="sessions">{c.sessions}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-5 space-y-5">
          <ActiveTab />
        </TabsContent>
      </Tabs>
    </main>
  )
}
