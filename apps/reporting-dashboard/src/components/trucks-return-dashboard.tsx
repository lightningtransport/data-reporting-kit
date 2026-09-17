"use client"

import { useMemo, useState } from "react"

import { DashboardShell } from "@/components/dashboard-shell"
import { Badge } from "@/components/ui/badge"
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
import type { ReturnsPayload } from "@/lib/returns"

function insuranceBadgeClass(insurance: string): string {
  const code = insurance.trim().toUpperCase()
  if (code === "CTC") return "border-amber-300 bg-amber-100 text-amber-950"
  if (code === "LTL") return "border-lime-300 bg-lime-100 text-lime-950"
  if (code === "CDT") return "border-slate-400 bg-slate-800 text-white"
  return ""
}

function formatReturnDate(iso: string): string {
  if (!iso) return "No date"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [, month, day] = iso.split("-")
  return `${month}/${day}/${iso.slice(0, 4)}`
}

export function TrucksReturnDashboard({ data }: { data: ReturnsPayload }) {
  const insurers = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.insurance).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [data.rows]
  )
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

  const filtered = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (query && !row.truck.toLowerCase().includes(query) && !row.driverName.toLowerCase().includes(query)) {
        return false
      }
      if (insurance !== "all" && row.insurance !== insurance) return false
      if (datedOnly === "dated" && !row.returnDate) return false
      if (datedOnly === "undated" && row.returnDate) return false
      return true
    })
  }, [data.rows, truckQuery, insurance, datedOnly])

  const distinctTrucks = useMemo(
    () => new Set(filtered.map((row) => row.truck)).size,
    [filtered]
  )

  return (
    <DashboardShell
      title="Trucks Return"
      subtitle={`${filtered.length} rows · ${distinctTrucks} trucks`}
      live={Boolean(data.meta.live)}
    >
      {data.meta.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load Trucks Return</CardTitle>
            <CardDescription>
              Requires a server-only AGENT_REPORTING_KEY for the returns report.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{data.meta.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Expected returns</CardTitle>
          <CardDescription>
            returns report · driver-row grain (teams usually = 2 rows per truck)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Return Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No rows
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={`${row.id}-${row.truck}-${row.driverName}`}>
                      <TableCell>
                        <Badge variant="secondary">{row.truck}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.insurance ? (
                          <Badge
                            variant="outline"
                            className={insuranceBadgeClass(row.insurance)}
                          >
                            {row.insurance}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="uppercase">{row.driverName || "—"}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatReturnDate(row.returnDate)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            #{filtered.length} rows · {distinctTrucks} distinct trucks
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
              (fuente)=<strong>{data.meta.distinct_trucks}</strong>.
            </p>
            <p>
              UI filters: search=&quot;{truckQuery}&quot;, insurance=
              <strong>{insurance}</strong>, return_date=<strong>{datedOnly}</strong> ·
              selection=<strong>{filtered.length}</strong> rows · distinct trucks=
              <strong>{distinctTrucks}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: driver-row grain (teams usually have two rows). Count
              distinct Truck for truck totals. Null Return Date = no stored date.
              Phone Number and CDL are sensitive and are not requested. Do not use
              Ninox_ID or a name as a CDL substitute. as_of is request time, not a
              Ninox sync stamp.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
