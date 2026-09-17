"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { gallonsTick, moneyExact, moneyTick, num } from "@/lib/format"

const monthlyConfig = {
  gallons: { label: "Gallons", color: "var(--chart-1)" },
  spend: { label: "Adjusted spend", color: "var(--chart-3)" },
} satisfies ChartConfig

export type DieselMonthlyPoint = {
  month: string
  label: string
  gallons: number
  spend: number
}

function dieselTooltip(
  value: number | string | ReadonlyArray<number | string> | undefined,
  name: number | string | undefined,
  item: { dataKey?: string | number | ((obj: unknown) => unknown) }
) {
  const n = typeof value === "number" ? value : Number(value)
  const rawKey = item.dataKey
  const key =
    typeof rawKey === "string" || typeof rawKey === "number"
      ? String(rawKey)
      : String(name ?? "")
  const label =
    key === "spend" ? "Adjusted spend" : key === "gallons" ? "Gallons" : String(name)
  const formatted =
    !Number.isFinite(n)
      ? "—"
      : key === "spend"
        ? moneyExact(n)
        : `${num(n)} gal`
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{formatted}</span>
    </div>
  )
}

export function DieselMonthlyTrendChart({
  data,
}: {
  data: DieselMonthlyPoint[]
}) {
  return (
    <ChartContainer config={monthlyConfig} className="aspect-auto h-52 md:h-72">
      <ComposedChart data={data} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="gallons"
          tickLine={false}
          axisLine={false}
          tickFormatter={gallonsTick}
          width={52}
        >
          <Label
            value="Gallons"
            angle={-90}
            position="insideLeft"
            style={{ textAnchor: "middle", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </YAxis>
        <YAxis
          yAxisId="spend"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={moneyTick}
          width={52}
        >
          <Label
            value="USD"
            angle={90}
            position="insideRight"
            style={{ textAnchor: "middle", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </YAxis>
        <ChartTooltip
          content={<ChartTooltipContent formatter={dieselTooltip} />}
        />
        <ChartLegend content={<ChartLegendContent className="gap-2 pt-2" />} />
        <Bar
          yAxisId="gallons"
          dataKey="gallons"
          fill="var(--color-gallons)"
          radius={4}
        />
        <Line
          yAxisId="spend"
          type="monotone"
          dataKey="spend"
          stroke="var(--color-spend)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
