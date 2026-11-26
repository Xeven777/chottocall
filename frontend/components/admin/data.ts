"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { API_BASE_URL } from "@/lib/api"

export type Stack = {
  stack: { layer: string; name: string }[]
  status: Record<string, string | number | boolean>
}
export type DocumentRow = {
  id: string
  title: string
  source_uri: string
  created_at: string
  chunks: number
}
export type ToolRow = { name: string; enabled: boolean }
export type SessionRow = {
  id: string
  started_at: string
  ended_at: string | null
  messages: number
}
export type MessageRow = { id: number; role: string; text: string; at: string }

export const TTL = { fresh: 90_000, static: 20 * 60_000 }
const cache = new Map<string, { at: number; data: unknown }>()

export function clearCached(path: string) {
  cache.delete(path)
}

export async function getJson<T>(
  path: string,
  ttl: number,
  force = false
): Promise<T> {
  const hit = cache.get(path)
  if (!force && hit && Date.now() - hit.at < ttl) return hit.data as T
  const response = await fetch(`${API_BASE_URL}/api/admin/${path}`)
  if (!response.ok) throw new Error(await response.text())
  const data = (await response.json()) as T
  cache.set(path, { at: Date.now(), data })
  return data
}

/** Fetches on mount (once per tab visit); `reload(true)` bypasses the cache. */
export function useAdminData<T>(path: string, ttl: number, initial: T) {
  const [data, setData] = useState<T>(initial)
  const reload = useCallback(
    async (force = false) => {
      try {
        setData(await getJson<T>(path, ttl, force))
      } catch {
        toast.error("Backend unreachable")
      }
    },
    [path, ttl]
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])
  return [data, setData, reload] as const
}
