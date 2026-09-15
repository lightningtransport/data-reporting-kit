"use client"

import { useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { ExecutiveSummary } from "@/components/executive-summary"
import { OwnerMultiSelect } from "@/components/owner-multi-select"
import {
  FuelOwnerChart,
  FuelPctChart,
  MonthlyTrendChart,
  WeeklyTrendChart,
} from "@/components/settlement-charts"
import { TruckRankCard } from "@/components/truck-rank-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { money, moneyExact, num, pct } from "@/lib/format"
import {
  aggregate,
  defaultMonth,
  dispatchesFromRows,
  executiveTotals,
  filterRows,
  gallonsForSelection,
  monthLabel,
  monthlyTotals,
  monthsFromWeeks,
  ownersFromRows,
  type SettlementPayload,
  type Vista,
  weekRangeLabel,
  weeklyTotals,
  weeksFromRows,
} from "@/lib/settlement"

const HINTS: Record<Vista, string> = {
  semanal:
    "Semanal: una semana de liquidación (mar–lun). Gross/gastos/net/combustible son del settlement.",
  mensual:
    "Mensual: suma de semanas cuyo period_from cae en el mes calendario.",
  diario:
    "Revisión diaria: los settlements son grano semanal, no día de calendario. Se muestra la última semana completa y puedes cambiar de semana con ‹ ›.",
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function SettlementDashboard({ data }: { data: SettlementPayload }) {
  const weeks = useMemo(() => weeksFromRows(data.rows), [data.rows])
  const months = useMemo(() => monthsFromWeeks(weeks), [weeks])
  const ownersAll = useMemo(() => ownersFromRows(data.rows), [data.rows])
  const dispatches = useMemo(() => dispatchesFromRows(data.rows), [data.rows])
  const weekItems = useMemo(
    () => weeks.map((week) => ({ value: week, label: weekRangeLabel(data.rows, week) })),
    [data.rows, weeks]
  )
  const monthItems = useMemo(
    () => months.map((month) => ({ value: month, label: monthLabel(month) })),
    [months]
  )

  const [vista, setVista] = useState<Vista>("semanal")
  const [week, setWeek] = useState(weeks[weeks.length - 1] ?? "")
  const [month, setMonth] = useState(defaultMonth(weeks, months))
  const [owners, setOwners] = useState(ownersAll)
  const [dispatch, setDispatch] = useState("")
  const [truckQuery, setTruckQuery] = useState("")
  const [physicalOnly, setPhysicalOnly] = useState(true)

  const selectedRows = useMemo(
    () =>
      filterRows(data.rows, {
        vista,
        week,
        month,
        owners,
        dispatch,
        truckQuery,
      }),
    [data.rows, vista, week, month, owners, dispatch, truckQuery]
  )
  const agg = useMemo(() => aggregate(selectedRows), [selectedRows])
  const exec = useMemo(() => executiveTotals(selectedRows), [selectedRows])
  const fuelSel = useMemo(
    () => gallonsForSelection(selectedRows, data.fuelByWeek ?? {}, owners, ownersAll),
    [selectedRows, data.fuelByWeek, owners, ownersAll]
  )
  const weekIndex = weeks.indexOf(week)
  const trucks = Object.values(agg.byTruck).filter((truck) =>
    physicalOnly ? !truck.np : true
  )
  const ownerAggs = Object.values(agg.byOwner)
  const grossTrucks = [...trucks].sort((a, b) => b.g - a.g)
  const netTrucks = [...trucks].sort((a, b) => b.n - a.n)
  const ownerGross = [...ownerAggs].sort((a, b) => b.g - a.g)
  const ownerNet = [...ownerAggs].sort((a, b) => b.n - a.n)
  const ownerFuel = [...ownerAggs].sort((a, b) => b.f - a.f)
  const execOwners = Object.values(exec.byOwner).sort((a, b) => a.o.localeCompare(b.o))
  const scope =
    vista === "mensual" ? `mes ${monthLabel(month)}` : `semana ${weekRangeLabel(data.rows, week)}`
  const fuelPct = agg.kpi.exp ? agg.kpi.fuel / agg.kpi.exp : 0
  const trendWeekly = weeklyTotals(data.rows, weeks, owners)
  const trendMonthly = monthlyTotals(data.rows, months, owners)
  const fuelChart = ownerFuel.map((owner) => ({ owner: owner.o, fuel: owner.f }))
  const fuelPctChart = ownerFuel.map((owner) => ({
    owner: owner.o,
    pct: owner.e ? Number(((100 * owner.f) / owner.e).toFixed(1)) : 0,
  }))
  const detailRows = [...selectedRows].sort(
    (a, b) => b.g - a.g || String(a.t).localeCompare(String(b.t))
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl tracking-tight">
            Lightning Transportation · Resumen de liquidaciones
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Ledger <span className="font-medium">settlements</span> — grano semanal
            (mar–lun). Ventana cargada ≥12 meses; el selector es el foco, no el
            único periodo analizado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {weeks[0]} → {weeks[weeks.length - 1]} ({weeks.length} semanas)
          </Badge>
          <Badge variant="outline">
            {data.meta.fetched_count}/{data.meta.total_count} filas · paginación{" "}
            {data.meta.pagination_complete ? "completa" : "incompleta"}
          </Badge>
          <Badge variant={data.meta.live ? "default" : "secondary"}>
            {data.meta.live ? "Live" : "Snapshot"}
          </Badge>
          <Badge variant="secondary">Camiones 1/2/3 = buckets de owner</Badge>
          <Badge variant="secondary">Equipo = owner histórico</Badge>
        </div>
      </header>

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field className="w-auto">
                <FieldLabel>Vista</FieldLabel>
                <Tabs
                  value={vista}
                  onValueChange={(value) => {
                    const next = value as Vista
                    setVista(next)
                    if (next === "diario") setWeek(weeks[weeks.length - 1] ?? week)
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="semanal">Semanal</TabsTrigger>
                    <TabsTrigger value="mensual">Mensual</TabsTrigger>
                    <TabsTrigger value="diario">Diario (rev.)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>

              {vista !== "mensual" ? (
                <Field className="w-auto">
                  <FieldLabel>Semana (period_from)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={weekIndex <= 0}
                      onClick={() => setWeek(weeks[weekIndex - 1] ?? week)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Select
                      items={weekItems}
                      value={week}
                      onValueChange={(value) => {
                        if (typeof value === "string") setWeek(value)
                      }}
                    >
                      <SelectTrigger className="min-w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {weekItems.map((item) => (
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
                      disabled={weekIndex >= weeks.length - 1}
                      onClick={() => setWeek(weeks[weekIndex + 1] ?? week)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                </Field>
              ) : (
                <Field className="w-auto">
                  <FieldLabel>Mes (por period_from)</FieldLabel>
                  <Select
                    items={monthItems}
                    value={month}
                    onValueChange={(value) => {
                      if (typeof value === "string") setMonth(value)
                    }}
                  >
                    <SelectTrigger className="min-w-40">
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
                </Field>
              )}

              <Field className="w-auto">
                <FieldLabel>Owner / equipo</FieldLabel>
                <OwnerMultiSelect
                  owners={ownersAll}
                  selected={owners}
                  onChange={setOwners}
                />
              </Field>

              <Field className="w-40">
                <FieldLabel>Buscar camión</FieldLabel>
                <Input
                  type="search"
                  value={truckQuery}
                  placeholder="ej. 923"
                  onChange={(event) => setTruckQuery(event.target.value)}
                />
              </Field>

              <Field orientation="horizontal" className="w-auto items-center">
                <Checkbox
                  id="physical-only"
                  checked={physicalOnly}
                  onCheckedChange={(checked) =>
                    setPhysicalOnly(checked === true)
                  }
                />
                <FieldLabel htmlFor="physical-only">
                  Solo físicos en rankings
                </FieldLabel>
              </Field>
            </div>

            <Field className="w-auto">
              <FieldLabel>Dispatch histórico</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={dispatch === "" ? "default" : "outline"}
                  onClick={() => setDispatch("")}
                >
                  Todos
                </Button>
                {dispatches.map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={dispatch === value ? "default" : "outline"}
                    onClick={() => setDispatch(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </Field>
            <p className="text-muted-foreground text-sm">{HINTS[vista]}</p>
          </FieldGroup>
        </CardContent>
      </Card>

      <ExecutiveSummary
        scope={scope}
        live={Boolean(data.meta.live)}
        owners={execOwners}
        total={exec.total}
        physical={exec.physical}
        gallons={fuelSel.gallons}
        mpg={fuelSel.mpg}
        products={fuelSel.products}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Gross" value={money(agg.kpi.gross)} hint="Almacenado" />
        <KpiCard
          label="Gastos totales"
          value={money(agg.kpi.exp)}
          hint="total_expenses"
        />
        <KpiCard label="Net" value={money(agg.kpi.net)} hint="Almacenado" />
        <KpiCard
          label="Combustible"
          value={money(agg.kpi.fuel)}
          hint={`${pct(fuelPct)} de gastos`}
        />
        <KpiCard
          label="Camiones físicos"
          value={String(agg.kpi.phys)}
          hint="excl. buckets 1/2/3"
        />
        <KpiCard
          label="Millas"
          value={num(agg.kpi.miles)}
          hint={`${agg.kpi.rows} filas`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia semanal · Gross / Net</CardTitle>
            <CardDescription>
              Totales de todas las semanas en el rango cargado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyTrendChart data={trendWeekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Totales mensuales · Gross / Net</CardTitle>
            <CardDescription>
              Suma de semanas cuyo period_from cae en el mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyTrendChart data={trendMonthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Combustible por owner</CardTitle>
            <CardDescription>
              Fuel Expenses almacenado · vista según selección
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FuelOwnerChart data={fuelChart} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Combustible % de gastos totales</CardTitle>
            <CardDescription>
              Fuel Expenses / Total Expenses por owner
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FuelPctChart data={fuelPctChart} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TruckRankCard
          title={`Camiones · Gross · ${scope}`}
          description="Top 15 en pantalla; Ver más abre la flota completa de la selección"
          trucks={grossTrucks}
          primary="g"
        />
        <TruckRankCard
          title={`Camiones · Net · ${scope}`}
          description="Misma selección, ordenada por Net"
          trucks={netTrucks}
          primary="n"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankTable
          title="Owners · Gross"
          description="Incluye buckets 1/2/3 en totales de owner"
          headers={["#", "Owner", "Gross", "Net"]}
          rows={ownerGross.map((owner, index) => [
            String(index + 1),
            owner.o,
            money(owner.g),
            money(owner.n),
          ])}
        />
        <RankTable
          title="Owners · Net"
          description="Incluye buckets 1/2/3 en totales de owner"
          headers={["#", "Owner", "Net", "Gross"]}
          rows={ownerNet.map((owner, index) => [
            String(index + 1),
            owner.o,
            money(owner.n),
            money(owner.g),
          ])}
        />
        <RankTable
          title="Combustible por owner"
          description="Ranking Fuel Expenses · % de gastos"
          headers={["#", "Owner", "Combustible", "% gast."]}
          rows={ownerFuel.map((owner, index) => [
            String(index + 1),
            owner.o,
            money(owner.f),
            pct(owner.e ? owner.f / owner.e : 0),
          ])}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de la selección</CardTitle>
          <CardDescription>
            {detailRows.length} filas · ordenadas por Gross desc
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "Camión",
                    "Owner",
                    "Dispatch",
                    "Desde",
                    "Hasta",
                    "Gross",
                    "Gastos",
                    "Combustible",
                    "Net",
                    "Millas",
                    "Pago cond.",
                  ].map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-muted-foreground">
                      Sin filas
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((row) => (
                    <TableRow key={`${row.sid}-${row.t}-${row.pf}`}>
                      <TableCell>
                        {row.t}{" "}
                        {row.t === "1" || row.t === "2" || row.t === "3" ? (
                          <Badge variant="outline">bucket owner</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.o}</TableCell>
                      <TableCell>{row.d || "—"}</TableCell>
                      <TableCell>{row.pf}</TableCell>
                      <TableCell>{row.pt}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.g)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.e)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.f)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.n)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {num(row.m)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {moneyExact(row.dp)}
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
          <CardTitle>Evidencia / provenance</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p>
            Filtros activos: vista=<strong>{vista}</strong>,{" "}
            {vista === "mensual" ? `mes=${month}` : `semana=${week}`}, dispatch=
            <strong>{dispatch || "todos"}</strong>, owners=
            {owners.length}/{ownersAll.length}, truck_search=&quot;{truckQuery}
            &quot;, physical_only_rankings=<strong>{String(physicalOnly)}</strong>.
          </p>
          <p>
            Dataset: <strong>{data.meta.dataset || "settlements"}</strong> ·
            total_count=<strong>{data.meta.total_count}</strong> · fetched=
            <strong>{data.meta.fetched_count}</strong> · pagination_complete=
            <strong>{String(data.meta.pagination_complete)}</strong> · live=
            <strong>{String(Boolean(data.meta.live))}</strong>.
          </p>
          <p>
            Fuel (galones): fetched=
            <strong>{data.meta.fuel_fetched_count ?? 0}</strong> /
            <strong>{data.meta.fuel_total_count ?? 0}</strong> · pagination_complete=
            <strong>{String(Boolean(data.meta.fuel_pagination_complete))}</strong>.
          </p>
          <p>
            as_of=<strong>{data.meta.as_of}</strong> · source_freshness=
            <strong>{data.meta.source_freshness}</strong>.
          </p>
          <p>
            Selección actual: <strong>{selectedRows.length}</strong> filas · Gross{" "}
            {moneyExact(agg.kpi.gross)} · Combustible {moneyExact(agg.kpi.fuel)}.
          </p>
          <Separator />
          <p>
            Caveats: grano semanal mar–lun (no diario). Camiones 1/2/3 son buckets
            de asignación a owner: incluidos en totales de owner, excluidos de
            conteos/rankings físicos. Facturado Compass es <code>tonu</code> y ya
            está en Gross. Peajes+PrePass = Tolls+PrePass (sin BestPass). Galones /
            MPG salen de <code>fuel</code>, no de Fuel Expenses. Full Week y Other
            Deductions+Previous no están en estas tablas. as_of es hora de request,
            no sync Ninox. El snapshot embebido es fallback si no hay
            AGENT_REPORTING_KEY; producción debe servir live paginado a 12 meses.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function RankTable({
  title,
  description,
  headers,
  rows,
}: {
  title: string
  description: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="text-muted-foreground">
                    Sin datos
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((cells, index) => (
                  <TableRow key={`${title}-${index}`}>
                    {cells.map((cell, cellIndex) => (
                      <TableCell
                        key={`${title}-${index}-${cellIndex}`}
                        className={cellIndex > 1 ? "text-right font-mono tabular-nums" : undefined}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
