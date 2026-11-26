"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLocale } from "@/lib/i18n"

import { TTL, useAdminData, type Stack } from "./data"

export function OverviewTab() {
  const { t } = useLocale()
  const c = t.admin
  const [stack] = useAdminData<Stack | null>("stack", TTL.static, null)

  return (
    <>
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
                    <TableCell className="text-muted-foreground">
                      {row.layer}
                    </TableCell>
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
    </>
  )
}
