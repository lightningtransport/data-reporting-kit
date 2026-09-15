"use client"

import { Badge } from "@/components/ui/badge"
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
  { key: "c", label: "Facturado Compass", hint: "ya incluido en Gross", money: true },
  { key: "e", label: "Total gastos", money: true },
  { key: "n", label: "Net de la semana", money: true },
  { key: "lo", label: "Truck loans", money: true },
  { key: "f", label: "Combustible", money: true },
  { key: "dp", label: "Pago conductores", money: true },
  { key: "ltr", label: "Reparaciones (LTR)", money: true },
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
  hint: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-lg tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function ExecutiveSummary({
  scope,
  live,
  owners,
  total,
  physical,
  gallons,
  mpg,
  products,
}: {
  scope: string
  live: boolean
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-xl tracking-tight">Resumen ejecutivo</h2>
          <Badge variant={live ? "default" : "secondary"}>
            {live ? "Live agent-reporting" : "Snapshot embebido"}
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Totales de {scope} para C-level. Gross, gastos, net, loans, combustible y
          pago son valores almacenados de <span className="font-medium">settlements</span>.
          Compass no se suma otra vez a Gross. Dispatch y owner vienen de la fila
          histórica, no de trucks actual.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi
          label="Ave. Gross (físicos)"
          value={avg(physical.avgGross, money)}
          hint="Promedio de camiones físicos"
        />
        <Kpi
          label="Ave. gastos (físicos)"
          value={avg(physical.avgExp, money)}
          hint="Total Expenses almacenado"
        />
        <Kpi
          label="Ave. pago (físicos)"
          value={avg(physical.avgPay, money)}
          hint="Total Driver Pay"
        />
        <Kpi
          label="Ave. RPM"
          value={avg(physical.rpm, (value) => moneyExact(value))}
          hint="Gross físico ÷ millas físicas"
        />
        <Kpi
          label="Ave. millas (físicos)"
          value={avg(physical.avgMiles, num)}
          hint="Driven_miles"
        />
        <Kpi
          label="Millas totales"
          value={num(physical.miles)}
          hint="Suma física"
        />
        {mpg != null ? (
          <Kpi
            label="Ave. MPG"
            value={num(mpg)}
            hint="Millas físicas ÷ galones fuel"
          />
        ) : null}
        {gallons != null ? (
          <Kpi
            label="Galones"
            value={num(gallons)}
            hint={
              products.length
                ? `fuel.Gallons · productos: ${products.join(", ")}`
                : "fuel.Gallons de la ventana foco"
            }
          />
        ) : null}
        <Kpi
          label={`Gross < ${money(LOW_GROSS_THRESHOLD)}`}
          value={String(physical.lowGross)}
          hint="Camiones físicos"
        />
        <Kpi
          label="Net negativo"
          value={String(physical.netNeg)}
          hint={`${physical.netPos} positivos · ${physical.netZero} en cero`}
        />
        <Kpi
          label="Camiones físicos"
          value={String(physical.count)}
          hint="Excluye buckets 1/2/3"
        />
        <Kpi
          label="Reparaciones LTR"
          value={money(total.ltr)}
          hint="LTR Invoices"
        />
        <Kpi
          label="Peajes + PrePass"
          value={money(total.tp)}
          hint="Tolls + PrePass; no incluye BestPass"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totales por owner</CardTitle>
          <CardDescription>
            TOTAL incluye buckets 1/2/3 en el owner que les corresponde. No se
            muestra Full Week ni Other Deductions+Previous: no existen en
            public.settlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-background sticky left-0 z-10 min-w-44">
                    Métrica
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.o}
                      className="min-w-36 text-right"
                    >
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
