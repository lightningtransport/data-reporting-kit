"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
    : `$${(value / 1000).toFixed(0)}k`

const trendConfig = {
  gross: { label: "Gross", color: "var(--chart-1)" },
  net: { label: "Net", color: "var(--chart-2)" },
} satisfies ChartConfig

const fuelConfig = {
  fuel: { label: "Combustible", color: "var(--chart-3)" },
  pct: { label: "% combustible / gastos", color: "var(--chart-4)" },
} satisfies ChartConfig

export function WeeklyTrendChart({
  data,
}: {
  data: Array<{ label: string; gross: number; net: number }>
}) {
  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-72">
      <LineChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={moneyTick} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="gross"
          stroke="var(--color-gross)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="var(--color-net)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function MonthlyTrendChart({
  data,
}: {
  data: Array<{ label: string; gross: number; net: number }>
}) {
  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-72">
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={moneyTick} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="gross" fill="var(--color-gross)" radius={4} />
        <Bar dataKey="net" fill="var(--color-net)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

export function FuelOwnerChart({
  data,
}: {
  data: Array<{ owner: string; fuel: number }>
}) {
  return (
    <ChartContainer config={fuelConfig} className="aspect-auto h-60">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={moneyTick} />
        <YAxis
          type="category"
          dataKey="owner"
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="fuel" fill="var(--color-fuel)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

export function FuelPctChart({
  data,
}: {
  data: Array<{ owner: string; pct: number }>
}) {
  return (
    <ChartContainer config={fuelConfig} className="aspect-auto h-60">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} domain={[0, 80]} />
        <YAxis
          type="category"
          dataKey="owner"
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="pct" fill="var(--color-pct)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
