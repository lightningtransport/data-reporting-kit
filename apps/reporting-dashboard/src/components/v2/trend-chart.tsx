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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { money, moneyTick } from "@/lib/format"
import type { ExecutiveGrain, ExecutiveLens, TrendPoint } from "@/lib/v2/metrics"
import { cn } from "cn"

const trendConfig = {
  chartGross: { label: "Gross", color: "var(--chart-1)" },
  chartNet: { label: "Net", color: "var(--chart-2)" },
} satisfies ChartConfig

const chartMargin = { left: 4, right: 4, top: 4, bottom: 4 }

export type ChartTrendPoint = TrendPoint & {
  partial: boolean
  /** Chart-safe numbers; null metrics become undefined so marks are omitted. */
  chartGross: number | undefined
  chartNet: number | undefined
}

function moneyTooltip(
  value: number | string | ReadonlyArray<number | string> | undefined,
  name: number | string | undefined,
  item: unknown
) {
  const n = typeof value === "number" ? value : Number(value)
  const payload =
    item && typeof item === "object" && "payload" in item
      ? (item as { payload?: ChartTrendPoint }).payload
      : undefined
  const key = String(name ?? "")
  const label = key === "chartGross" ? "Gross" : key === "chartNet" ? "Net" : key
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">
          {Number.isFinite(n) ? money(n) : "Not available"}
        </span>
      </div>
      {payload ? (
        <p className="text-muted-foreground text-[0.65rem]">
          {payload.period}
          {payload.partial ? " · Partial period" : ""}
          {payload.status !== "ok" && payload.reason
            ? ` · ${payload.reason}`
            : ""}
        </p>
      ) : null}
    </div>
  )
}

export function toChartTrendPoints(points: TrendPoint[], partialPeriods: Set<string>): ChartTrendPoint[] {
  return points.map((point) => ({
    ...point,
    partial: partialPeriods.has(point.period),
    chartGross:
      point.status === "ok" && point.gross != null ? point.gross : undefined,
    chartNet: point.status === "ok" && point.net != null ? point.net : undefined,
  }))
}

export function GrossNetTrendChart({
  data,
  grain,
  lens,
}: {
  data: ChartTrendPoint[]
  grain: ExecutiveGrain
  lens: ExecutiveLens
}) {
  const lensLabel =
    lens === "operating" ? "Operating Fleet" : "Accounting Total"
  const empty =
    data.length === 0 ||
    data.every((point) => point.chartGross == null && point.chartNet == null)

  if (empty) {
    return (
      <p className="text-muted-foreground text-sm">
        No Gross/Net trend points for the loaded ≥12-month window and filters.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Lens: {lensLabel}. Gross is solid; Net is dashed
        {grain === "week" ? " (weekly line)" : " (monthly bars)"}. Partial
        periods are marked in the table.
      </p>
      <ChartContainer config={trendConfig} className="aspect-auto h-52 md:h-72">
        {grain === "week" ? (
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              interval="preserveStartEnd"
              tickFormatter={(value: string) =>
                data.find((d) => d.label === value)?.partial
                  ? `${value}*`
                  : value
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={moneyTick}
              width={48}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={moneyTooltip} />}
            />
            <ChartLegend content={<ChartLegendContent className="gap-2 pt-2" />} />
            <Line
              type="linear"
              dataKey="chartGross"
              name="Gross"
              stroke="var(--color-chartGross)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="chartNet"
              name="Net"
              stroke="var(--color-chartNet)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: string) =>
                data.find((d) => d.label === value)?.partial
                  ? `${value}*`
                  : value
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={moneyTick}
              width={48}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={moneyTooltip} />}
            />
            <ChartLegend content={<ChartLegendContent className="gap-2 pt-2" />} />
            <Bar
              dataKey="chartGross"
              name="Gross"
              fill="var(--color-chartGross)"
              radius={4}
            />
            <Bar
              dataKey="chartNet"
              name="Net"
              fill="var(--color-chartNet)"
              radius={4}
              fillOpacity={0.45}
              stroke="var(--color-chartNet)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </BarChart>
        )}
      </ChartContainer>

      <div className="overflow-x-auto">
        <Table aria-label="Gross and Net trend table">
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((point) => (
              <TableRow
                key={point.period}
                className={cn(point.partial && "bg-muted/40")}
              >
                <TableCell className="font-mono text-xs tabular-nums">
                  {point.period}
                  {point.partial ? " *" : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {point.gross == null ? "Not available" : money(point.gross)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {point.net == null ? "Not available" : money(point.net)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {point.partial
                    ? "Partial"
                    : point.status === "ok"
                      ? "Complete"
                      : point.status}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        * Partial period — not directly comparable to a complete period.
      </p>
    </div>
  )
}
