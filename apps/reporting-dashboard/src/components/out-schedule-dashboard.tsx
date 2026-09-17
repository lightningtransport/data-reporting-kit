"use client"

import { useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { KpiValue } from "@/components/kpi-value"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
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
import type { OutSchedulePayload } from "@/lib/out-schedule"
import {
  addDaysIso,
  collapseTruckRows,
  currentMonday,
  distinctTrucksInWeek,
  formatOpsDate,
  shiftCalendarMonday,
  weekRangeLabel,
  weekdayTruckStrip,
  type CollapsedTruckRow,
} from "@/lib/ops-table"

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <KpiValue>{value}</KpiValue>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

function toCsv(rows: CollapsedTruckRow[]): string {
  const headers = [
    "Truck",
    "Out Date",
    "Day",
    "Driver 1",
    "Driver 2",
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
        row.eventDate,
        row.day,
        row.driver1,
        row.driver2,
        row.fields.owner ?? "",
        row.fields.dispatch ?? "",
        row.fields.flatbed ?? "",
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

  const [focusMonday, setFocusMonday] = useState(() => currentMonday())
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

  const filteredSource = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (
        query &&
        !row.truck.toLowerCase().includes(query) &&
        !row.team.toLowerCase().includes(query) &&
        !row.driver2.toLowerCase().includes(query)
      ) {
        return false
      }
      if (owner !== "all" && row.owner !== owner) return false
      if (dispatch !== "all" && row.dispatch !== dispatch) return false
      return true
    })
  }, [data.rows, truckQuery, owner, dispatch])

  const collapsedAll = useMemo(
    () =>
      collapseTruckRows(
        filteredSource.map((row) => ({
          truck: row.truck,
          eventDate: row.outDate,
          drivers: [row.team, row.driver2].filter(Boolean),
          fields: {
            owner: row.owner,
            dispatch: row.dispatch,
            flatbed: row.flatbed,
            soloFlag: row.solo,
          },
        }))
      ),
    [filteredSource]
  )

  const nextMonday = addDaysIso(focusMonday, 7)
  const leavingThisWeek = useMemo(
    () => distinctTrucksInWeek(collapsedAll, focusMonday),
    [collapsedAll, focusMonday]
  )
  const leavingNextWeek = useMemo(
    () => distinctTrucksInWeek(collapsedAll, nextMonday),
    [collapsedAll, nextMonday]
  )

  const tableRows = useMemo(
    () =>
      collapsedAll.filter(
        (row) => row.eventDate && row.eventDate >= focusMonday && row.eventDate <= addDaysIso(focusMonday, 6)
      ),
    [collapsedAll, focusMonday]
  )

  const dayStrip = useMemo(
    () => weekdayTruckStrip(collapsedAll, focusMonday),
    [collapsedAll, focusMonday]
  )
  const daysWithData = dayStrip.filter((day) => day.count > 0).length

  const extraDrivers = tableRows.some((row) => row.extraDrivers)
  const thisLabel = weekRangeLabel(focusMonday)
  const nextLabel = weekRangeLabel(nextMonday)

  function exportCsv() {
    const blob = new Blob([toCsv(tableRows)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `out-schedule-${focusMonday}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardShell
      title="Out Schedule"
      subtitle={`${tableRows.length} trucks · ${thisLabel}`}
      live={Boolean(data.meta.live)}
      actions={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={tableRows.length === 0}>
          <DownloadIcon data-icon="inline-start" />
          Export Schedule
        </Button>
      }
    >
      {data.meta.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load Out Schedule</AlertTitle>
          <AlertDescription>
            The live Schedule_Teams share did not respond. DriverPay is not used
            as a fallback. {data.meta.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm">
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel>Week</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setFocusMonday(shiftCalendarMonday(focusMonday, -1))}
                >
                  <ChevronLeftIcon />
                </Button>
                <div className="min-w-0 flex-1 rounded-lg border border-input px-2.5 py-1.5 text-sm">
                  Mon–Sun · {thisLabel}
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setFocusMonday(shiftCalendarMonday(focusMonday, 1))}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>Truck / driver</FieldLabel>
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

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Leaving this week"
          value={String(leavingThisWeek)}
          hint={thisLabel}
        />
        <KpiCard
          label="Leaving next week"
          value={String(leavingNextWeek)}
          hint={nextLabel}
        />
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dayStrip.map((day) => (
          <div
            key={day.iso}
            className="rounded-lg border border-border px-1 py-1.5 text-center"
          >
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {day.label}
            </div>
            <div className="font-heading text-sm tabular-nums">{day.count}</div>
          </div>
        ))}
      </div>
      {daysWithData < 7 ? (
        <p className="text-muted-foreground -mt-2 text-xs">
          Live Schedule_Teams only shows days still in the share ({daysWithData}/7 days with
          trucks). Past planned days are not retained here.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Planned departures</CardTitle>
          <CardDescription>
            One row per truck per Out Date · week {thisLabel}
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
                  <TableHead>Driver 1</TableHead>
                  <TableHead>Driver 2</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Dispatch</TableHead>
                  <TableHead>Flatbed</TableHead>
                  <TableHead>Solo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <Empty className="border-0 py-8">
                        <EmptyHeader>
                          <EmptyTitle>No rows</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row) => (
                    <TableRow key={`${row.truck}-${row.eventDate}`}>
                      <TableCell>
                        {row.truck ? (
                          <Badge variant="secondary">{row.truck}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatOpsDate(row.eventDate)}
                      </TableCell>
                      <TableCell>{row.day || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate uppercase">
                        {row.driver1 || "—"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate uppercase">
                        {row.driver2 || "—"}
                      </TableCell>
                      <TableCell>{row.fields.owner || "—"}</TableCell>
                      <TableCell>{row.fields.dispatch || "—"}</TableCell>
                      <TableCell>{row.fields.flatbed || "—"}</TableCell>
                      <TableCell>{row.solo}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            #{tableRows.length} trucks · source rows {filteredSource.length}
          </p>
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
              Focus week Mon–Sun <strong>{focusMonday}</strong>–
              <strong>{addDaysIso(focusMonday, 6)}</strong> ({thisLabel}) · days with data=
              <strong>{daysWithData}</strong>/7 · leaving this week=
              <strong>{leavingThisWeek}</strong> · leaving next week=
              <strong>{leavingNextWeek}</strong> ({nextLabel}).
            </p>
            <p>
              UI filters: search=&quot;{truckQuery}&quot;, owner=
              <strong>{owner}</strong>, dispatch=<strong>{dispatch}</strong> · table=
              <strong>{tableRows.length}</strong> trucks · source rows=
              <strong>{filteredSource.length}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: KPIs and table use distinct trucks after collapsing driver-grain
              rows on (Truck, Out Date) into Driver 1 / Driver 2. Week nav is calendar
              Mon–Sun (±7 days). Schedule_Teams is a live planned list — days or weeks with
              no rows are not retained in this screen. Insurance / Team Status / Truck
              Status / Notes are not on this share. Do not substitute DriverPay. as_of is
              request time.
              {extraDrivers
                ? " One or more trucks had more than two driver names; extras are appended in Driver 2."
                : ""}
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
