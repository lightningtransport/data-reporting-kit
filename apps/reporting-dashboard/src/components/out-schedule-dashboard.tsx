"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react"

import { DashboardShell, TechnicalDetails } from "@/components/dashboard-shell"
import { KpiValue } from "@/components/kpi-value"
import { DepartureKpis } from "@/components/departure-kpis"
import { loadDepartureWeeks, type DepartureWeeks } from "@/lib/departures-client"
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
import type { TrucksCurrentlyOutPayload } from "@/lib/trucks-currently-out"
import {
  addDaysIso,
  collapseTruckRows,
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

export function OutScheduleDashboard({
  data,
  currentlyOut,
  initialMonday,
  initialDepartureWeeks,
}: {
  data: OutSchedulePayload
  currentlyOut: TrucksCurrentlyOutPayload
  initialMonday: string
  initialDepartureWeeks: DepartureWeeks
}) {
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

  const [focusMonday, setFocusMonday] = useState(initialMonday)
  const [departureWeeks, setDepartureWeeks] = useState({ monday: initialMonday, reports: initialDepartureWeeks })
  const firstDepartureEffect = useRef(true)
  useEffect(() => {
    if (firstDepartureEffect.current) {
      firstDepartureEffect.current = false
      return
    }
    const controller = new AbortController()
    void loadDepartureWeeks(focusMonday, controller.signal).then((reports) => {
      if (!controller.signal.aborted) setDepartureWeeks({ monday: focusMonday, reports })
    })
    return () => controller.abort()
  }, [focusMonday])
  // A newly selected week must never display the previous week's total during fetch.
  const focusedDepartures = departureWeeks.monday === focusMonday ? departureWeeks.reports : null
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

  const tableRows = collapsedAll.filter(
    (row) => row.eventDate && row.eventDate >= focusMonday && row.eventDate <= addDaysIso(focusMonday, 6)
  )
  const dayStrip = weekdayTruckStrip(collapsedAll, focusMonday)
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
      subtitle={`${tableRows.length} Schedule_Teams-only table rows · ${thisLabel}`}
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
          <AlertTitle>Couldn&apos;t load Out Schedule</AlertTitle>
          <AlertDescription>
            The live Schedule_Teams table did not respond. The table has no DriverPay
            fallback; combined departure KPI availability is shown separately.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm">
        <CardContent className="pt-(--card-spacing)">
          <p className="text-muted-foreground mb-3 text-xs">Schedule_Teams-only filters: search, owner and dispatch do not filter the combined departure KPIs.</p>
          <FieldGroup className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel>Week</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => setFocusMonday(shiftCalendarMonday(focusMonday, -1))}
                >
                  <ChevronLeftIcon />
                </Button>
                <div className="min-w-0 flex-1 rounded-lg border border-input px-2.5 py-1.5 text-sm">
                  Mon–Sun · {thisLabel}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label="On road today"
          value={
            currentlyOut.meta.error ? "—" : String(currentlyOut.count)
          }
          hint={
            currentlyOut.meta.error
              ? "DriverPay unavailable"
              : "DriverPay · active date interval"
          }
        />
        <DepartureKpis thisWeek={focusedDepartures?.thisWeek ?? null} nextWeek={focusedDepartures?.nextWeek ?? null} />
      </div>

      <p className="text-muted-foreground text-xs">Schedule_Teams-only day strip · filtered live planned trucks, not combined departures</p>
      <div className="grid grid-cols-7 gap-1.5">
        {dayStrip.map((day) => (
          <div
            key={day.iso}
            className="min-h-11 rounded-lg border border-border px-1 py-2 text-center"
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
          <CardTitle>Schedule_Teams-only planned departures</CardTitle>
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
        <p>Table and day strip: live Schedule_Teams only. Departure KPIs: distinct DriverPay + live Schedule_Teams union by Out Date.</p>
        <TechnicalDetails>
            {[focusedDepartures?.thisWeek, focusedDepartures?.nextWeek].map((report, index) => (
              <div key={index} className="space-y-1">
                <p>Departure union {index === 0 ? "selected" : "following"} week: {report ? `${report.period.out_from}–${report.period.out_to} · status=${report.status} · complete=${String(report.complete)} · as_of=${report.as_of ?? "unknown"} · freshness=${report.source_freshness ?? "DriverPay sync unknown; live Schedule_Teams fetched per request"}` : "loading"}.</p>
                {report ? <>
                  <p>Sources: {JSON.stringify(report.source_status ?? "unknown")} · Reconciliation: {JSON.stringify(report.reconciliation)}</p>
                  <p className="break-words">Truck sets: {JSON.stringify(report.truck_sets)}</p>
                </> : null}
              </div>
            ))}
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
              <strong>{daysWithData}</strong>/7 in the Schedule_Teams-only day strip. Following week: {nextLabel}. Timezone: America/New_York.
            </p>
            <p>
              Schedule_Teams-only UI filters: search=&quot;{truckQuery}&quot;, owner=
              <strong>{owner}</strong>, dispatch=<strong>{dispatch}</strong> · table=
              <strong>{tableRows.length}</strong> trucks · source rows=
              <strong>{filteredSource.length}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              On road today (DriverPay): distinct trucks=
              <strong>{currentlyOut.count}</strong> · on_road_at=
              <strong>{String(currentlyOut.meta.filters.on_road_at ?? "")}</strong> ·
              fetched=
              <strong>{currentlyOut.meta.fetched_count}</strong> ·
              pagination_complete=
              <strong>{String(currentlyOut.meta.pagination_complete)}</strong>
              {currentlyOut.meta.error
                ? ` · error=${currentlyOut.meta.error}`
                : ""}
              . Out Date ≤ date and Return Date &gt; date; null returns excluded.
              Distinct Truck_Number, not driver rows. Timezone: America/New_York.
            </p>
            <p>
              Caveats: the table collapses Schedule_Teams driver-grain rows on
              (Truck, Out Date) into Driver 1 / Driver 2. Week nav is calendar
              Mon–Sun (±7 days). Schedule_Teams is a live planned list — days or weeks with
              no rows are not retained in this screen. Insurance / Team Status / Truck
              Status / Notes are not on this share. DriverPay is not a table fallback.
              Departure KPIs require both sources for the same inclusive Out Date window,
              deduplicate truck keys, and apply no return exclusions or team/solo formulas.
              A missing source leaves the combined total unavailable, never zero or schedule-only.
              Share as_of is request time; DriverPay sync freshness is unknown.
              {extraDrivers
                ? " One or more trucks had more than two driver names; extras are appended in Driver 2."
                : ""}
            </p>
        </TechnicalDetails>
      </footer>
    </DashboardShell>
  )
}
