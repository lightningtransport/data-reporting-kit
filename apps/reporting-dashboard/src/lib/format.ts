const money0 = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const money2 = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const num1 = new Intl.NumberFormat("es-US", { maximumFractionDigits: 1 })

export function money(value: number): string {
  return money0.format(value || 0)
}

export function moneyExact(value: number): string {
  return money2.format(value || 0)
}

export function num(value: number): string {
  return num1.format(value || 0)
}

export function pct(value: number): string {
  return `${((value || 0) * 100).toLocaleString("es-US", { maximumFractionDigits: 1 })}%`
}

/** Axis/tick helpers for charts (compact). */
export function moneyTick(value: number): string {
  const abs = Math.abs(value || 0)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${Math.round(value || 0)}`
}

export function gallonsTick(value: number): string {
  const abs = Math.abs(value || 0)
  if (abs >= 1000) return `${(value / 1000).toFixed(0)}k`
  return String(Math.round(value || 0))
}

/** Format a percentage already stored as 0–100 points (not a 0–1 fraction). */
export function pctPoints(value: number): string {
  return `${(value || 0).toLocaleString("es-US", { maximumFractionDigits: 1 })}%`
}
