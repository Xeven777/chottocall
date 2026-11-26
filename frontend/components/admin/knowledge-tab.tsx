"use client"

import { useState } from "react"
import { Trash, Upload } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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

import { TTL, useAdminData, type DocumentRow } from "./data"

export function KnowledgeTab() {
  const { t } = useLocale()
  const c = t.admin
  const [documents, , reload] = useAdminData<DocumentRow[]>(
    "knowledge",
    TTL.static,
    []
  )
  const [busy, setBusy] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch(`${API_BASE_URL}/api/admin/knowledge`, {
        method: "POST",
        body,
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      toast.success(
        `${result.title} · ${result.chunks} ${c.chunks.toLowerCase()}`
      )
      await reload(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm(c.delete + "?")) return
    await fetch(`${API_BASE_URL}/api/admin/knowledge/${id}`, {
      method: "DELETE",
    })
    await reload(true)
  }

  return (
    <>
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
            className={cn(
              buttonVariants(),
              "cursor-pointer",
              busy && "opacity-50"
            )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(row.id)}
                      >
                        <Trash size={14} />
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
    </>
  )
}
