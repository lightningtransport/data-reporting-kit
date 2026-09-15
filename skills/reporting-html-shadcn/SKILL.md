---
name: reporting-html-shadcn
description: >-
  Use when a Grok Bot or Cursor agent builds Lightning reporting HTML dashboards
  so every screen reuses the same shadcn-like components and styles.
version: 0.2.0
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Reporting, Lightning, HTML, UI]
    related_skills: [agent-reporting-html, itpros-supabase-reporting]
---

# Reporting HTML (shadcn-style)

## When

A Grok Bot or Cursor agent is changing Lightning reporting UI. The **settlement dashboard** is the Next.js app [`apps/reporting-dashboard`](../../apps/reporting-dashboard) with **real shadcn/ui**. Use this skill so other static reports stay consistent; do not rebuild the settlement screen as a CSS imitation.

## Goal

For the settlement dashboard: Next.js App Router + shadcn/ui (Button, Tabs, Card, Badge, Input, Table, Checkbox, Select, Popover + Command multi-select). Owner/equipo is never a native `<select multiple>`.

For other static files only: small HTML that reuses [`assets/report-ui.css`](assets/report-ui.css).

## Source of truth

1. Settlement dashboard: edit [`apps/reporting-dashboard`](../../apps/reporting-dashboard) (Next.js + real shadcn/ui). That app is what Grok bots must link after deploy (`docs/html-reporting.md`).
2. Other static HTML only: copy [`assets/report-ui.css`](assets/report-ui.css) to the workspace `reports/assets/report-ui.css` (skill-cache fallback: `skills/reporting-html-shadcn/assets/report-ui.css`). Do not invent a second visual language.
3. Match the confirmed settlement look: clean minimal **light** theme, more whitespace, clear hierarchy, soft borders, no heavy shadows.

## Stack for static HTML

- Shared `report-ui.css` that already encodes the shadcn-like tokens, **or** Tailwind via CDN (`https://cdn.tailwindcss.com`) configured with the same CSS variables.
- Chart.js from CDN for charts.
- No second component library. No dark ops theme unless the user explicitly asks.

## Required components (reuse class names)

Use these patterns every time (names stable):

- **PageShell** — max-width container, padded background; `body.report-body` + `.page-shell`
- **ReportHeader** — title, subtitle, meta badges (range, row count, caveats); `.report-header`, `.badge-row`, `.badge`
- **Toolbar** — vista tabs (weekly / monthly / daily-review), week/month controls, owner multi-select, truck search, physical-only toggle; `.toolbar`, `.tabs`, `.week-nav`, `.field`, `.chk`
- **KpiStrip** — card grid: Gross, Expenses, Net, Fuel, physical trucks, miles; `.kpi-strip`, `.kpi`
- **Card** — bordered rounded surface, light padding, `.card` + `.card-title` + optional `.card-hint`
- **ChartCard** — Card + `.chart-box` for fixed chart height
- **DataTable** — sticky header, tabular nums, hover row, non-physical bucket badge (`.tag-np`)
- **RankList** — ordered top-N trucks/owners
- **EvidenceFooter** — `.evidence`: filters, `as_of`, `source_freshness`, pagination complete, caveats

Map mentally to shadcn: Card, Badge, Button, Tabs, Input, Select, Table, Separator.

## Content rules (always)

- Spanish primary labels; short English secondary only if useful, unless the user asks for another language.
- Focus period in the toolbar; data payload always includes **≥3 months** history for trends/rankings. See [`agent-reporting-html`](../agent-reporting-html/SKILL.md) and [`docs/html-reporting.md`](../../docs/html-reporting.md).
- Fuel spend by owner (focused week + month) using stored `fuel.owner`.
- Top trucks/owners by Gross and Net from stored settlement values.
- Settlement trucks `1` / `2` / `3`: label non-physical; exclude from physical rankings; include in owner totals.
- Evidence footer on every report.

## Process

1. If the work is the settlement dashboard, change `apps/reporting-dashboard` and keep it Vercel-deployable. Do not emit a replacement HTML file.
2. For other static reports: load/copy `assets/report-ui.css` (and optional JS helpers only if they reuse these class names).
3. Fetch data per [`agent-reporting-html`](../agent-reporting-html/SKILL.md).
4. Emit candidate HTML under the workspace `reports/candidates/` directory; wait for confirm before `reports/confirmed/`. Do not store operational HTML in this knowledge repository.
5. If you add a new reusable static pattern, extend `assets/report-ui.css` and this skill in the same change.

## Don't

- Don't rebuild the settlement dashboard as a CSS-only imitation or a native `<select multiple>`.
- Don't invent one-off colors, fonts, or card styles when shadcn/ui already covers the control.
- Don't drop the shared toolbar / KPI / ranking / fuel sections “to save time.”
- Don't put `AGENT_REPORTING_KEY` in the browser, `NEXT_PUBLIC_*`, or git.
