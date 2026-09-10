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
5. Run repository checks: Markdown links, OpenAPI syntax, helper syntax, `git diff --check`, and a staged-file secret scan.
6. Commit and push the verified update to `main`, then confirm the remote head contains it.

## Agent response rule

When a new fact is verified, an agent must both apply it to the immediate answer **and** update this kit before declaring the task done. The answer should name the documentation update/commit so the team can rely on the same rule.

If verification cannot be completed in the current task, state the limitation plainly, do not change the shared definition, and create no false certainty.
