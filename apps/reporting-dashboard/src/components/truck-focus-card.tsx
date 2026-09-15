"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { moneyExact, num } from "@/lib/format"
import {
  NON_PHYSICAL,
  aggregate,
  humanWeekRange,
  type SettlementRow,
} from "@/lib/settlement"

export function TruckFocusCard({
  query,
  rows,
}: {
  query: string
  rows: SettlementRow[]
}) {
  const needle = query.trim()
  if (!needle) return null

  const trucks = Object.values(aggregate(rows).byTruck).sort((a, b) =>
    a.t.localeCompare(b.t, undefined, { numeric: true })
  )
  const shown = trucks.slice(0, 8)

  if (trucks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Camión {needle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No hay liquidación de este camión en este periodo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {shown.map((truck) => {
        const weeks = rows
          .filter((row) => String(row.t) === truck.t)
          .sort((a, b) => a.pf.localeCompare(b.pf))
        return (
          <Card key={truck.t}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>Camión {truck.t}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{truck.o}</Badge>
                {truck.np || NON_PHYSICAL.has(truck.t) ? (
                  <Badge variant="outline">No físico</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Gross" value={moneyExact(truck.g)} />
                <Stat label="Gastos" value={moneyExact(truck.e)} />
                <Stat label="Net" value={moneyExact(truck.n)} />
                <Stat label="Combustible" value={moneyExact(truck.f)} />
                <Stat label="Millas" value={num(truck.m)} />
                <Stat label="Pago" value={moneyExact(truck.dp)} />
              </dl>
              <ul className="text-muted-foreground text-sm">
                {weeks.map((row) => (
                  <li key={`${row.sid}-${row.pf}`}>
                    {humanWeekRange(row.pf, row.pt)} · Gross {moneyExact(row.g)} ·
                    Net {moneyExact(row.n)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
      {trucks.length > shown.length ? (
        <p className="text-muted-foreground text-sm">
          {trucks.length - shown.length} camiones más coinciden. Afina el número.
        </p>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  )
}
