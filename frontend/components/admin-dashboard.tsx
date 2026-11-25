"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Upload } from "@phosphor-icons/react"
import { toast, Toaster } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_BASE_URL } from "@/lib/api"
import { useLocale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Stack = {
  stack: { layer: string; name: string }[]
  status: Record<string, string | number | boolean>
}
type DocumentRow = {
  id: string
  title: string
  source_uri: string
  created_at: string
  chunks: number
}
type ToolRow = { name: string; enabled: boolean }
type SessionRow = { id: string; started_at: string; ended_at: string | null; messages: number }

export function AdminDashboard() {
  const { t } = useLocale()
  const router = useRouter()
  const c = t.admin
  const [stack, setStack] = useState<Stack | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [tools, setTools] = useState<ToolRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, d, to, se] = await Promise.all(
        ["stack", "knowledge", "tools", "sessions"].map((path) =>
          fetch(`${API_BASE_URL}/api/admin/${path}`).then((r) => {
            if (!r.ok) throw new Error(path)
            return r.json()
          })
        )
      )
      setStack(s)
      setDocuments(d)
      setTools(to)
      setSessions(se)
    } catch {
      toast.error("Backend unreachable")
    }
  }, [])

  useEffect(() => {
    // Data lives on the backend, so it can only be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch(`${API_BASE_URL}/api/admin/knowledge`, { method: "POST", body })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      toast.success(`${result.title} · ${result.chunks} ${c.chunks.toLowerCase()}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm(c.delete + "?")) return
    await fetch(`${API_BASE_URL}/api/admin/knowledge/${id}`, { method: "DELETE" })
    await load()
  }

  const toggle = async (name: string, enabled: boolean) => {
    setTools((prev) => prev.map((tool) => (tool.name === name ? { ...tool, enabled } : tool)))
    await fetch(`${API_BASE_URL}/api/admin/tools/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-10 sm:px-10">
      <Toaster />
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{c.title}</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft size={16} />
          {c.back}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{c.overview}</TabsTrigger>
          <TabsTrigger value="knowledge">{c.knowledge}</TabsTrigger>
          <TabsTrigger value="tools">{c.tools}</TabsTrigger>
          <TabsTrigger value="sessions">{c.sessions}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{c.overview}</CardTitle>
            </CardHeader>
            <CardContent>
              {!stack ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{c.layer}</TableHead>
                      <TableHead>{c.name}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stack.stack.map((row) => (
                      <TableRow key={row.layer}>
                        <TableCell className="text-muted-foreground">{row.layer}</TableCell>
                        <TableCell>{row.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stack?.status ?? {}).map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {key}: {String(value)}
              </Badge>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{c.upload}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                id="knowledge-file"
                type="file"
                accept=".pdf,.md,.markdown,.txt"
                className="hidden"
                disabled={busy}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
              <Label
                htmlFor="knowledge-file"
                className={cn(buttonVariants(), "cursor-pointer", busy && "opacity-50")}
              >
                <Upload size={16} />
                {c.upload}
              </Label>
              <p className="text-xs text-muted-foreground">{c.uploadHint}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.name}</TableHead>
                    <TableHead>{c.chunks}</TableHead>
                    <TableHead>{c.started}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        {c.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.title}</TableCell>
                        <TableCell>{row.chunks}</TableCell>
                        <TableCell>{row.created_at.slice(0, 10)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => void remove(row.id)}>
                            {c.delete}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="mt-5">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.name}</TableHead>
                    <TableHead>{c.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell className="font-mono text-sm">{tool.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={tool.enabled}
                            onCheckedChange={(value) => void toggle(tool.name, value)}
                            aria-label={tool.name}
                          />
                          <span className="text-sm text-muted-foreground">
                            {tool.enabled ? c.enabled : "—"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-5">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.started}</TableHead>
                    <TableHead>{c.messages}</TableHead>
                    <TableHead>{c.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {c.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.started_at.slice(0, 16).replace("T", " ")}</TableCell>
                        <TableCell>{row.messages}</TableCell>
                        <TableCell>{row.ended_at ? "—" : "●"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
