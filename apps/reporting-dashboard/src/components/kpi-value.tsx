import { cn } from "cn"

/** KPI / metric figure — mono, never used as a card title. */
export function KpiValue({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="kpi-value"
      className={cn(
        "font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Uppercase meta / day-strip / shell eyebrow. */
export function Eyebrow({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="eyebrow"
      className={cn(
        "text-muted-foreground text-xs font-semibold tracking-wide uppercase",
        className
      )}
      {...props}
    />
  )
}
