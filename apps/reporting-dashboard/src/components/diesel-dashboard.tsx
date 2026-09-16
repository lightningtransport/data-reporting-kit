"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { DieselMonthlyTrendChart } from "@/components/diesel-charts"
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
  pickProductAgg,
  type FuelAgg,
  type FuelPayload,
  type FuelRow,
} from "@/lib/fuel"
import { MONTH_NAMES } from "@/lib/settlement"

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

function shortMonthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  const name = MONTH_NAMES[Number(month) - 1] ?? month
  const short = name.slice(0, 3)
  return `${short.charAt(0).toUpperCase()}${short.slice(1)} ${year.slice(2)}`
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

function matchesProduct(row: FuelRow, product: string): boolean {
  if (product === "all") return true
  const name = row.product.toLowerCase()
  if (product === "diesel") return name.includes("diesel") && !name.includes("def")
  if (product === "def") return name.includes("def")
  return row.product === product
}

function kpiFromAgg(agg: FuelAgg): {
  gallons: number
  adjustedSpend: number
  transactions: number
  distinctTrucks: number
  pricePerGallon: number | null
} {
  return {
    gallons: agg.gallons,
    adjustedSpend: agg.spend,
    transactions: agg.transactions,
    distinctTrucks: agg.trucks,
    pricePerGallon: agg.gallons > 0 && agg.spend > 0 ? agg.spend / agg.gallons : null,
  }
}

export function DieselDashboard({ data }: { data: FuelPayload }) {
  const months = useMemo(() => {
    const fromData = data.meta.months.length ? data.meta.months : []
    const current = currentMonthKey()
    const set = new Set(fromData)
    set.add(current)
    return [...set].sort()
  }, [data.meta.months])

  const defaultMonth = months.includes(data.meta.detail_month)
    ? data.meta.detail_month
    : months.includes(currentMonthKey())
      ? currentMonthKey()
      : (months[months.length - 1] ?? currentMonthKey())

  const [month, setMonth] = useState(defaultMonth)
  const [owner, setOwner] = useState("all")
  const [product, setProduct] = useState("diesel")
  const [truckQuery, setTruckQuery] = useState("")
  const [detailRows, setDetailRows] = useState<FuelRow[]>(data.rows)
  const [detailMeta, setDetailMeta] = useState({
    total: data.meta.detail_row_count,
    truncated: data.meta.detail_truncated,
    loading: false,
    error: "",
  })

  useEffect(() => {
    if (month === data.meta.detail_month) {
      setDetailRows(data.rows)
      setDetailMeta({
        total: data.meta.detail_row_count,
        truncated: data.meta.detail_truncated,
        loading: false,
        error: "",
      })
      return
    }
    let cancelled = false
    setDetailMeta((prev) => ({ ...prev, loading: true, error: "" }))
    fetch(`/api/reporting/fuel-month?month=${encodeURIComponent(month)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          rows?: FuelRow[]
          meta?: { total_count?: number; truncated?: boolean }
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`)
        }
        if (cancelled) return
        setDetailRows(payload.rows ?? [])
        setDetailMeta({
          total: Number(payload.meta?.total_count ?? payload.rows?.length ?? 0),
          truncated: Boolean(payload.meta?.truncated),
          loading: false,
          error: "",
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDetailRows([])
        setDetailMeta({
          total: 0,
          truncated: false,
          loading: false,
          error: error instanceof Error ? error.message : "Error al cargar mes",
        })
      })
    return () => {
      cancelled = true
    }
  }, [month, data.meta.detail_month, data.meta.detail_row_count, data.meta.detail_truncated, data.rows])

  const monthItems = useMemo(
    () => months.map((value) => ({ value, label: monthLabel(value) })),
    [months]
  )
  const ownerItems = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...data.owners.map((value) => ({ value, label: value })),
    ],
    [data.owners]
  )
  const productItems = useMemo(
    () => [
      { value: "diesel", label: "Diésel (sin DEF)" },
      { value: "def", label: "DEF" },
      { value: "all", label: "Todos los productos" },
    ],
    []
  )

  const monthIndex = months.indexOf(month)
  const focusSeries = data.monthly.find((item) => item.month === month)

  const kpi = useMemo(() => {
    if (!focusSeries) {
      return {
        gallons: 0,
        adjustedSpend: 0,
        transactions: 0,
        distinctTrucks: 0,
        pricePerGallon: null as number | null,
      }
    }
    return kpiFromAgg(pickProductAgg(focusSeries, product, owner))
  }, [focusSeries, product, owner])

  const monthlyTrend = useMemo(() => {
    return data.monthly.map((item) => {
      const agg = pickProductAgg(item, product, owner)
      return {
        month: item.month,
        label: shortMonthLabel(item.month),
        gallons: agg.gallons,
        spend: agg.spend,
      }
    })
  }, [data.monthly, product, owner])

  const byOwner = useMemo(() => {
    if (!focusSeries) return []
    const bucketKey =
      product === "def" ? "def" : product === "all" ? "all" : "diesel"
    return Object.entries(focusSeries.byOwner)
      .map(([name, value]) => {
        const agg =
          bucketKey === "def"
            ? value.def
            : bucketKey === "all"
              ? value.all
              : value.diesel
        return {
          owner: name,
          gallons: agg.gallons,
          spend: agg.spend,
          transactions: agg.transactions,
          trucks: agg.trucks,
        }
      })
      .filter((row) => row.transactions > 0)
      .sort((a, b) => b.gallons - a.gallons || a.owner.localeCompare(b.owner))
  }, [focusSeries, product])

  const filteredDetail = useMemo(() => {
    const query = truckQuery.trim().toLowerCase()
    return detailRows.filter((row) => {
      if (owner !== "all" && row.owner !== owner) return false
      if (!matchesProduct(row, product)) return false
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
  }, [detailRows, owner, product, truckQuery])

  const productLabel =
    productItems.find((item) => item.value === product)?.label ?? product

  return (
    <DashboardShell
      title="Diesel"
      subtitle={`${monthLabel(month)} · ${productLabel} · ${kpi.transactions} tx · ${kpi.distinctTrucks} camiones`}
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
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <FieldLabel>Producto</FieldLabel>
              <Select
                items={productItems}
                value={product}
                onValueChange={(value) => {
                  if (typeof value === "string") setProduct(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {productItems.map((item) => (
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
          <CardTitle>Tendencia mensual</CardTitle>
          <CardDescription>
            Galones (barras) y gasto ajustado (línea) · respeta owner y producto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyTrend.every((point) => point.gallons === 0 && point.spend === 0) ? (
            <p className="text-muted-foreground text-sm">Sin datos en la ventana</p>
          ) : (
            <DieselMonthlyTrendChart data={monthlyTrend} />
          )}
        </CardContent>
      </Card>

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
            Detalle del mes de foco · muestra hasta 400 filas
            {detailMeta.loading ? " · cargando…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detailMeta.error ? (
            <p className="text-destructive mb-3 text-sm">{detailMeta.error}</p>
          ) : null}
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
                {filteredDetail.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      {detailMeta.loading ? "Cargando…" : "Sin filas"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDetail.map((row, index) => (
                    <TableRow key={`${row.id}-${row.storeDate}-${row.unit}-${index}`}>
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
            Mostrando {filteredDetail.length}
            {detailMeta.truncated || detailMeta.total > filteredDetail.length
              ? ` (mes tiene ${detailMeta.total} tx; tabla limitada)`
              : ""}{" "}
            · KPIs usan el total agregado del mes, no solo estas filas
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
              <strong>{owner}</strong>, producto=<strong>{product}</strong>,
              search=&quot;{truckQuery}&quot;.
            </p>
            <p>
              as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
              <strong>{data.meta.source_freshness}</strong>.
            </p>
            <p>
              Caveats: KPIs/gráfico/owner = agregados mensuales server-side.
              Tabla de detalle acotada a 400 filas por mes. Gasto = Adjusted
              SubTotal poblado. Default producto = diésel sin DEF. Ventana ≥12
              meses.
            </p>
          </div>
        </details>
      </footer>
    </DashboardShell>
  )
}
