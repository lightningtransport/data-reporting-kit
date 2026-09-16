# HTML reporting conventions

Read `AGENTS.md` first. These rules are for **Grok Bot and Cursor agents** that auto-configure from this kit.

*Evidence: settlement dashboard C-level executive section and 12-month `settlements` load published 2026-09-15; Out Schedule + Trucks Return views added 2026-09-16; analytical HTML answers still use ≥3 months unless they are this dashboard.*

## Reporting dashboard (source of truth)

The live reporting screens live in [`apps/reporting-dashboard`](../apps/reporting-dashboard): Next.js App Router + **real shadcn/ui** (Button, Tabs, Card, Badge, Input, Table, Checkbox, Select, Popover + Command multi-select, DropdownMenu). Do not rebuild them as a native `<select multiple>` or a hand-rolled CSS imitation.

- **Live URL:** https://lightning-settlement-dashboard.vercel.app
- **Deep links:** `/` Liquidaciones · `/out-schedule` Out Schedule · `/trucks-return` Trucks Return
- **Grok bots:** when answering questions about these screens, **link the matching live URL**. Keep the app in sync from this repository. Do not generate a one-off HTML replacement.
- Deploy: set Vercel Root Directory to `apps/reporting-dashboard`. See [`apps/reporting-dashboard/README.md`](../apps/reporting-dashboard/README.md). Live settlement/returns data uses server-only `AGENT_REPORTING_KEY` (never `NEXT_PUBLIC_*`, never git). Out Schedule fetches the documented live Ninox Schedule_Teams share server-side (`revalidate` ≈ 120s). Settlements HTML/JSON reuse the live payload for up to five minutes (`revalidate = 300`). The embedded settlements JSON is fallback only and may be shorter than 12 months; production must not stay on the snapshot when the key is configured.

## Portable skills (other static reports)

- [`skills/agent-reporting-html/SKILL.md`](../skills/agent-reporting-html/SKILL.md) — auto-configure, ≥3-month fetch window, query and confirmation process.
- [`skills/reporting-html-shadcn/SKILL.md`](../skills/reporting-html-shadcn/SKILL.md) — static HTML fallback kit. Prefer the Next app for the settlement dashboard.
- Shared stylesheet for non-dashboard static files: [`skills/reporting-html-shadcn/assets/report-ui.css`](../skills/reporting-html-shadcn/assets/report-ui.css).

## History window

For HTML reports and analytical settlement/fleet-history answers that are **not** the live dashboard, always load **at least three calendar months** ending today or at the user-named end date.

The **settlement dashboard** loads **at least twelve calendar months** of `settlements` (paginated). The named week or day is the UI **focus**, not the sole query window.

- Settlements: `period_from` = Tuesday on or before `history_start`; `period_to` inclusive on `From`.
- Fuel gallons/MPG on the dashboard: `store_from` / `store_to` covering the loaded window; bucket transactions onto settlement weeks by `Store Date` between `From` and `To`. Attribute `fuel.owner` historically. Do not replace stored `Fuel Expenses` with fuel subtotals.
- Follow `next_offset` until `has_more=false`. Never present a truncated page as a complete ranking or KPI. Truck Gross/Net lists may preview a top-N in the card; **Ver más** must list every selected physical truck.

A one-week headline question that is not an HTML report and not a trend/ranking analysis still uses an explicit Tuesday–Monday period.

## Required HTML sections

Shared shell for every dashboard view: Lightning logo, view title, **Copia** badge when data is not live, and a top-right **Vistas** DropdownMenu linking Liquidaciones / Out Schedule / Trucks Return.

### Liquidaciones (`/`)

1. Slim header: title **Liquidaciones**, focused period, and a **Copia** badge only when data is not live.
2. Mobile-first filters (Periodo Semana/Mes, Equipo, Camión, Despacho). Truck search renders a **Camión** focus card immediately under the filters (Gross, gastos, net, combustible, millas, equipo, weeks in the selection).
3. **Resumen**: owner matrix (TOTAL + exact stored `Owner` columns), physical-truck averages, Gross below $11,000 count, net+/net−, LTR Invoices, Tolls+PrePass, optional gallons/MPG from `fuel`. Visible labels are Spanish operational copy, not API field names.
4. Weekly and monthly review modes, with the named date selected in the toolbar. Historical `Dispatch` filter uses exact `settlements.Dispatch` values (not current `trucks.dispatcher`).
5. Truck rankings and owner rankings by stored Gross and Net. Truck lists: preview plus **Ver más** for the full selection. Non-physical buckets use badge **No físico**.
6. Fuel spend by owner for the focused week and month, using stored `Fuel Expenses` (settlement) and `fuel.owner` only for gallon attribution.
7. KPI strip: Gross, Gastos, Net, Combustible, physical-truck count, millas.
8. Evidence stays in a closed **Datos técnicos** accordion (source report(s), normalized filters, exact period/window, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, material caveats). Humans see one line: weekly Tue–Mon settlement numbers.
9. Real shadcn/ui components. Owner/equipo is a Popover + Command multi-select, never a native multi `<select>`.

Not established (do not display or approximate): Ninox “Full Week” / “No Full Week”, and “Other Deductions+Previous”. There is no matching `public.settlements` column.

### Out Schedule (`/out-schedule`)

1. Table of live Schedule_Teams rows from the documented share: Truck, Out Date, Day (derived), Team, Owner, Dispatch, Flatbed, Solo.
2. Light filters (truck/team search, owner, dispatch), Export CSV, row count, **Datos técnicos**.
3. Do not substitute DriverPay history when the Ninox share fails; show an explicit error state. Insurance / Team Status / Truck Status / Notes are not in this share.

### Trucks Return (`/trucks-return`)

1. Table of current `returns` rows: Truck, Insurance, Driver Name, Return Date (never Phone/CDL).
2. Light filters, distinct-truck count, **Datos técnicos**.
3. Driver-row grain: teams usually produce two rows per truck.

## Business-rule reminders that affect HTML

- Stored `Gross`, `Total Expenses`, and `Net` are authoritative headlines; do not recompute them from components. `tonu` is Facturado Compass and is already inside Gross.
- Ave. RPM on the dashboard = physical Gross ÷ physical miles when miles > 0. Ave. MPG = physical miles ÷ `fuel.Gallons` when gallons > 0. These are derived, not stored.
- The $11,000 Gross count is a C-level physical-truck threshold on stored Gross.
- Settlement trucks 1, 2, and 3 are non-physical owner-allocation buckets. Include them in matching owner totals; exclude them from physical-truck counts and rankings; badge them as non-physical.
- Historical owner/dispatch and `fuel.owner` come from the historical row, not current `trucks`.
- Planned Schedule_Teams UI is the dashboard `/out-schedule` view (live Ninox share). Exact in-yard/on-road metrics remain unavailable from Supabase tables.
- `as_of` is request time. Source tables do not expose a Ninox sync timestamp; “up to date” means the latest imported rows, not proof that Ninox has closed the week.

## Local output convention

Operational HTML candidates still belong in an agent's working workspace when a static file is explicitly requested. The reporting dashboard itself is `apps/reporting-dashboard` and is deployed from this kit. This public kit still must not store secrets.
