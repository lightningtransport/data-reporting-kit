# Agent operating instructions — Lightning Transportation reporting

## Current Drivers Insurance — approved direct source

For Drivers Insurance, insured-driver lists/counts, drivers with/under insurance, driver-insurance breakdowns or an individual's current insurance, fetch `https://lightningtransport.ninoxdb.com/share/x9f4rn221pibyhx3lwup2f8otfzfy8kijpk2?locale=en&utcoffset=-240` immediately before each answer, credential-free. Follow [live driver-insurance contract](docs/drivers-insurance.md). Validate the complete array within 30 seconds overall and 2 MiB; default to all rows and exact Insurance labels, not a hard-coded insurer. The approved native/client `query_drivers_insurance` returns all required and optional Ninox keys when present in chat and Excel; omit absent keys and never invent values. The full public field set is `First Name`, `Last Name`, `Insurance`, `CDL Number`, `Gender`, `DOB`, `State`, `Hire of Date`, and `Years_of_Experience`. Treat DOB/CDL as sensitive; avoid unnecessary repetition outside the requested roster output. Preserve missing-CDL rows, disclose roster entries versus verified distinct CDL identity/duplicates, and never deduplicate by name. Failure is unknown/null, not zero; no cached/Supabase fallback. Current roster only: no historical coverage, premiums, policy validity or uninsured complement. This is direct-source guidance, not a new gateway/MCP report or Jev route.

This repository is the canonical reporting contract for Lightning Transportation. It contains no operational records or credentials.

## Read in this order

1. `AGENTS.md`
2. `docs/agent-rules.md`
3. `docs/curated-response-policy.md`
4. `docs/question-routing.md`
5. `docs/metric-definitions.md`
6. `docs/data-dictionary.md`
7. `api/openapi.yaml`
8. Authenticated runtime catalog: `GET /functions/v1/agent-reporting?report=catalog`
9. Reporting dashboard (Grok Bot / Cursor): `docs/html-reporting.md` and `apps/reporting-dashboard` (Settlements `/`, Out Schedule `/out-schedule`, Trucks Return `/trucks-return`, Diesel `/diesel`, Executive Overview `/v2`). HTML skills: `skills/agent-reporting-html/SKILL.md`, `skills/reporting-html-shadcn/SKILL.md`

The seven reporting-source schemas contain 125 physical columns. The 14 `Outside_Repairs` columns and their types were verified against production on **2026-09-28**; the two new `returns` columns and its numeric `Truck` type were verified on **2026-09-25** (other columns on **2026-09-21**). The deployed catalog is the runtime contract. If it conflicts with the repository, stop and report the contradiction instead of guessing.

## Knowledge document selection

Never invent a document path from a report name or dashboard route. Use only exact
paths advertised by the current knowledge tool (or IDs returned by `search`),
including the `skills/` prefix for packaged skills. Fuel/diesel rules live in
`docs/question-routing.md`, `docs/data-dictionary.md`, and
`docs/metric-definitions.md`; `/diesel` is a dashboard route, not a document.
If a knowledge request is rejected, retry once with an exact approved relevant
path, preserving `offset` and `limit` when the tool supports them. Do not retry the
same rejected path, guess another filename, broaden the allowlist, or bypass the
tool. If the corrected request fails, disclose the unavailable guidance.

## Approved interfaces

- Approved AI service accounts use the read-only `agent-reporting` Edge Function with their assigned `x-agent-key`.
- The separate JWT-based `reporting-query` endpoint is for approved personal Supabase memberships; onboarding remains paused until company Auth email/SMTP is ready.
- Never bypass either gateway with a database password, service-role/secret key, arbitrary SQL, shared employee session, or direct raw-table access.
- Approved credential-free external shares are explicit source routes, not gateway bypasses. For current “trucks in yard”, “off duty”, or “not working”, fetch `https://lightningtransport.ninoxdb.com/share/jx7z6tkjcnxalvsui4icdnqjuszia04etdhi?locale=en&utcoffset=-240` immediately before answering and follow [off-duty source contract](docs/off-duty-trucks.md). All rows are off duty/not on road, including `Ready To Go` and Outside/vendor locations. General yard synonyms use the full feed; physical-location filtering requires an explicit request. Validate the complete bounded JSON array, count distinct `truck_number`, and use exact source owner/dispatcher. Retrieval failures are unknown, not zero; this is current state, not history or a fleet complement. No dedicated MCP/report implementation is claimed.
- Never put an agent key in a URL, browser client, prompt, log, screenshot, repository, or answer.

## Mandatory query behavior

- Choose the smallest report and load its current metadata when meaning, filters, joins, grain, or calculations are not already known. For discovery use `?report=catalog&compact=true`, then only the selected report metadata; the default full HTTP catalog remains available. Canonical MCP `catalog({})` is compact-first, with explicit `compact=false` full opt-in. Hermes `get_reporting_catalog` wrappers must request compact at the HTTP layer before their output-size guard; syncing instructions does not replace installed wrapper code. Never disable the guard or truncate global rules. Compact routing summaries are not a substitute for field/calculation rules. Reuse already-loaded same-schema guidance within the task, never cached business rows. Full stable-ID collection should use `limit=1000` unless a smaller explicit page is needed; still reconcile every page and exact total.
- Use exact documented filter names and exact stored values. Unknown/duplicate parameters are errors.
- Supply required anchors: settlement reports need `period_from` or truck; DriverPay needs truck, driver, `out_from`, `return_from`, or `on_road_at`; fuel needs `truck_number`, `store_from`, or `ninox_id`; `outside_repairs` needs `truck`, `trailer`, `date_from`, or `ninox_id`.
- Follow `next_offset` until `has_more=false` when all rows are needed. `count`/`page_count` is one page; `total_count` is the filtered total.
- Request sensitive fields only for an explicit user need. Every `AGENT_API_KEY` / `AGENT_API_KEY_<number>` is permitted to request the explicit sensitive-field allowlists by default; `AGENT_ALLOW_SENSITIVE_<n>=false` is the opt-out restriction for a specific key. Minimize and redact output.
- Treat a denied/empty response as evidence only about that request, not proof that the business fact is false or that upstream data is current.

**Non-negotiable analysis rules**

- **Current on-road / working trucks (owner-approved 2026-10-08):** fetch `https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240` immediately before each answer, credential-free; follow [live on-road contract](docs/on-road-trucks.md). This primary most-current source answers current/now/today operational status. Fully validate all seven keys and exact `Status=On The Road Working` within 30 seconds overall and 2 MiB; count distinct `truck_number`, use exact source owner/dispatcher/insurance, and state fetch-start/completion timestamps. Failure means unknown/null, never zero; no cached/DriverPay fallback, GPS movement claim or fleet/off-duty complement. Historical or explicit-date assignment overlap alone uses fully paginated `driver_pay?on_road_at=D` (Out Date <= D, Return Date > D; null returns and return day excluded).

- Settlements run Tuesday through Monday. Use an explicit period; never infer the current cycle from `To Report` alone.
- For HTML reports and analytical settlement/fleet-history answers (trends, rankings), always fetch **at least three calendar months** ending today or at the user-named end date. The **settlement dashboard** loads **at least twelve calendar months**. The named week or day is UI focus only, not the sole data window. Paginate until complete. See `docs/html-reporting.md`.
- Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is an additional/Compass income component already included in Gross; expense components are already included in Total Expenses.
- **Settlement numeric coverage:** nullable components are unknown/unpopulated, not automatically zero, including allocation buckets. Complete pagination is not complete numeric coverage. Aggregate valid populated numeric measures with decimal arithmetic, disclose coverage, and preserve nonempty all-null results as null. `From`/`To` are dates, not amounts. See [numeric coverage](docs/metric-definitions.md#settlement-numeric-coverage) and [source verification](docs/data-dictionary.md#settlement-source-verification); generated `ID` is not a Ninox record ID. Never change financial records or the repaired native-client adapter to hide missing values.
- Route **every** road/outside/not-company-shop repair question to `outside_repairs` (`public."Outside_Repairs"`), not settlement `LTR Invoices` (internal shop). `Total Cost` includes parts and labor. `Choice=Truck` attributes the full cost to `Truck`; `Choice=Trailer` attributes the full cost to `Trailer`, never its accompanying truck. Include truckless records in overall totals but exclude them from truck and truck-owner breakdowns. Split comma-separated `Type of Work` categories for membership, allowing overlapping category totals; do not sum category subtotals into a grand total. Blank/null `AHS` means No. Use service `Date`, not `created_at`, for periods; do not use settlement `shared_owner` or current `trucks.owner` in place of stored `owner`.
- For `settlement_summary`, `settlements`, and `fuel` owner questions, an `owner` filter matches either the primary owner or `shared_owner`. `shared_owner` identifies the underlying owner for a truck operating under `SOLO INC.` or `FLATBED INC.`; preserve both fields and do not apply this rule to `trucks`, DriverPay, or returns.
- Settlement Truck 1, 2, and 3 are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in the matching owner's general settlement totals; exclude them from physical-truck counts/rankings.
- Every returning-trucks question/report is a two-source union for the same inclusive `Return Date` period. From `DriverPay`, exclude `Termination = Driver Changed` and `Transfer = Transfer To Other Truck`; let `tc` be the remaining non-solo rows and `ts` the remaining solo rows, with DriverPay formula count `floor(tc / 2 + ts)`. Union distinct qualifying `DriverPay.Truck_Number` with distinct `returns.Truck`, normalize only truck-key format, and count each truck once. Report source counts, overlap, source-only counts, union count, `tc`, `ts`, and any mismatch between the formula and distinct DriverPay trucks. Never use either source alone.
- Departures use the same inclusive `Out Date` frame on DriverPay and live Schedule_Teams; DriverPay alone is not a leaving-trucks total. Returning-truck periods use only `Return Date` on both required sources; do not add `Out Date` criteria unless the user explicitly asks for assignment overlap.
- For a current-week “how many trucks are leaving” report, combine distinct trucks from the `DriverPay.Out Date` departure set and the live Ninox `Schedule_Teams` departure set for the same Monday–Sunday window. Deduplicate the union, and report each source's count, overlap, source-only count, and final distinct-truck count. The live Schedule_Teams source is `https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240` and must be downloaded immediately before reporting.
- Historical owner/dispatch comes from the historical row, not current `trucks`.
- For return-period dispatcher or owner attribution, filter exact `returns.Dispatcher` / `returns.Owner` with inclusive `return_from` / `return_to`; count distinct numeric `returns.Truck` after complete pagination, not driver rows. These are the stored return-row truck dispatch/owner values, not current `trucks` values. Do not apply settlement `shared_owner` expansion. Preserve the separate two-source returning-trucks reconciliation when asking for total returns; a filtered returns attribution is not automatically an attributed DriverPay/union total.
- **Relational fallback:** When a requested report field is absent from its primary record, look for it in related approved-report data before finalizing. CDL is the unique driver key across `drivers` and `DriverPay`; use it to resolve driver attributes. Truck number is the unique vehicle key; compare the documented field variants (such as `truck_number`, `Truck_Number`, `Truck`, `truck_no`, or `unit_number`) after safe type/format normalization.
- Use a left join from historical records to the current `trucks` master; missing current-master matches do not invalidate history. Never substitute a name, Supabase `ID`, or `returns.Ninox_ID` for a missing CDL or truck key.
- `returns.CDL` is a sensitive exact driver key: use it to resolve a return only when it matches a verified CDL in related approved data. Never use a name, Supabase `ID`, or `returns.Ninox_ID` as a substitute.

*Evidence: approved business rule confirmed 2026-09-11; `returns.CDL` and `drivers.Date of Hire` physical columns verified on 2026-09-11.*
- Schedule_Teams is external planned state; the prepared `out_schedule`/`departures` gateway path remains **not integrated** in installed clients until deployed and verified. The legacy Ninox insurance-choice formula is not available from these Supabase tables; this does not block the approved live off-duty source. Current on-road/working membership uses the independent live on-road feed; DriverPay on_road_at is historical/explicit-date assignment overlap only.

## HTML reports

The reporting dashboard is the Next.js + shadcn/ui app in `apps/reporting-dashboard`. Grok Bot and Cursor agents must **link the live dashboard URL** (including deep links for each view) when answering questions about those screens, and keep UI changes in that app—not one-off HTML files.

**Live dashboard URL:** https://lightning-settlement-dashboard.vercel.app

| View | Path | When to link |
|---|---|---|
| Settlements | `/` | Settlement / fleet financial dashboard questions |
| Out Schedule | `/out-schedule` | Planned departures / Out Schedule / Schedule_Teams UI |
| Trucks Return | `/trucks-return` | Current expected returns / Trucks Return UI |
| Diesel | `/diesel` | Fuel / diesel gallons and spend by month and owner |
| Executive Overview | `/v2` | C-level / manager executive summary, Operating vs Accounting, Attention Now (not a Tabs replacement) |

The top Tabs row switches between Settlements, Out Schedule, Trucks Return, and Diesel on any route. `/v2` is a separate executive route outside that Tabs strip. Settlements reads paginated `settlements` (plus `fuel` gallons for the focus window) for ≥12 months, shows **Summary** (owner matrix, physical-truck KPIs, dispatch/owner filters), a truck focus card under search, and must not present a truncated truck ranking as the full fleet: preview plus **Show all** lists every physical truck in the selection. Out Schedule reads the live Ninox Schedule_Teams share. Trucks Return paginates `returns` (no Phone/CDL). Diesel paginates live `fuel` (≥12 months), with month navigation and historical `fuel.owner` filter.

Other HTML reports still follow the ≥3-month window and confirmed sections. Do not invent a second visual language; prefer real shadcn components in `apps/reporting-dashboard`.

Every Settlements view must include **Summary**, weekly and monthly review modes, truck and owner rankings, fuel spend by owner, a KPI strip, a closed **Technical details** evidence accordion, and the shared light theme. Visible copy is English operational wording. Do not display Ninox Full Week or Other Deductions+Previous: those fields are not in `public.settlements`. Out Schedule, Trucks Return, and Diesel use the same shell, shadcn Table/Badge, filters, row counts, and **Technical details** accordion.

## Optional client fast path

For supported plain company-wide counts/totals, the packaged client `ask` command uses one TypeSafe Jev judgment followed by deterministic approved-report retrieval and answer assembly. Use it instead of, not in addition to, a full model planning loop. All calculation/date/permission rules above remain code-owned. Scoped, sensitive, explicit-date, complex, financial and uncertain questions keep the existing reasoning path. A fallback has no answer/total. Never send report rows, secrets or conversation history to Jev. See [client contract](docs/jev-fast-reporting.md).

## Provider versus gateway troubleshooting

A primary timeout plus backup generation failure is not proof of a reporting gateway outage.
Inspect actual tool envelopes; independently check authorized reporting requests and
verify deployment-linked provider credentials before health/credits/quota claims.
Keep client model identity, failover and native adapters unchanged. Follow the
[troubleshooting evidence contract](docs/agent-reporting.md#provider-versus-gateway-troubleshooting).

## Required answer evidence

State source report/table, normalized filters, exact period, result and row/distinct count, pagination completeness, `as_of`, source-sync freshness limitation, and material grain/null/bucket/join/sensitivity caveats. Never present a truncated page or incomplete financial period as a complete total. HTML reports put the same evidence in the **Technical details** accordion.

## User-correction feedback

On every user correction, send a sanitized `reporting_agent_correction` event using the byte-identical contracts in `schemas/correction-feedback-event.schema.json` and the packaged skill reference. Send the initial event as `unverified`; reuse the same UUID for a later `verified` or `rejected` update. Keep webhook URL/token runtime-only and exclude PII, credentials, sessions, raw rows, and unnecessary identifiers. Follow `docs/knowledge-maintenance.md`; feedback is not an approved business rule until verified.

## Required freshness and maintenance

Installed agents must maintain one `data-reporting-kit-sync` job at 10:00 AM and 2:00 PM local time. A failed sync must be disclosed before relying on stale instructions.

Verified answer-affecting knowledge must update the relevant docs, tests, packaged skill, and `CHANGELOG.md` in the same work cycle; update OpenAPI and runtime metadata when their contracts are affected. For schema/function changes verify the live schema/function. Instruction-only approved direct-source changes require live-source validation, not gateway changes/deployment. Push and confirm the remote commit before declaring completion.

## Governed departure totals (prepared schema 3.8.0)

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](docs/departures.md).

Preserve `reconciliation`, `truck_sets`, `period`, `status`, and `complete`; source failure means `complete=false`, `status=incomplete`, and `combined_distinct_total=null`. Both optional date bounds must be supplied together (maximum 31 inclusive days); omitting both defaults to Monday–Sunday in America/New_York. Repository preparation does not remove the installed-client **not integrated** limitation.
