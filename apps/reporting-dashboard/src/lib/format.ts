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
