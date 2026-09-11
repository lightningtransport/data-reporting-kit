# Continuous knowledge maintenance

## Standing rule

> **When verified knowledge changes how an agent should select data, interpret a field, calculate a metric, apply a date window, aggregate rows, protect data, or describe an answer, update this repository in the same work cycle before calling the work complete.**

The repository—not an agent's unrecorded session context—is the shared source of truth for future agents.

## What counts as verified knowledge

A change must have an attributable source:

1. **Live Supabase schema, API behavior, or RLS/access behavior** verified through the approved admin tools.
2. **Approved business rule** supplied or confirmed by a responsible Lightning Transportation decision-maker.
3. **Reproducible reporting finding** confirmed against the live data and documented calculation rules.
4. **Observed agent failure** with a demonstrated root cause and a corrected, testable rule.

Do not publish assumptions, individual agent guesses, raw customer/driver data, secrets, sessions, or service-role credentials as “knowledge.” Mark incomplete semantics as **not established** until verified.

## Required update procedure

1. Capture the evidence source and verification date in the changed document.
2. Update every affected artifact:
   - `AGENTS.md` for a universal agent behavior rule.
   - `docs/agent-rules.md` for mandatory interpretation or safety behavior.
   - `docs/data-dictionary.md` for table, column, grain, join, PII, or source-system changes.
   - `docs/metric-definitions.md` for calculations, inclusions/exclusions, or period definitions.
   - `docs/question-routing.md` for source/report/filter selection.
   - `api/openapi.yaml` and the reporting skill when API behavior changes.
3. Add a dated `CHANGELOG.md` entry explaining the answer-impacting change.
4. Validate the changed artifact against its evidence source. For schema/API changes, re-query the live schema/API; for calculations, run a reproducible test or reconciliation.
5. Run repository checks: Markdown links, OpenAPI syntax, helper syntax, `git diff --check`, a staged-file secret scan, and byte-for-byte equality between `schemas/correction-feedback-event.schema.json` and the packaged skill copy when the correction schema changes.
6. Commit and push the verified update to `main`, then confirm the remote head contains it.

## Correction feedback distribution

On **every user correction**, the reporting skill sends one sanitized, standardized `reporting_agent_correction` webhook event under the contract in `schemas/correction-feedback-event.schema.json`, initially with `verification_status: "unverified"`. The event must include the sanitized user question/task and correction so Make.com can map the same fields from every agent.

- The webhook is active only when the repository owner explicitly configures `REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL`; the URL is a runtime-only capability and must never be committed to this public repository.
- A later verification must send a status update using the same event ID with `verification_status: "verified"` or `"rejected"`, evidence metadata, and candidate affected documents.
- Agents must send the minimal generalizable feedback, never raw records or personal data, and must not treat a user correction as an approved rule until it is verified.
- Webhook delivery does not update the repository automatically. A maintainer verifies a candidate update, changes affected documentation, adds a changelog entry, validates it, and pushes the commit.
- If no approved webhook is configured or delivery fails, the agent continues safely and follows the repository update procedure directly.

## Agent response rule

When a new fact is verified, an agent must both apply it to the immediate answer **and** update this kit before declaring the task done. The answer should name the documentation update/commit so the team can rely on the same rule.

## Installed-agent freshness

The reporting skill packages `scripts/sync-data-reporting-kit.sh`. Every installed Hermes agent must have one native cron job named `data-reporting-kit-sync` scheduled at `0 10,14 * * *` in that agent's local timezone. It compares the canonical GitHub `main` revision, updates only when it changes, and leaves a revision marker under the active `$HERMES_HOME` profile. A stale or failed synchronization must be disclosed before relying on the installed instructions.

If verification cannot be completed in the current task, state the limitation plainly, do not change the shared definition, and create no false certainty.
