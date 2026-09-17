/** Shared date display for Out Schedule / Trucks Return ops tables. */

export function formatOpsDate(iso: string, emptyLabel = "—"): string {
  if (!iso) return emptyLabel
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [, month, day] = iso.split("-")
  return `${month}/${day}/${iso.slice(0, 4)}`
}

export function weekdayFromIso(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date)
}
