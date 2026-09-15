# Changelog

## 3.6.0 - 2026-09-15

- Live dashboard no longer refetches ~6k settlement rows and ~43k fuel rows on every browser load: settlements and fuel paginate in parallel, the HTML revalidates every 5 minutes, and the function allows 60s. A loading state shows while the first live fetch runs.

## 3.5.0 - 2026-09-15

- Settlement dashboard UX: slim **Liquidaciones** header (focused period + **Copia** when not live), mobile-first filters, immediate **Camión** focus card on search, Spanish operational copy, and kit evidence in a closed **Datos técnicos** accordion. The owner matrix scrolls horizontally; on the embedded copy, Compass/loans/repairs/tolls show as missing rather than $0.00.
- Skills: `agent-reporting-html` 0.2.1, `reporting-html-shadcn` 0.3.1, `itpros-supabase-reporting` 0.9.1.

## 3.4.0 - 2026-09-15

- Settlement dashboard now loads paginated `settlements` for ≥12 months (plus `fuel` gallons for MPG) and adds a C-level **Resumen ejecutivo**: owner matrix, physical-truck averages, Gross-below-$11,000 count, net+/−, LTR Invoices, Tolls+PrePass, historical Dispatch filter.
- Truck Gross/Net lists preview a top slice and open **Ver más** for every physical truck in the selection. Compass is stored `tonu` (already in Gross). Full Week and Other Deductions+Previous are documented as not established.
- Live fetch uses server-only `AGENT_REPORTING_KEY` with `cache: no-store`; the embedded JSON is fallback only. `as_of` remains request time, not Ninox sync.
- Skills: `agent-reporting-html` 0.2.0, `reporting-html-shadcn` 0.3.0, `itpros-supabase-reporting` 0.9.0.

## 3.3.1 - 2026-09-15

- Recorded the production settlement dashboard URL `https://lightning-settlement-dashboard.vercel.app` in `AGENTS.md`, `docs/html-reporting.md`, the dashboard env example/README, routing/rules, and HTML reporting skills (`agent-reporting-html` 0.1.1, `reporting-html-shadcn` 0.2.1, `itpros-supabase-reporting` 0.8.2) so Grok bots link the live host instead of a pending placeholder.

## 3.3.0 - 2026-09-15

- Added portable HTML reporting guidance for **Grok Bot and Cursor agents** that auto-configure from this kit, so they reuse the confirmed settlement-report sections.
- Added a deployable Next.js App Router + **real shadcn/ui** settlement dashboard at `apps/reporting-dashboard`, replacing the native `<select multiple>` owner control with a Popover + Command multi-select.
- HTML reports and analytical settlement/fleet-history answers must fetch at least three calendar months of history; the user-named date is UI focus only, not the sole data window.
- Every settlement dashboard view must include weekly/monthly review modes, truck and owner rankings, fuel spend by owner, a KPI strip, an evidence footer, and the shared light theme.
- Grok bots must **link the live Vercel dashboard URL** (recorded in `docs/html-reporting.md` after deploy) instead of generating one-off HTML files. `AGENT_REPORTING_KEY` is documented as a server-only Vercel env var and is not committed.
- Packaged skills: `skills/agent-reporting-html`, `skills/reporting-html-shadcn` 0.2.0 (with `assets/report-ui.css`), and `skills/itpros-supabase-reporting` 0.8.1 pointing at the Next dashboard. Cross-linked from `AGENTS.md`, README Start here, routing, metrics, agent rules, and the installed reporting skill.
- The historical `chatgpt-plugin/` package and `docs/chatgpt-plugin.md` are left untouched.
- Corrected current-week “how many trucks are leaving” reporting: agents must reconcile distinct DriverPay `Out Date` departures with the live Ninox Schedule_Teams `Out Date` schedule for the same Monday–Sunday window. Reports now disclose the overlap, each source-only count, and the deduplicated union rather than treating either source as complete.

## 3.2.0 - 2026-09-14

- Added the approved `fuel` report to the custom-key `agent-reporting` gateway, with all 13 verified `public.fuel` fields, strict bounded filters, stable transaction ordering, catalog/metadata discovery, and exact pagination.
- Extended the OpenAPI contract, routing, data dictionary, metrics, access guidance, packaged reporting skill, and tests so every default `AGENT_API_KEY` / `AGENT_API_KEY_<number>` principal learns that it can read the seven approved reports, including `fuel`, unless its explicit `AGENT_REPORTS_<n>` allowlist excludes it.

## 2026-09-14

- Clarified that settlement Trucks 1/2/3 are Carlos/Jorge/CDT non-physical owner-expense allocation buckets only in `settlements` and settlement-derived reports. Each represents its owner's total unassigned `truck_loans` and `Insurance`; reports must label them as non-physical, include them in the matching owner total, and exclude them from physical-truck counts/rankings.
- Removed the incorrect application of that settlement-only rule from the current `trucks` report and its `physical_only` API filter.

## 3.0.0 - 2026-09-14

- Removed the retired `organization_id` scope from reporting tables, the settlement summary view, query functions, metadata, tests, and documentation.
- Removed organization resolution from agent keys; reporting is now a single-organization system while retaining per-key authorization controls and audit logging.

## 0.6.3 — 2026-09-11

- Added newly verified live columns to the agent-reporting contract: `drivers."Date of Hire"` (date), `returns.CDL` (sensitive text), and `trucks.Ninox_ID` (numeric), raising coverage from 96 to 99 physical columns.
- Added Date of Hire range filters (`hire_from` / `hire_to`) and trucks Ninox ID filtering. `returns.CDL` is returned only through the explicit sensitive-field projection (`include_sensitive=true`), not accepted as a GET filter, so its value never enters request URLs. All agent keys can read these fields.

## 0.6.2 — 2026-09-11

- Restored full read access for every `AGENT_API_KEY` and `AGENT_API_KEY_<number>` principal across all six approved reports and their documented sensitive-field allowlists when requested with `include_sensitive=true`.
- Retained an explicit opt-out: `AGENT_ALLOW_SENSITIVE_<n>=false` restricts a particular key without changing the default for other approved agents.
- Aligned the runtime catalog, API contract, routing, access guide, and installed reporting skill so agents no longer classify the `drivers` table or its requested documented fields as unavailable.

## 0.6.1 — 2026-09-11

- Added an approved CDL-based driver lookup and truck-number-based vehicle lookup rule for relational report fallbacks. Agents must resolve absent required attributes from related approved-report sources before finalizing, while preserving left joins for historical vehicle data. `returns.CDL` was subsequently added to the live schema and is documented in 0.6.3 as the exact driver key for that table.
- Prohibited surrogate joins using names, Supabase identity IDs, or `returns.Ninox_ID`. The earlier no-CDL limitation is superseded by 0.6.3, which documents the newly verified `returns.CDL` field and its exact-match rule.

## 0.6.0 — 2026-09-11

- Added the live `agent-reporting` source and strict, authenticated catalog/metadata contract for all five reporting tables and all 96 physical columns.
- Fixed malformed quoted settlement filters, overwritten range bounds, `solo=false` null handling, silent unknown/duplicate/blank filters, invalid date/number/boolean/enum handling, unstable ordering, and page counts that could be mistaken for totals.
- Added server-enforced organization scoping, per-key report/expiry/sensitive controls, explicit sensitive projections, fail-closed request auditing with distinct principal identity/role details, and a transition path to a Supabase secret key.
- Added deterministic pagination with required exact `total_count`, `has_more`, and `next_offset`, explicit HTTP 416 past-end behavior, and configurable helper reconciliation while preserving the authorized omitted-report legacy `{count,data}` success shape.
- Enriched runtime and repository guidance from the Ninox knowledge catalog: field meanings, source mappings, cast-safe/left joins, date rules, stored-value precedence, allocation buckets 1/2/3, and unsupported Schedule_Teams/in-yard questions.
- Corrected Returns `Return Date` to nullable PostgreSQL `date` and clarified that `returns.Ninox_ID` is not a driver ID.
- Added the agent-key helper, updated OpenAPI/access lifecycle, and added executable 96-column metadata coverage tests.

## 0.5.0 — 2026-09-11

- Added a packaged, revision-aware GitHub synchronization script and a required twice-daily `data-reporting-kit-sync` cron contract at 10:00 AM and 2:00 PM local time for every installed reporting agent.

## 0.4.0 — 2026-09-11

- Standardized all reporting-agent user-correction feedback on a versioned JSON Schema, including a required sanitized question/task, correction, source, UUID, verification status, privacy metadata, and affected domains.
- Changed feedback delivery to send an initial unverified event when a user corrects an agent, followed by a status update when the finding is verified or rejected; Make.com is notification-only and cannot modify the repository.
- Kept the Make webhook URL out of this public repository and required runtime configuration through `REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL`.

## 0.3.1 — 2026-09-10

- Added a conditional, privacy-safe correction-feedback webhook instruction to the reporting skill. It distributes only verified, sanitized knowledge; it never writes to the repository automatically.

## 0.2.2 — 2026-09-10

- Established and documented the GitHub access policy: public read access is allowed, while only the `lightningtransport` repository owner may retain write/admin access; all other collaborators are read-only.

## 0.2.1 — 2026-09-10

- Added a continuous-knowledge maintenance rule: verified reporting knowledge must be documented, validated, changelogged, pushed, and shared with the immediate answer before work is complete.

## 0.2.0 — 2026-09-10

- Added `AGENTS.md` and mandatory agent rules covering approved sources, confidentiality, date windows, cardinality, financial definitions, current-vs-historical attribution, answer evidence, and the owner-assignment accounting-bucket rule.
- Replaced the partial data dictionary with a live-schema-verified inventory of every current `public` table and all 113 columns, including table grain, PII restrictions, joins, and unknown-field safeguards.
- Documented the endpoint’s actual supported filter keys and response contract in OpenAPI 3.1.
- Corrected public-test versus private-repository onboarding language and removed a personal email from the portable skill example.

## 0.1.0

- Added the initial shared data dictionary, question-routing guide, agent skill, API contract, and access lifecycle guide.
- Added a role-scoped reporting gateway design with request auditing.
