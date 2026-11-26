"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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

import { clearCached, TTL, useAdminData, type ToolRow } from "./data"

export function ToolsTab() {
  const { t } = useLocale()
  const c = t.admin
  const [tools, setTools] = useAdminData<ToolRow[]>("tools", TTL.fresh, [])

  const toggle = async (name: string, enabled: boolean) => {
    setTools((prev) =>
      prev.map((tool) => (tool.name === name ? { ...tool, enabled } : tool))
    )
    clearCached("tools")
    await fetch(`${API_BASE_URL}/api/admin/tools/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
  }

  return (
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
  )
}
