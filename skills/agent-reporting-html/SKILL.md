---
name: agent-reporting-html
description: >-
  Use when a Grok Bot or Cursor agent queries agent-reporting or builds HTML
  reports — auto-configure from this kit, fetch ≥12 months for the
  settlement dashboard and ≥3 months for other HTML/analytical settlement
  history, and ship the confirmed report sections.
version: 0.2.4
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport, HTML]
    related_skills: [itpros-supabase-reporting, reporting-html-shadcn]
---

# Agent-reporting HTML reports

## When

A Grok Bot or Cursor agent is building or updating HTML reports from the `agent-reporting` gateway, or bootstrapping after auto-configure from this repository.

## Auto-configure first

1. Read this kit in order: `AGENTS.md`, `docs/agent-rules.md`, `docs/question-routing.md`, `docs/metric-definitions.md`, `docs/data-dictionary.md`, `docs/agent-reporting.md`, `docs/html-reporting.md`, `api/openapi.yaml`.
2. Use the assigned runtime secret only (`LIGHTNING_AGENT_REPORTING_KEY` for the packaged helper). Never put the key in chat, a URL, HTML, a prompt, a log, or this repository. If it is missing, stop and ask the operator to inject it through the host secret mechanism.
3. Default endpoint: `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`. Override only with the operator-configured endpoint for this agent.
4. Validate with `GET ?report=catalog` and header `x-agent-key`. If the live catalog conflicts with this kit, stop and report the contradiction.

## Data window (non-negotiable)

- For any HTML report or analytical answer from settlement/fleet history, **always fetch at least 3 months** back from today (or from the user-named end date), even if the user named one week or one day.
- The live settlement dashboard must fetch **at least 12 months** of `settlements` (paginated) plus `fuel` gallons for MPG. Use `report=settlements`, not the 11-field `settlement_summary` recorte, for that screen.
- Use the named date as the **focus** (selected week/month in the UI), not as the only data loaded.
- Compute `history_start` as three calendar months (dashboard: twelve) before today or the named end date. For `settlements` / `settlement_summary`, set `period_from` to the Tuesday on or before `history_start`. For `fuel`, set `store_from` to `history_start` as the required fuel anchor.
- Paginate until complete (`next_offset` while `has_more`). `count` / `page_count` is one page; `total_count` is the filtered total. Truck rankings may preview top-N; **Ver más** must list the full physical selection.

## Query rules

- Never raw SQL, service-role keys, or direct tables. Never print the agent key.
- Smallest report plus `metadata=true` when meaning, filters, joins, grain, or calculations are unclear.
- Follow kit business rules: Tuesday–Monday settlements; stored Gross / Total Expenses / Net; settlement trucks 1/2/3 are non-physical owner-allocation buckets.
- Fuel spend by owner uses stored `fuel.owner` (historical transaction attribution). Do not substitute current `trucks.owner`.
- Request sensitive fields only for an explicit user need. Minimize and redact HTML output.

## HTML every time

The reporting dashboard is [`apps/reporting-dashboard`](../../apps/reporting-dashboard). Link the matching live URL; do not replace it with a native multi `<select>` or a one-off HTML file.

- Liquidaciones: https://lightning-settlement-dashboard.vercel.app
- Out Schedule: https://lightning-settlement-dashboard.vercel.app/out-schedule
- Trucks Return: https://lightning-settlement-dashboard.vercel.app/trucks-return
- Diesel: https://lightning-settlement-dashboard.vercel.app/diesel

Always apply the confirmed Liquidaciones sections:

- Slim **Liquidaciones** header plus a **Camión** focus card immediately under filters when searching a truck.
- **Resumen** from `settlements` (owner matrix, physical averages, $11k Gross count, net+/−, LTR, Tolls+PrePass). Compass = `tonu` (already in Gross). Visible copy is Spanish operational wording.
- Dispatch filter = exact historical `settlements.Dispatch`.
- Weekly and monthly review modes (named date is toolbar focus).
- Truck rankings and owner rankings (Gross and Net); exclude settlement trucks 1/2/3 from physical-truck rankings; include them in matching owner totals; Ver más = full selection; badge **No físico**.
- Fuel spend by owner from stored Fuel Expenses; gallons/MPG from `fuel`.
- KPI strip: Gross, Gastos, Net, Combustible, physical trucks, millas.
- Evidence in a closed **Datos técnicos** accordion: source report(s), normalized filters, exact period/window, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, material caveats.
- Real shadcn/ui in the Next app; Popover + Command for owner multi-select; top-right **Vistas** menu for Liquidaciones / Out Schedule / Trucks Return / Diesel.
- Do not display Full Week or Other Deductions+Previous.

When the user asks to **see** / open / show Out Schedule, Trucks Return, or Diesel (planned departures / expected returns / fuel screens), answer with the matching live dashboard URL above. Do not generate a replacement one-off HTML file.

For Out Schedule / Trucks Return / Diesel UI questions, link the deep URLs above. Out Schedule uses live Schedule_Teams; Trucks Return uses `returns` without Phone/CDL; Diesel uses live `fuel` by month and historical `fuel.owner`.

## Don't

- Don't ship a one-off date slice without the 3-month backdrop for HTML or analytical settlement/fleet history.
- Don't invent metrics or recompute stored Gross / Total Expenses / Net for headlines.
- Don't treat exact in-yard/on-road metrics as available from these Supabase tables; planned Schedule_Teams UI is the `/out-schedule` dashboard view.
