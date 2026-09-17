"use client"

import { useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

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
import type { ReturnsPayload } from "@/lib/returns"
import {
  addDaysIso,
  collapseTruckRows,
  currentMonday,
  distinctTrucksInWeek,
  distinctUndatedTrucks,
  formatOpsDate,
  shiftCalendarMonday,
  weekRangeLabel,
  weekdayTruckStrip,
} from "@/lib/ops-table"

function insuranceBadgeClass(insurance: string): string {
  const code = insurance.trim().toUpperCase()
  if (code === "CTC") return "border-amber-300 bg-amber-100 text-amber-950"
  if (code === "LTL") return "border-lime-300 bg-lime-100 text-lime-950"
  if (code === "CDT") return "border-slate-400 bg-slate-800 text-white"
  return ""
}

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

export function TrucksReturnDashboard({ data }: { data: ReturnsPayload }) {
  const insurers = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.insurance).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [data.rows]
  )

  const [focusMonday, setFocusMonday] = useState(() => currentMonday())
  const [truckQuery, setTruckQuery] = useState("")
  const [insurance, setInsurance] = useState("all")
  const [datedOnly, setDatedOnly] = useState("all")

  const insuranceItems = useMemo(
    () => [
      { value: "all", label: "All" },
      ...insurers.map((value) => ({ value, label: value })),
    ],
    [insurers]
  )
  const datedItems = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "dated", label: "Has date" },
      { value: "undated", label: "No date" },
    ],
    []
  )

  const filteredSource = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (
        query &&
        !row.truck.toLowerCase().includes(query) &&
        !row.driverName.toLowerCase().includes(query)
      ) {
        return false
      }
      if (insurance !== "all" && row.insurance !== insurance) return false
      if (datedOnly === "dated" && !row.returnDate) return false
      if (datedOnly === "undated" && row.returnDate) return false
      return true
    })
  }, [data.rows, truckQuery, insurance, datedOnly])

  const collapsedAll = useMemo(
    () =>
      collapseTruckRows(
        filteredSource.map((row) => ({
          truck: row.truck,
          eventDate: row.returnDate,
          drivers: [row.driverName],
          fields: { insurance: row.insurance },
        }))
      ),
    [filteredSource]
  )

  const nextMonday = addDaysIso(focusMonday, 7)
  const returningThisWeek = useMemo(
    () => distinctTrucksInWeek(collapsedAll, focusMonday),
    [collapsedAll, focusMonday]
  )
  const returningNextWeek = useMemo(
    () => distinctTrucksInWeek(collapsedAll, nextMonday),
    [collapsedAll, nextMonday]
  )
  const noDateTrucks = useMemo(
    () => distinctUndatedTrucks(collapsedAll),
    [collapsedAll]
  )

  const tableRows = useMemo(() => {
    if (datedOnly === "undated") {
      return collapsedAll.filter((row) => !row.eventDate)
    }
    const sunday = addDaysIso(focusMonday, 6)
    const inWeek = collapsedAll.filter(
      (row) => row.eventDate && row.eventDate >= focusMonday && row.eventDate <= sunday
    )
    if (datedOnly === "dated") return inWeek
    const undated = collapsedAll.filter((row) => !row.eventDate)
    return [...inWeek, ...undated]
  }, [collapsedAll, focusMonday, datedOnly])

  const dayStrip = useMemo(
    () => weekdayTruckStrip(collapsedAll, focusMonday),
    [collapsedAll, focusMonday]
  )
  const daysWithData = dayStrip.filter((day) => day.count > 0).length

  const extraDrivers = tableRows.some((row) => row.extraDrivers)
  const thisLabel = weekRangeLabel(focusMonday)
  const nextLabel = weekRangeLabel(nextMonday)
  const truckCount = new Set(tableRows.map((row) => row.truck)).size

  return (
    <DashboardShell
      title="Trucks Return"
      subtitle={`${truckCount} trucks · ${thisLabel}`}
      live={Boolean(data.meta.live)}
    >
      {data.meta.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load Trucks Return</AlertTitle>
          <AlertDescription>
            Requires a server-only AGENT_REPORTING_KEY for the returns report.{" "}
            {data.meta.error}
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
                  disabled={datedOnly === "undated"}
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
                  disabled={datedOnly === "undated"}
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
              <FieldLabel>Insurance</FieldLabel>
              <Select
                items={insuranceItems}
                value={insurance}
                onValueChange={(value) => {
                  if (typeof value === "string") setInsurance(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {insuranceItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Return Date</FieldLabel>
              <Select
                items={datedItems}
                value={datedOnly}
                onValueChange={(value) => {
                  if (typeof value === "string") setDatedOnly(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {datedItems.map((item) => (
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
          label="Returning this week"
          value={String(returningThisWeek)}
          hint={thisLabel}
        />
        <KpiCard
          label="Returning next week"
          value={String(returningNextWeek)}
          hint={nextLabel}
        />
        <KpiCard label="No date" value={String(noDateTrucks)} hint="Distinct trucks" />
      </div>

      {datedOnly !== "undated" ? (
        <>
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
              Live returns only shows dates still in the list ({daysWithData}/7 days with
              trucks). Past return days are not retained here.
            </p>
          ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Expected returns</CardTitle>
          <CardDescription>
            One row per truck per Return Date · week {thisLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Driver 1</TableHead>
                  <TableHead>Driver 2</TableHead>
                  <TableHead>Insurance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <Empty className="border-0 py-8">
                        <EmptyHeader>
                          <EmptyTitle>No rows</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row) => (
                    <TableRow key={`${row.truck}-${row.eventDate || "undated"}`}>
                      <TableCell>
                        <Badge variant="secondary">{row.truck}</Badge>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatOpsDate(row.eventDate)}
                      </TableCell>
                      <TableCell>{row.day || "—"}</TableCell>
                      <TableCell className="uppercase">{row.driver1 || "—"}</TableCell>
                      <TableCell className="uppercase">{row.driver2 || "—"}</TableCell>
                      <TableCell>
                        {row.fields.insurance ? (
                          <Badge
                            variant="outline"
                            className={insuranceBadgeClass(row.fields.insurance)}
                          >
                            {row.fields.insurance}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            #{truckCount} trucks · source rows {filteredSource.length}
          </p>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>Current expected returns list. Phone and CDL are not shown.</p>
        <details>
          <summary className="cursor-pointer text-foreground">Technical details</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              Dataset: <strong>{data.meta.dataset}</strong> · total_count=
              <strong>{data.meta.total_count}</strong> · fetched=
              <strong>{data.meta.fetched_count}</strong> · pagination_complete=
              <strong>{String(data.meta.pagination_complete)}</strong> · live=
              <strong>{String(Boolean(data.meta.live))}</strong> · distinct_trucks
              (source)=<strong>{data.meta.distinct_trucks}</strong>.
            </p>
            <p>
              Focus week Mon–Sun <strong>{focusMonday}</strong>–
              <strong>{addDaysIso(focusMonday, 6)}</strong> ({thisLabel}) · days with data=
              <strong>{daysWithData}</strong>/7 · returning this week=
              <strong>{returningThisWeek}</strong> · returning next week=
              <strong>{returningNextWeek}</strong> ({nextLabel}) · no date=
              <strong>{noDateTrucks}</strong>.
            </p>
            <p>
              UI filters: search=&quot;{truckQuery}&quot;, insurance=
              <strong>{insurance}</strong>, return_date=<strong>{datedOnly}</strong> ·
              table=<strong>{tableRows.length}</strong> truck-date rows · source rows=
              <strong>{filteredSource.length}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: KPIs and table use distinct trucks after collapsing driver-grain
              rows on (Truck, Return Date) into Driver 1 / Driver 2. Week nav is calendar
              Mon–Sun (±7 days). The returns list is live/volatile — days or weeks with no
              rows are not retained in this screen (historical returns need DriverPay).
              Null Return Date = no stored date. Phone Number and CDL are sensitive and are
              not requested. Do not use Ninox_ID or a name as a CDL substitute. as_of is
              request time, not a Ninox sync stamp.
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
