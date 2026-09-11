# Agent operating instructions — Lightning Transportation reporting

This repository is the canonical **reporting contract** for Lightning Transportation. It defines how to interpret the live Supabase data without copying operational records into this repository.

## Read in this order

1. `docs/agent-rules.md` — non-negotiable answer, date, access, and aggregation rules.
2. `docs/question-routing.md` — select the minimum approved report and its filters.
3. `docs/metric-definitions.md` — calculate the requested metric exactly once.
4. `docs/data-dictionary.md` — table grain, column-by-column definitions, joins, and sensitivity.
5. `api/openapi.yaml` — actual reporting API request contract.

`docs/data-dictionary.md` is a live-schema snapshot verified on **2026-09-10**. Do not invent a column, reinterpret a similar-looking column, or assume a field is populated merely because it exists.

## Mandatory behavior

- Use only the approved `reporting-query` API for routine reporting. Do not bypass it with direct database access, shared sessions, passwords, or service-role credentials.
- Treat report rows as evidence, not as a complete answer. Apply the table grain, filters, date rules, cardinality rules, and metric definition before answering.
- State the source report/table, exact filters, exact date range, row count or distinct count as applicable, `as_of` freshness, and material caveats.
- Never expose driver contact details, CDL data, date of birth, or credentials.
- If a requested field, definition, period, or data coverage is ambiguous, say what is missing and ask for clarification. Do not guess.
- For a question requiring a grouping, aggregate returned rows locally only after checking the documented grain. Never join current `trucks` attributes onto historical `settlements` to attribute a historical owner or dispatcher.

## User-correction feedback

When a user corrects a reporting agent, send a sanitized `reporting_agent_correction` event using the exact versioned contract in [`schemas/correction-feedback-event.schema.json`](schemas/correction-feedback-event.schema.json). This applies to every agent system using this repository, not only Hermes. The Make destination is a runtime-only environment variable (`REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL`) and must never be committed here. Send the user question/task and correction in the required fields, then send the verified/rejected status update under the same event ID after evidence review. The full privacy and delivery rules are in the reporting skill and `docs/knowledge-maintenance.md`.

## Continuous knowledge rule

Follow [`docs/knowledge-maintenance.md`](docs/knowledge-maintenance.md). When verified knowledge changes how an agent should select, interpret, calculate, aggregate, secure, or explain data, update this kit in the same work cycle before declaring the work complete. Do not publish guesses: mark incomplete semantics as **not established** until verified.

A documentation change that could affect an answer must update `CHANGELOG.md`. A schema or API change must update the data dictionary, routing rules, metric definitions, API contract, and this file when applicable. Verify against the live schema before claiming the kit is current.
