# HTML reporting conventions

Read `AGENTS.md` first. These rules apply when an agent builds a standalone HTML report or an analytical settlement/fleet-history view from `agent-reporting`. They do not change the API contract.

*Evidence: portable HTML reporting convention published 2026-09-15 so agents that auto-configure from this kit reuse the confirmed settlement-report sections and shared light UI kit.*

## Portable skills

- [`skills/agent-reporting-html/SKILL.md`](../skills/agent-reporting-html/SKILL.md) — auto-configure, ≥3-month fetch window, query and confirmation process.
- [`skills/reporting-html-shadcn/SKILL.md`](../skills/reporting-html-shadcn/SKILL.md) — shadcn-like static HTML components and class names.
- Shared stylesheet to copy: [`skills/reporting-html-shadcn/assets/report-ui.css`](../skills/reporting-html-shadcn/assets/report-ui.css). Place a working copy at `reports/assets/report-ui.css` in the agent's workspace, not in this knowledge repository.

## History window

For HTML reports and analytical settlement/fleet-history answers, always load **at least three calendar months** ending today or at the user-named end date. The named week or day is the UI **focus**, not the sole query window.

- Settlements: `period_from` = Tuesday on or before `history_start`; `period_to` = Tuesday of the latest included week. `period_from` / `period_to` are inclusive bounds on settlement `From`.
- Fuel: `store_from` = `history_start` (required fuel anchor); optional `store_to` for the end of the window.
- Follow `next_offset` until `has_more=false`. Never present a truncated page as a complete ranking or KPI.

A one-week headline question that is not an HTML report and not a trend/ranking analysis still uses an explicit Tuesday–Monday period.

## Required HTML sections

Every HTML report must include:

1. Weekly and monthly review modes, with the named date selected in the toolbar.
2. Truck rankings and owner rankings by stored Gross and Net.
3. Fuel spend by owner for the focused week and month, using stored `fuel.owner`.
4. KPI strip: Gross, Expenses, Net, Fuel, physical-truck count, miles.
5. Evidence footer with source report(s), normalized filters, exact period/window, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.
6. The shared light minimal theme from `report-ui.css`. Do not invent one-off styles.

## Business-rule reminders that affect HTML

- Stored `Gross`, `Total Expenses`, and `Net` are authoritative headlines; do not recompute them from components.
- Settlement trucks 1, 2, and 3 are non-physical owner-allocation buckets. Include them in matching owner totals; exclude them from physical-truck counts and rankings; badge them as non-physical.
- Historical owner/dispatch and `fuel.owner` come from the historical row, not current `trucks`.
- Planned Schedule_Teams and exact in-yard/on-road metrics are unavailable from these tables.

## Local output convention

Operational HTML belongs in the agent's working workspace (`reports/candidates/`, then `reports/confirmed/` after the user confirms). This public kit stores instructions and the CSS kit only—never business rows, secrets, or generated reports.
