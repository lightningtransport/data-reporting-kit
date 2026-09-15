"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
}> = [
  { key: "g", label: "Gross facturado", money: true },
  { key: "c", label: "Facturado Compass", hint: "Incluido en Gross", money: true },
  { key: "e", label: "Gastos", money: true },
  { key: "n", label: "Net", money: true },
  { key: "lo", label: "Préstamos de camión", money: true },
  { key: "f", label: "Combustible", money: true },
  { key: "dp", label: "Pago a conductores", money: true },
  { key: "ltr", label: "Reparaciones", money: true },
  { key: "tp", label: "Peajes + PrePass", money: true },
  { key: "m", label: "Millas" },
]

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
        <CardTitle className="font-mono text-lg tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function ExecutiveSummary({
  scope,
  owners,
  total,
  physical,
  gallons,
  mpg,
}: {
  scope: string
  owners: OwnerExec[]
  total: OwnerExec
  physical: PhysicalExec
  gallons: number | null
  mpg: number | null
  products: string[]
}) {
  const columns = [total, ...owners]
  const avg = (value: number | null, format: (n: number) => string) =>
    value == null ? "—" : format(value)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl tracking-tight">Resumen</h2>
        <p className="text-muted-foreground text-sm">Totales de {scope}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Gross promedio" value={avg(physical.avgGross, money)} />
        <Kpi label="Gastos promedio" value={avg(physical.avgExp, money)} />
        <Kpi label="Pago promedio" value={avg(physical.avgPay, money)} />
        <Kpi
          label="Ingreso por milla"
          value={avg(physical.rpm, (value) => moneyExact(value))}
        />
        <Kpi label="Millas promedio" value={avg(physical.avgMiles, num)} />
        <Kpi label="Millas" value={num(physical.miles)} />
        {mpg != null ? <Kpi label="MPG" value={num(mpg)} /> : null}
        {gallons != null ? <Kpi label="Galones" value={num(gallons)} /> : null}
        <Kpi
          label={`Gross bajo ${money(LOW_GROSS_THRESHOLD)}`}
          value={String(physical.lowGross)}
        />
        <Kpi
          label="Net negativo"
          value={String(physical.netNeg)}
          hint={`${physical.netPos} con net positivo`}
        />
        <Kpi label="Camiones" value={String(physical.count)} />
        <Kpi label="Reparaciones" value={money(total.ltr)} />
        <Kpi label="Peajes + PrePass" value={money(total.tp)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por equipo</CardTitle>
          <CardDescription>Incluye asignaciones 1, 2 y 3 en su equipo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 min-w-40">
                    Métrica
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.o} className="min-w-32 text-right">
                      {column.o}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MATRIX.map((metric) => (
                  <TableRow key={metric.key}>
                    <TableCell className="bg-background sticky left-0 z-10">
                      <div className="font-medium">{metric.label}</div>
                      {metric.hint ? (
                        <div className="text-muted-foreground text-xs">{metric.hint}</div>
                      ) : null}
                    </TableCell>
                    {columns.map((column) => {
                      const value = column[metric.key]
                      const text = formatValue(column, metric)
                      return (
                        <TableCell key={`${column.o}-${metric.key}`} className="text-right">
                          {metric.key === "n" ? (
                            <MoneyTone value={value}>{text}</MoneyTone>
                          ) : (
                            <span className="font-mono tabular-nums">{text}</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
