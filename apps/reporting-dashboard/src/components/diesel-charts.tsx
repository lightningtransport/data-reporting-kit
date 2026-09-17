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
  gallons: { label: "Gallons", color: "var(--chart-1)" },
  spend: { label: "Adjusted spend", color: "var(--chart-3)" },
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
    <ChartContainer config={monthlyConfig} className="aspect-auto h-52 md:h-72">
      <ComposedChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="gallons"
          tickLine={false}
          axisLine={false}
          tickFormatter={gallonsTick}
          width={40}
        />
        <YAxis
          yAxisId="spend"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={moneyTick}
          width={44}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
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
