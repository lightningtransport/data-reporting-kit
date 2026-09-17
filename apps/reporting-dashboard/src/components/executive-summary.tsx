"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KpiValue } from "@/components/kpi-value"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { money, moneyExact, num } from "@/lib/format"
import {
  LOW_GROSS_THRESHOLD,
  type OwnerExec,
  type PhysicalExec,
} from "@/lib/settlement"
import { cn } from "cn"

const MATRIX: Array<{
  key: keyof Omit<OwnerExec, "o">
  label: string
  hint?: string
  money?: boolean
  copyOnlyIfPresent?: boolean
}> = [
  { key: "g", label: "Gross billed", money: true },
  {
    key: "c",
    label: "Compass billed",
    hint: "Already in Gross",
    money: true,
    copyOnlyIfPresent: true,
  },
  { key: "e", label: "Expenses", money: true },
  { key: "n", label: "Net", money: true },
  { key: "lo", label: "Truck loans", money: true, copyOnlyIfPresent: true },
  { key: "f", label: "Fuel", money: true },
  { key: "dp", label: "Driver pay", money: true },
  { key: "ltr", label: "Repairs", money: true, copyOnlyIfPresent: true },
  { key: "tp", label: "Tolls + PrePass", money: true, copyOnlyIfPresent: true },
  { key: "m", label: "Miles" },
]

const COPY_GAP_HINT = "Not in this snapshot"

function formatValue(
  row: OwnerExec,
  metric: (typeof MATRIX)[number]
): string {
  const value = row[metric.key]
  return metric.money ? moneyExact(value) : num(value)
}

function MoneyTone({
  value,
  children,
}: {
  value: number
  children: string
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        value < 0 && "text-destructive",
        value > 0 && "text-foreground"
      )}
    >
      {children}
    </span>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <KpiValue className="text-lg">{value}</KpiValue>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function metricMissingFromCopy(
  isCopy: boolean,
  metric: (typeof MATRIX)[number],
  columns: OwnerExec[]
): boolean {
  if (!isCopy || !metric.copyOnlyIfPresent) return false
  return columns.every((column) => column[metric.key] === 0)
}

export function ExecutiveSummary({
  scope,
  owners,
  total,
  physical,
  gallons,
  mpg,
  isCopy = false,
}: {
  scope: string
  owners: OwnerExec[]
  total: OwnerExec
  physical: PhysicalExec
  gallons: number | null
  mpg: number | null
  products: string[]
  isCopy?: boolean
}) {
  const columns = [total, ...owners]
  const avg = (value: number | null, format: (n: number) => string) =>
    value == null ? "—" : format(value)
  const copyGaps = MATRIX.filter((metric) =>
    metricMissingFromCopy(isCopy, metric, columns)
  )
  const showRepairKpi = !metricMissingFromCopy(
    isCopy,
    MATRIX.find((metric) => metric.key === "ltr")!,
    columns
  )
  const showTollKpi = !metricMissingFromCopy(
    isCopy,
    MATRIX.find((metric) => metric.key === "tp")!,
    columns
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-bold tracking-tight">Summary</h2>
        <p className="text-muted-foreground text-sm">Totals for {scope}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Avg Gross" value={avg(physical.avgGross, money)} />
        <Kpi label="Avg expenses" value={avg(physical.avgExp, money)} />
        <Kpi label="Avg driver pay" value={avg(physical.avgPay, money)} />
        <Kpi
          label="Revenue per mile"
          value={avg(physical.rpm, (value) => moneyExact(value))}
        />
        <Kpi label="Avg miles" value={avg(physical.avgMiles, num)} />
        <Kpi label="Miles" value={num(physical.miles)} />
        {mpg != null ? <Kpi label="MPG" value={num(mpg)} /> : null}
        {gallons != null ? <Kpi label="Gallons" value={num(gallons)} /> : null}
        <Kpi
          label={`Gross under ${money(LOW_GROSS_THRESHOLD)}`}
          value={String(physical.lowGross)}
        />
        <Kpi
          label="Negative Net"
          value={String(physical.netNeg)}
          hint={`${physical.netPos} with positive Net`}
        />
        <Kpi label="Trucks" value={String(physical.count)} />
        {showRepairKpi ? (
          <Kpi label="Repairs" value={money(total.ltr)} />
        ) : null}
        {showTollKpi ? (
          <Kpi label="Tolls + PrePass" value={money(total.tp)} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By team</CardTitle>
          <CardDescription>
            Includes allocation buckets 1, 2, and 3 in their team. Scroll the
            table to see every team.
            {copyGaps.length > 0
              ? " Compass, loans, repairs, and tolls are not in this snapshot; blank does not mean $0."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-20 min-w-44 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">
                    Metric
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.o}
                      className="min-w-36 whitespace-nowrap text-right"
                    >
                      {column.o}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MATRIX.map((metric) => {
                  const missing = metricMissingFromCopy(isCopy, metric, columns)
                  return (
                    <TableRow key={metric.key}>
                      <TableCell className="bg-background sticky left-0 z-20 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">
                        <div className="font-medium">{metric.label}</div>
                        {missing || metric.hint ? (
                          <div className="text-muted-foreground text-xs">
                            {missing ? COPY_GAP_HINT : metric.hint}
                          </div>
                        ) : null}
                      </TableCell>
                      {columns.map((column) => {
                        const value = column[metric.key]
                        const text = missing ? "—" : formatValue(column, metric)
                        return (
                          <TableCell
                            key={`${column.o}-${metric.key}`}
                            className="min-w-36 text-right whitespace-nowrap"
                          >
                            {metric.key === "n" && !missing ? (
                              <MoneyTone value={value}>{text}</MoneyTone>
                            ) : (
                              <span className="font-mono tabular-nums">{text}</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
