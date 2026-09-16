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
  if (!iso) return "Sin fecha"
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
      { value: "all", label: "Todas" },
      ...insurers.map((value) => ({ value, label: value })),
    ],
    [insurers]
  )
  const datedItems = useMemo(
    () => [
      { value: "all", label: "Todas" },
      { value: "dated", label: "Con fecha" },
      { value: "undated", label: "Sin fecha" },
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
      subtitle={`${filtered.length} filas · ${distinctTrucks} camiones`}
      live={Boolean(data.meta.live)}
    >
      {data.meta.error ? (
        <Card>
          <CardHeader>
            <CardTitle>No se pudo cargar Trucks Return</CardTitle>
            <CardDescription>
              Requiere AGENT_REPORTING_KEY server-only para el reporte returns.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{data.meta.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Camión / conductor</FieldLabel>
              <Input
                value={truckQuery}
                onChange={(event) => setTruckQuery(event.target.value)}
                placeholder="Buscar"
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
          <CardTitle>Retornos esperados</CardTitle>
          <CardDescription>
            Reporte returns · grano conductor (equipos = 2 filas por camión)
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
                      Sin filas
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
            #{filtered.length} filas · {distinctTrucks} camiones distintos
          </p>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>Lista actual de retornos esperados (returns). Phone y CDL no se muestran.</p>
        <details>
          <summary className="cursor-pointer text-foreground">Datos técnicos</summary>
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
              Filtros UI: search=&quot;{truckQuery}&quot;, insurance=
              <strong>{insurance}</strong>, return_date=<strong>{datedOnly}</strong> ·
              selección=<strong>{filtered.length}</strong> filas · distinct trucks=
              <strong>{distinctTrucks}</strong>.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: grano driver-row (equipos suelen tener dos filas). Contar
              distinct Truck para totales de camión. Return Date null = sin fecha
              almacenada. Phone Number y CDL son sensibles y no se solicitan. No
              usar Ninox_ID ni nombre como sustituto de CDL. as_of es hora de
              request, no sync Ninox.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
