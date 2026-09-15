# HTML reporting conventions

Read `AGENTS.md` first. These rules are for **Grok Bot and Cursor agents** that auto-configure from this kit.

*Evidence: settlement dashboard published as a Next.js + shadcn/ui app on 2026-09-15; ≥3-month window and confirmed report sections preserved from the confirmed settlement-summary v2 behavior.*

## Settlement dashboard (source of truth)

The live settlement screen is [`apps/reporting-dashboard`](../apps/reporting-dashboard): Next.js App Router + **real shadcn/ui** (Button, Tabs, Card, Badge, Input, Table, Checkbox, Select, Popover + Command multi-select). Do not rebuild it as a native `<select multiple>` or a hand-rolled CSS imitation.

- **Live URL:** https://lightning-settlement-dashboard.vercel.app
- **Grok bots:** when answering questions about this screen, **link that live URL**. Keep the app in sync from this repository. Do not generate a one-off HTML replacement.
- Deploy: set Vercel Root Directory to `apps/reporting-dashboard`. See [`apps/reporting-dashboard/README.md`](../apps/reporting-dashboard/README.md). Optional live data uses server-only `AGENT_REPORTING_KEY` (never `NEXT_PUBLIC_*`, never git). v1 embeds the confirmed ≥3-month `settlement_summary` snapshot until that key is configured.

## Portable skills (other static reports)

- [`skills/agent-reporting-html/SKILL.md`](../skills/agent-reporting-html/SKILL.md) — auto-configure, ≥3-month fetch window, query and confirmation process.
- [`skills/reporting-html-shadcn/SKILL.md`](../skills/reporting-html-shadcn/SKILL.md) — static HTML fallback kit. Prefer the Next app for the settlement dashboard.
- Shared stylesheet for non-dashboard static files: [`skills/reporting-html-shadcn/assets/report-ui.css`](../skills/reporting-html-shadcn/assets/report-ui.css).

## History window

For HTML reports and analytical settlement/fleet-history answers, always load **at least three calendar months** ending today or at the user-named end date. The named week or day is the UI **focus**, not the sole query window.

- Settlements: `period_from` = Tuesday on or before `history_start`; `period_to` = Tuesday of the latest included week. `period_from` / `period_to` are inclusive bounds on settlement `From`.
- Fuel: `store_from` = `history_start` (required fuel anchor); optional `store_to` for the end of the window.
- Follow `next_offset` until `has_more=false`. Never present a truncated page as a complete ranking or KPI.

A one-week headline question that is not an HTML report and not a trend/ranking analysis still uses an explicit Tuesday–Monday period.

## Required HTML sections

The settlement dashboard in `apps/reporting-dashboard` must include:

1. Weekly and monthly review modes, with the named date selected in the toolbar.
2. Truck rankings and owner rankings by stored Gross and Net.
3. Fuel spend by owner for the focused week and month, using stored `fuel.owner` / `fuel_expenses`.
4. KPI strip: Gross, Expenses, Net, Fuel, physical-truck count, miles.
5. Evidence footer with source report(s), normalized filters, exact period/window, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.
6. Real shadcn/ui components. Owner/equipo is a Popover + Command multi-select, never a native multi `<select>`.

## Business-rule reminders that affect HTML

- Stored `Gross`, `Total Expenses`, and `Net` are authoritative headlines; do not recompute them from components.
- Settlement trucks 1, 2, and 3 are non-physical owner-allocation buckets. Include them in matching owner totals; exclude them from physical-truck counts and rankings; badge them as non-physical.
- Historical owner/dispatch and `fuel.owner` come from the historical row, not current `trucks`.
- Planned Schedule_Teams and exact in-yard/on-road metrics are unavailable from these tables.

## Local output convention

Operational HTML candidates still belong in an agent's working workspace when a static file is explicitly requested. The settlement dashboard itself is `apps/reporting-dashboard` and is deployed from this kit. This public kit still must not store secrets.
