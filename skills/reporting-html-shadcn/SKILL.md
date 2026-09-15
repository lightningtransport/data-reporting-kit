---
name: reporting-html-shadcn
description: >-
  Use when a Grok Bot or Cursor agent builds Lightning reporting HTML dashboards
  so every screen reuses the same shadcn-like components and styles.
version: 0.1.0
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Reporting, Lightning, HTML, UI]
    related_skills: [agent-reporting-html, itpros-supabase-reporting]
---

# Reporting HTML (shadcn-style)

## When

A Grok Bot or Cursor agent is building any standalone HTML report or dashboard for Lightning reporting (settlement, trucks, fuel, drivers, returns). Use this so every report shares the same components and styles.

## Goal

Static single-file (or small multi-file) HTML that **looks and behaves like shadcn/ui**: same tokens, radii, borders, typography, and component patterns — even without a React app.

## Source of truth

1. Copy the shared kit stylesheet before building a new report:
   - Canonical file in this repository: [`assets/report-ui.css`](assets/report-ui.css)
   - In the agent's working workspace, place it at `reports/assets/report-ui.css`
2. If the workspace copy is missing, copy it from this skill (or from the public `main` path `skills/reporting-html-shadcn/assets/report-ui.css`). Do not invent a second visual language.
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

1. Load/copy `assets/report-ui.css` (and optional JS helpers only if they reuse these class names).
2. Fetch data per [`agent-reporting-html`](../agent-reporting-html/SKILL.md).
3. Emit candidate HTML under the workspace `reports/candidates/` directory; wait for confirm before `reports/confirmed/`. Do not store operational HTML in this knowledge repository.
4. If you add a new reusable pattern, extend `assets/report-ui.css` and this skill in the same change.

## Don't

- Don't invent one-off colors, fonts, or card styles per report.
- Don't ship a React/Vite build for these ops HTML files unless the user asks for an app.
- Don't drop the shared toolbar / KPI / ranking / fuel sections “to save time.”
