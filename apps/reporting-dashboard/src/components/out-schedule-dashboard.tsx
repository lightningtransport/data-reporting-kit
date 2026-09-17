"use client"

import { useMemo, useState } from "react"
import { DownloadIcon } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OutSchedulePayload, OutScheduleRow } from "@/lib/out-schedule"

function formatOutDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—"
  const [, month, day] = iso.split("-")
  return `${month}/${day}/${iso.slice(0, 4)}`
}

function toCsv(rows: OutScheduleRow[]): string {
  const headers = [
    "Truck",
    "Out Date",
    "Day",
    "Team",
    "Owner",
    "Dispatch",
    "Flatbed",
    "Solo",
  ]
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.truck,
        row.outDate,
        row.day,
        row.team,
        row.owner,
        row.dispatch,
        row.flatbed,
        row.solo,
      ]
        .map(escape)
        .join(",")
    ),
  ]
  return lines.join("\n")
}

export function OutScheduleDashboard({ data }: { data: OutSchedulePayload }) {
  const owners = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.owner).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [data.rows]
  )
  const dispatches = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.dispatch).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [data.rows]
  )

  const [truckQuery, setTruckQuery] = useState("")
  const [owner, setOwner] = useState("all")
  const [dispatch, setDispatch] = useState("all")

  const ownerItems = useMemo(
    () => [
      { value: "all", label: "All" },
      ...owners.map((value) => ({ value, label: value })),
    ],
    [owners]
  )
  const dispatchItems = useMemo(
    () => [
      { value: "all", label: "All" },
      ...dispatches.map((value) => ({ value, label: value })),
    ],
    [dispatches]
  )

  const filtered = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (
        query &&
        !row.truck.toLowerCase().includes(query) &&
        !row.team.toLowerCase().includes(query)
      ) {
        return false
      }
      if (owner !== "all" && row.owner !== owner) return false
      if (dispatch !== "all" && row.dispatch !== dispatch) return false
      return true
    })
  }, [data.rows, truckQuery, owner, dispatch])

  const distinctTrucks = useMemo(
    () => new Set(filtered.map((row) => row.truck).filter(Boolean)).size,
    [filtered]
  )

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `out-schedule-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardShell
      title="Out Schedule"
      subtitle={`${filtered.length} rows · ${distinctTrucks} trucks`}
      live={Boolean(data.meta.live)}
      actions={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <DownloadIcon data-icon="inline-start" />
          Export Schedule
        </Button>
      }
    >
      {data.meta.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load Out Schedule</CardTitle>
            <CardDescription>
              The live Schedule_Teams share did not respond. DriverPay is not used as a fallback.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{data.meta.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Truck / team</FieldLabel>
              <Input
                value={truckQuery}
                onChange={(event) => setTruckQuery(event.target.value)}
                placeholder="Search"
              />
            </Field>
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <Select
                items={ownerItems}
                value={owner}
                onValueChange={(value) => {
                  if (typeof value === "string") setOwner(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ownerItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Dispatch</FieldLabel>
              <Select
                items={dispatchItems}
                value={dispatch}
                onValueChange={(value) => {
                  if (typeof value === "string") setDispatch(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {dispatchItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planned departures</CardTitle>
          <CardDescription>
            Live Ninox Schedule_Teams · sorted by Out Date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck</TableHead>
                  <TableHead>Out Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Dispatch</TableHead>
                  <TableHead>Flatbed</TableHead>
                  <TableHead>Solo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      No rows
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.truck ? (
                          <Badge variant="secondary">{row.truck}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatOutDate(row.outDate)}
                      </TableCell>
                      <TableCell>{row.day || "—"}</TableCell>
                      <TableCell className="max-w-72 truncate uppercase">
                        {row.team || "—"}
                      </TableCell>
                      <TableCell>{row.owner || "—"}</TableCell>
                      <TableCell>{row.dispatch || "—"}</TableCell>
                      <TableCell>{row.flatbed || "—"}</TableCell>
                      <TableCell>{row.solo || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">#{filtered.length}</p>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>Planned departures (Schedule_Teams). Not DriverPay history.</p>
        <details>
          <summary className="cursor-pointer text-foreground">Technical details</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              Dataset: <strong>{data.meta.dataset}</strong> · total_count=
              <strong>{data.meta.total_count}</strong> · fetched=
              <strong>{data.meta.fetched_count}</strong> · pagination_complete=
              <strong>{String(data.meta.pagination_complete)}</strong> · live=
              <strong>{String(Boolean(data.meta.live))}</strong>.
            </p>
            <p>
              UI filters: search=&quot;{truckQuery}&quot;, owner=
              <strong>{owner}</strong>, dispatch=<strong>{dispatch}</strong> ·
              selection=<strong>{filtered.length}</strong> rows · distinct trucks=
              <strong>{distinctTrucks}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: the canonical share exposes Truck, Out Date, Team, Flatbed,
              Driver 1, solo, Owner, Dispatch. Day is derived from Out Date. Insurance /
              Team Status / Truck Status / Notes are not on this share. Do not substitute
              DriverPay. as_of is request time.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
