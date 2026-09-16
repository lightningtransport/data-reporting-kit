"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
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

const moneyTick = (value: number) =>
  Math.abs(value) >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : Math.abs(value) >= 1000
      ? `$${(value / 1000).toFixed(0)}k`
      : `$${value.toFixed(0)}`

const gallonsTick = (value: number) =>
  Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(Math.round(value))

const monthlyConfig = {
  gallons: { label: "Galones", color: "var(--chart-1)" },
  spend: { label: "Gasto ajustado", color: "var(--chart-3)" },
} satisfies ChartConfig

export type DieselMonthlyPoint = {
  month: string
  label: string
  gallons: number
  spend: number
}

export function DieselMonthlyTrendChart({
  data,
}: {
  data: DieselMonthlyPoint[]
}) {
  return (
    <ChartContainer config={monthlyConfig} className="aspect-auto h-72">
      <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="gallons"
          tickLine={false}
          axisLine={false}
          tickFormatter={gallonsTick}
        />
        <YAxis
          yAxisId="spend"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={moneyTick}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
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
