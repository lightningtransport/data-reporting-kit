# Changelog

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
