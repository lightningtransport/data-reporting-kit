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
import { TruckFocusCard } from "@/components/truck-focus-card"
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
  focusPeriodLabel,
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

  const periodRows = useMemo(
    () =>
      filterRows(data.rows, {
        vista,
        week,
        month,
        owners,
        dispatch,
        truckQuery: "",
      }),
    [data.rows, vista, week, month, owners, dispatch]
  )
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
  const scope = focusPeriodLabel(vista, week, month, data.rows)
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
  const searchingTruck = truckQuery.trim().length > 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-2xl tracking-tight">Liquidaciones</h1>
        <p className="text-muted-foreground text-sm">{scope}</p>
        {data.meta.live ? null : (
          <Badge variant="secondary">Copia</Badge>
        )}
      </header>

      <Card>
        <CardContent className="pt-(--card-spacing)">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field className="w-full md:col-span-2 xl:col-span-1">
              <FieldLabel>Periodo</FieldLabel>
              <Tabs
                value={vista === "mensual" ? "mensual" : "semanal"}
                onValueChange={(value) => setVista(value as Vista)}
                className="w-full"
              >
                <TabsList className="h-9 w-full">
                  <TabsTrigger className="flex-1" value="semanal">
                    Semana
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="mensual">
                    Mes
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>

            {vista !== "mensual" ? (
              <Field className="w-full md:col-span-2 xl:col-span-1">
                <FieldLabel>Semana</FieldLabel>
                <div className="flex w-full items-center gap-2">
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
                    <SelectTrigger className="min-w-0 flex-1">
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
              <Field className="w-full">
                <FieldLabel>Mes</FieldLabel>
                <Select
                  items={monthItems}
                  value={month}
                  onValueChange={(value) => {
                    if (typeof value === "string") setMonth(value)
                  }}
                >
                  <SelectTrigger className="w-full">
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
                <p className="text-muted-foreground text-xs">Suma de las semanas de ese mes.</p>
              </Field>
            )}

            <Field className="w-full">
              <FieldLabel>Equipo</FieldLabel>
              <OwnerMultiSelect
                owners={ownersAll}
                selected={owners}
                onChange={setOwners}
              />
            </Field>

            <Field className="w-full">
              <FieldLabel>Camión</FieldLabel>
              <Input
                type="search"
                value={truckQuery}
                placeholder="903"
                onChange={(event) => setTruckQuery(event.target.value)}
              />
            </Field>

            {dispatches.length > 0 ? (
              <Field className="w-full md:col-span-2 xl:col-span-4">
                <FieldLabel>Despacho</FieldLabel>
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
            ) : null}

            <Field
              orientation="horizontal"
              className="w-full items-center md:col-span-2 xl:col-span-4"
            >
              <Checkbox
                id="physical-only"
                checked={physicalOnly}
                onCheckedChange={(checked) => setPhysicalOnly(checked === true)}
              />
              <FieldLabel htmlFor="physical-only">
                Ocultar asignaciones 1/2/3
              </FieldLabel>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {searchingTruck ? (
        <TruckFocusCard query={truckQuery} rows={selectedRows} />
      ) : null}

      <ExecutiveSummary
        scope={scope}
        owners={execOwners}
        total={exec.total}
        physical={exec.physical}
        gallons={fuelSel.gallons}
        mpg={fuelSel.mpg}
        products={fuelSel.products}
        isCopy={!data.meta.live}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Gross" value={money(agg.kpi.gross)} />
        <KpiCard label="Gastos" value={money(agg.kpi.exp)} />
        <KpiCard label="Net" value={money(agg.kpi.net)} />
        <KpiCard
          label="Combustible"
          value={`${money(agg.kpi.fuel)}${fuelPct ? ` · ${pct(fuelPct)}` : ""}`}
        />
        <KpiCard label="Camiones" value={String(agg.kpi.phys)} />
        <KpiCard label="Millas" value={num(agg.kpi.miles)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gross y net por semana</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyTrendChart data={trendWeekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gross y net por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrendChart data={trendMonthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Combustible por equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelOwnerChart data={fuelChart} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Combustible vs gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelPctChart data={fuelPctChart} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TruckRankCard
          title={`Camiones · Gross · ${scope}`}
          description="Los primeros 15. Ver más muestra todos."
          trucks={grossTrucks}
          primary="g"
        />
        <TruckRankCard
          title={`Camiones · Net · ${scope}`}
          description="Los primeros 15. Ver más muestra todos."
          trucks={netTrucks}
          primary="n"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankTable
          title="Equipos · Gross"
          description="Incluye asignaciones 1/2/3"
          headers={["#", "Equipo", "Gross", "Net"]}
          rows={ownerGross.map((owner, index) => [
            String(index + 1),
            owner.o,
            money(owner.g),
            money(owner.n),
          ])}
        />
        <RankTable
          title="Equipos · Net"
          description="Incluye asignaciones 1/2/3"
          headers={["#", "Equipo", "Net", "Gross"]}
          rows={ownerNet.map((owner, index) => [
            String(index + 1),
            owner.o,
            money(owner.n),
            money(owner.g),
          ])}
        />
        <RankTable
          title="Combustible por equipo"
          headers={["#", "Equipo", "Combustible", "% gastos"]}
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
          <CardTitle>Detalle</CardTitle>
          <CardDescription>
            {detailRows.length} {detailRows.length === 1 ? "fila" : "filas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "Camión",
                    "Equipo",
                    "Despacho",
                    "Desde",
                    "Hasta",
                    "Gross",
                    "Gastos",
                    "Combustible",
                    "Net",
                    "Millas",
                    "Pago",
                  ].map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-muted-foreground">
                      Sin datos en este periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((row) => (
                    <TableRow key={`${row.sid}-${row.t}-${row.pf}`}>
                      <TableCell>
                        {row.t}{" "}
                        {row.t === "1" || row.t === "2" || row.t === "3" ? (
                          <Badge variant="outline">No físico</Badge>
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

      <footer className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>Números de liquidación semanal (mar–lun).</p>
        <details>
          <summary className="cursor-pointer text-foreground">Datos técnicos</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              Filtros: vista=<strong>{vista}</strong>,{" "}
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
              Selección: <strong>{selectedRows.length}</strong> filas · periodo rows=
              <strong>{periodRows.length}</strong> · Gross {moneyExact(agg.kpi.gross)} ·
              Combustible {moneyExact(agg.kpi.fuel)}.
            </p>
            <p>
              Caveats: grano semanal mar–lun. Camiones 1/2/3 son buckets de owner:
              incluidos en totales de equipo, excluidos de conteos físicos.
              Facturado Compass es tonu y ya está en Gross. Peajes+PrePass =
              Tolls+PrePass (sin BestPass). Galones/MPG salen de fuel, no de Fuel
              Expenses. Full Week y Other Deductions+Previous no están en estas
              tablas. as_of es hora de request, no sync Ninox. Fallback embebido si
              no hay AGENT_REPORTING_KEY.
            </p>
          </div>
        </details>
      </footer>
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
  description?: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
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
