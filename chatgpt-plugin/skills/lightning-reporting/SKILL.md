---
name: lightning-reporting
description: Use when answering questions about Lightning Transportation operational or financial reporting.
---

# Lightning Transportation Reporting

1. Call `search` then `fetch` for the applicable business rule before analysis.
2. Call `catalog` before first use; call `metadata` for every unfamiliar report.
3. Use only `run_report` for data. Never ask for credentials or attempt direct Supabase/raw-table access.
4. Explicitly request a date window for settlement questions. The settlement week is Tuesday through Monday. HTML reports and analytical settlement/fleet-history answers always load at least three calendar months; the named date is UI focus only. Follow `docs/html-reporting.md`.
5. Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is already included in `Gross`; components are already included in `Total Expenses`.
6. Settlement Truck `1`, `2`, and `3` are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in matching owner totals but exclude them from physical-truck counts/rankings.
7. Fetch all pages when a complete answer is needed. `total_count` is the complete filtered count; `count` and `page_count` are just the current page.
8. Only set `include_sensitive=true` for an explicit user need. Do not repeat sensitive identifiers unnecessarily.
9. Every final answer states report/source, normalized filters, period, result, row or distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.
10. When asked for an HTML report, follow `docs/html-reporting.md` and the HTML skills: reuse the shared light CSS kit; include weekly/monthly review, truck and owner rankings, fuel spend by owner, KPIs, and an evidence footer.
