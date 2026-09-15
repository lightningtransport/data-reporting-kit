---
name: agent-reporting-html
description: >-
  Use when querying agent-reporting or building HTML reports — auto-configure
  from this kit, always fetch ≥3 months for HTML/analytical settlement history,
  and ship the confirmed report sections.
version: 0.1.0
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport, HTML]
    related_skills: [itpros-supabase-reporting, reporting-html-shadcn]
---

# Agent-reporting HTML reports

## When

Building or updating HTML reports from the `agent-reporting` gateway, or bootstrapping an agent that auto-configures from this repository.

## Auto-configure first

1. Read this kit in order: `AGENTS.md`, `docs/agent-rules.md`, `docs/question-routing.md`, `docs/metric-definitions.md`, `docs/data-dictionary.md`, `docs/agent-reporting.md`, `docs/html-reporting.md`, `api/openapi.yaml`.
2. Use the assigned runtime secret only (`LIGHTNING_AGENT_REPORTING_KEY` for the packaged helper; `AGENT_REPORTING_KEY` for the ChatGPT connector). Never put the key in chat, a URL, HTML, a prompt, a log, or this repository. If it is missing, stop and ask the operator to inject it through the host secret mechanism.
3. Default endpoint: `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`. Override only with the operator-configured `AGENT_REPORTING_ENDPOINT`.
4. Validate with `GET ?report=catalog` and header `x-agent-key`. If the live catalog conflicts with this kit, stop and report the contradiction.

## Data window (non-negotiable)

- For any HTML report or analytical answer from settlement/fleet history, **always fetch at least 3 months** back from today (or from the user-named end date), even if the user named one week or one day.
- Use the named date as the **focus** (selected week/month in the UI), not as the only data loaded.
- Compute `history_start` as three calendar months before today or the named end date. For `settlements` / `settlement_summary`, set `period_from` to the Tuesday on or before `history_start` and `period_to` to the Tuesday of the latest included week. For `fuel`, set `store_from` to `history_start` as the required fuel anchor.
- Paginate until complete (`next_offset` while `has_more`). `count` / `page_count` is one page; `total_count` is the filtered total.

## Query rules

- Never raw SQL, service-role keys, or direct tables. Never print the agent key.
- Smallest report plus `metadata=true` when meaning, filters, joins, grain, or calculations are unclear.
- Follow kit business rules: Tuesday–Monday settlements; stored Gross / Total Expenses / Net; settlement trucks 1/2/3 are non-physical owner-allocation buckets.
- Fuel spend by owner uses stored `fuel.owner` (historical transaction attribution). Do not substitute current `trucks.owner`.
- Request sensitive fields only for an explicit user need. Minimize and redact HTML output.

## HTML every time

Always apply the confirmed report sections:

- Weekly and monthly review modes (named date is toolbar focus).
- Truck rankings and owner rankings (Gross and Net); exclude settlement trucks 1/2/3 from physical-truck rankings; include them in matching owner totals.
- Fuel spend by owner for the focused week and month.
- KPI strip: Gross, Expenses, Net, Fuel, physical trucks, miles.
- Evidence footer: source report(s), normalized filters, exact period/window, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, material caveats.
- Clean minimal **light** theme.

Build UI only via [`reporting-html-shadcn`](../reporting-html-shadcn/SKILL.md) so components and styles stay consistent. Copy [`../reporting-html-shadcn/assets/report-ui.css`](../reporting-html-shadcn/assets/report-ui.css); do not invent one-off styles.

In the agent's working workspace (not this knowledge repository): emit candidates under `reports/candidates/`; wait for user confirmation before `reports/confirmed/`. Do not regenerate a confirmed report unchanged.

## Don't

- Don't ship a one-off date slice without the 3-month backdrop for HTML or analytical settlement/fleet history.
- Don't invent metrics or recompute stored Gross / Total Expenses / Net for headlines.
- Don't treat Schedule_Teams or exact in-yard/on-road metrics as available from these Supabase tables.
