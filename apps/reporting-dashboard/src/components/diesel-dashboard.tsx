"use client"

import { useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

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
import { moneyExact, num } from "@/lib/format"
import {
  aggregateFuelRows,
  type FuelPayload,
  type FuelRow,
} from "@/lib/fuel"
import { MONTH_NAMES } from "@/lib/settlement"

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function ownerTotals(rows: FuelRow[]): Array<{
  owner: string
  gallons: number
  spend: number
  transactions: number
  trucks: number
}> {
  const byOwner: Record<
    string,
    { gallons: number; spend: number; transactions: number; trucks: Set<string> }
  > = {}
  for (const row of rows) {
    const owner = row.owner || "(sin owner)"
    if (!byOwner[owner]) {
      byOwner[owner] = { gallons: 0, spend: 0, transactions: 0, trucks: new Set() }
    }
    const bucket = byOwner[owner]
    bucket.transactions += 1
    if (row.gallons != null) bucket.gallons += row.gallons
    if (row.adjustedSubTotal != null) bucket.spend += row.adjustedSubTotal
    if (row.unit) bucket.trucks.add(row.unit)
  }
  return Object.entries(byOwner)
    .map(([owner, value]) => ({
      owner,
      gallons: value.gallons,
      spend: value.spend,
      transactions: value.transactions,
      trucks: value.trucks.size,
    }))
    .sort((a, b) => b.gallons - a.gallons || a.owner.localeCompare(b.owner))
}

export function DieselDashboard({ data }: { data: FuelPayload }) {
  const months = useMemo(() => {
    const fromData = data.meta.months.length ? data.meta.months : []
    const current = currentMonthKey()
    const set = new Set(fromData)
    set.add(current)
    return [...set].sort()
  }, [data.meta.months])

  const ownersAll = useMemo(
    () =>
      [...new Set(data.rows.map((row) => row.owner).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [data.rows]
  )

  const defaultMonth = months.includes(currentMonthKey())
    ? currentMonthKey()
    : (months[months.length - 1] ?? currentMonthKey())

  const [month, setMonth] = useState(defaultMonth)
  const [owner, setOwner] = useState("all")
  const [truckQuery, setTruckQuery] = useState("")

  const monthItems = useMemo(
    () => months.map((value) => ({ value, label: monthLabel(value) })),
    [months]
  )
  const ownerItems = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...ownersAll.map((value) => ({ value, label: value })),
    ],
    [ownersAll]
  )

  const monthIndex = months.indexOf(month)

  const filtered = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (!row.storeDate.startsWith(month)) return false
      if (owner !== "all" && row.owner !== owner) return false
      if (
        query &&
        !row.unit.toLowerCase().includes(query) &&
        !row.product.toLowerCase().includes(query) &&
        !row.city.toLowerCase().includes(query)
      ) {
        return false
      }
      return true
    })
  }, [data.rows, month, owner, truckQuery])

  const kpi = useMemo(() => aggregateFuelRows(filtered), [filtered])
  const byOwner = useMemo(() => ownerTotals(filtered), [filtered])

  return (
    <DashboardShell
      title="Diesel"
      subtitle={`${monthLabel(month)} · ${kpi.transactions} tx · ${kpi.distinctTrucks} camiones`}
      live={Boolean(data.meta.live)}
    >
      {data.meta.error ? (
        <Card>
          <CardHeader>
            <CardTitle>No se pudo cargar Diesel</CardTitle>
            <CardDescription>
              Solo consulta live de agent-reporting (fuel). No hay snapshot embebido.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{data.meta.error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Mes</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={monthIndex <= 0}
                  onClick={() => setMonth(months[monthIndex - 1] ?? month)}
                >
                  <ChevronLeftIcon />
                </Button>
                <Select
                  items={monthItems}
                  value={month}
                  onValueChange={(value) => {
                    if (typeof value === "string") setMonth(value)
                  }}
                >
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {monthItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                  onClick={() => setMonth(months[monthIndex + 1] ?? month)}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
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
              <FieldLabel>Camión / producto / ciudad</FieldLabel>
              <Input
                value={truckQuery}
                onChange={(event) => setTruckQuery(event.target.value)}
                placeholder="Buscar"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Galones" value={num(kpi.gallons)} />
        <KpiCard label="Gasto ajustado" value={moneyExact(kpi.adjustedSpend)} />
        <KpiCard label="Transacciones" value={String(kpi.transactions)} />
        <KpiCard label="Camiones" value={String(kpi.distinctTrucks)} />
        <KpiCard
          label="$ / gal"
          value={
            kpi.pricePerGallon == null ? "—" : moneyExact(kpi.pricePerGallon)
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por owner</CardTitle>
          <CardDescription>
            Atribución histórica fuel.owner · mes {monthLabel(month)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Galones</TableHead>
                  <TableHead className="text-right">Gasto aj.</TableHead>
                  <TableHead className="text-right">Tx</TableHead>
                  <TableHead className="text-right">Camiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOwner.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Sin filas
                    </TableCell>
                  </TableRow>
                ) : (
                  byOwner.map((row) => (
                    <TableRow key={row.owner}>
                      <TableCell>{row.owner}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {num(row.gallons)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.spend)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.transactions}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.trucks}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
          <CardDescription>
            Reporte fuel · grano transacción · Store Date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Date</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Adj. SubTotal</TableHead>
                  <TableHead className="text-right">$/gal</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Sin filas
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono tabular-nums">
                        {row.storeDate || "—"}
                      </TableCell>
                      <TableCell>
                        {row.unit ? (
                          <Badge variant="secondary">{row.unit}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{row.owner || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {row.product || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.gallons == null ? "—" : num(row.gallons)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.adjustedSubTotal == null
                          ? "—"
                          : moneyExact(row.adjustedSubTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.pricePerGallon == null
                          ? "—"
                          : moneyExact(row.pricePerGallon)}
                      </TableCell>
                      <TableCell>{row.city || "—"}</TableCell>
                      <TableCell>{row.state || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            #{filtered.length} · gasto ajustado en {kpi.adjustedSpendCount} tx con
            Adjusted SubTotal
          </p>
        </CardContent>
      </Card>

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>
          Diesel = transacciones live de fuel. Owner es histórico de la
          transacción, no el master actual de trucks.
        </p>
        <details>
          <summary className="cursor-pointer text-foreground">Datos técnicos</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              Dataset: <strong>{data.meta.dataset}</strong> · total_count=
              <strong>{data.meta.total_count}</strong> · fetched=
              <strong>{data.meta.fetched_count}</strong> · pagination_complete=
              <strong>{String(data.meta.pagination_complete)}</strong> · live=
              <strong>{String(Boolean(data.meta.live))}</strong> · distinct_trucks
              (ventana)=<strong>{data.meta.distinct_trucks}</strong>.
            </p>
            <p>
              Filtros UI: mes=<strong>{month}</strong>, owner=
              <strong>{owner}</strong>, search=&quot;{truckQuery}&quot; ·
              selección=<strong>{filtered.length}</strong> tx.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: grano transacción (no contar filas como camiones). Gasto
              ajustado = suma de Adjusted SubTotal poblado; no sustituye SubTotal
              cuando Adjusted es null. $/gal agregado = gasto ajustado ÷ galones.
              Ventana ≥12 meses con store_from/store_to. Solo live agent-reporting;
              sin snapshot.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
