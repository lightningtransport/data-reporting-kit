# Jev reporting fast path

## Architecture and scope

The portable reporting client has an optional `ask` command. One batched TypeSafe Jev call chooses the workflow, time-window meaning, answer language, and whether the request is a plain unfiltered aggregate. Deterministic code resolves dates, checks current API permissions and metadata, retrieves complete data, computes exact metrics, and renders a template. No report rows, history, keys, or business totals are sent to Jev.

The original Jev rollout did not change the Supabase `agent-reporting` function (then schema 3.8.1). The current client schema pin is 3.8.2 after the separate off-duty-source metadata update; that source is not a Jev fast path. Existing `catalog`, `metadata`, `query`, and remote MCP tool contracts remain unchanged apart from the documented schema version and new global routing guidance. This is not an automatic hook on every Hermes turn and not a new natural-language endpoint. The installed reporting skill selects `ask` only for appropriate routine questions; other clients must invoke the command themselves or integrate it separately.

## Supported initial fast paths

| Question | Workflow | Supported period |
|---|---|---|
| Overall diesel gallons/adjusted spend | `diesel_totals` | Last full Tuesday–Monday week |
| Current fleet count | `fleet_count` | Current state |
| Trucks on the road | `on_road_count` | Today in America/New_York |
| Overall outside/on-road repair cost | `outside_repair_totals` | Last full Tuesday–Monday week |
| Returning-truck count | `returning_trucks` | This or last full Tuesday–Monday week; required two-source union |
| Departing-truck count | `departing_trucks` | This or last full Monday–Sunday week; governed live departure aggregate |

Explicit dates, vehicle/owner/dispatch filters, sensitive requests, lists, forecasts, trends, comparisons, financial settlements, multiple tasks, missing periods, and uncertain routing fall back to normal governed reasoning. This narrow rollout does not remove support for those questions from the existing reporting client.

Monday is still part of the current operational week: “last full week” ends on the previous Monday, not the Monday currently in progress. Dates, sums, coverage, truck-key normalization, and unions are code-owned, not Jev predictions. Fuel uses the live-verified exact product identities `Premium Diesel #2` (diesel) and `DEF (bulk)` (DEF), confirmed through a complete approved-gateway read. Metadata does not enumerate product values, so evidence must not claim it does. Unknown/null/new labels trigger fallback rather than guessing identity from the word diesel, counting additives/oil, or silently excluding a possible diesel purchase. Additional product identities require a verified policy update.

## Invocation and runtime credentials

```bash
python "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/agent_reporting.py" ask \
  --question "How many gallons of diesel did we use last week?"
```

Inject `TYPESAFE_API_KEY` and `LIGHTNING_AGENT_REPORTING_KEY` at runtime. For an existing Hermes profile, explicitly opt in to reading its local credential file with `--env-file "${HERMES_HOME:-$HOME/.hermes}/.env"`. That loader reads only the reporting/Jev key variables, does not execute shell content, and does not change the file. Existing local aliases `TYPESAFE_JEV_API` and `AGENT_API_KEY` map to the standard runtime names only when those names are absent. Never supply key values as command arguments, URLs, prompts, logs or repository files. Nothing loads `.env` implicitly on the ordinary query path.

The compact JSON result has either:
- `status=complete`: verified metrics, period, source/filter/completeness/freshness evidence, material caveats, deterministic English/Spanish answer, pinned routing model/usage and measured timings; or
- `status=fallback`, `answer=null`: continue the existing reporting/reasoning workflow. A fallback is not a zero result. It does not automatically launch another model, rotate keys, retry Jev or alter permissions.

Use a complete answer without re-running the same analysis in a large model. Preserve the evidence and caveats; format it for the user if necessary. Fall back once when needed; do not loop through `ask` with reworded questions until a desired decision appears.

## Safety and gating

Pin `jev-1.13.0`. Independent routing questions run in one request; none depends on another answer. Choice confidence must be at least 0.90 and its selected probability at least 0.95; the simple-request Noul must be at least 0.90. These are conservative pilot thresholds, not a guarantee of correctness. All chosen enums, distributions, response types and the pinned model are validated. A narrow deterministic vocabulary/scope eligibility guard rejects unfamiliar words, sensitive/identifier/scope patterns and subclass qualifiers locally before external evaluation. Jev confidence cannot override this guard. Unfamiliar wording may safely fall back even when its question would otherwise be supportable.

Both Jev and reporting-helper HTTP redirects are refused so credentials cannot be forwarded to another URL. Jev transport runs in a short-lived isolated worker with only its own key and a two-second parent deadline; a timeout kills/reaps the worker, covering DNS/connection/headers as well as slow-trickle bodies. Response bytes are capped and errors are sanitized. Missing keys, timeout, rate limits, overload or schema changes fall back without retries. Full report retrieval continues to use the existing exact-count/identity/cursor validation. Unknown gateway schema versions, incomplete sources, denied permissions, malformed rows and incompatible metadata are never presented as complete totals. The API remains the source of truth for access; Jev confidence never grants authorization.

Numeric metrics use decimal arithmetic and explicitly account for null values. Diesel adjusted spend never substitutes unadjusted SubTotal; eligible gallons control weighted price. Outside repairs include truckless rows only in overall totals and never add cost components twice. Fleet counting never removes settlement allocation buckets by applying settlement-only rules to the truck master. Returns retain the required exclusions, team/solo formula, distinct two-source union and reconciliation. Departures retain source-failure/null-total evidence.

## Verified rollout measurements

After scope/product/deadline hardening, 12 fresh live English/Spanish questions (two per workflow) returned complete answers; independently calculated counts, sums and reconciliation matched the source rows. Median question-to-verified-answer time was **1.8626 seconds**, including current catalog, selected metadata, full reporting retrieval, exact computation and templates. Median Jev routing time including the isolated-worker overhead was **0.4174 seconds**. These are observations from this host, not guarantees or a measured speedup over the current reasoning model.

A separate 30-question held-out routing probe had **5 accepted routes, all correct**, and **25 safe fallbacks**. Four fallbacks were otherwise-supportable wording/confidence variants; the conservative guard intentionally prioritizes correctness over coverage. No scoped request was accepted in that final run. Earlier broad-model-only scoping and substring product checks were not published; regression tests now reject those failure modes deterministically.

**140 targeted tests passed**: 22 Jev tests, 27 helper tests, 19 deterministic workflow tests, 9 Python contract/document tests, 11 MCP tests, and 52 unchanged API/function contract tests. Timeout tests cover DNS/connection stalls, stalled/trickled headers, stalled/trickled bodies, and killed/reaped workers; redirect tests verify no credential forwarding. Three unrelated dashboard assertions still fail on the pre-existing baseline; the entire repository suite is not claimed green.

## Evaluation

Live Jev pilot questions must include English, Spanish, scoping traps, missing dates, financial requests, multiple intents, lists and ambiguous requests. Report accepted-route errors and safe fallbacks separately; a low acceptance rate is not evidence of useful speed. Measure full source retrieval and answer assembly as well as routing. The fast path removes planning/text-generation work only when the caller consumes its verified answer directly; adding Jev before the same full reasoning loop would add latency.

No comparison against the current large reasoning model is implied by Jev request timings. Any claimed end-to-end speedup must use equivalent questions, fresh evidence, complete totals and an actual baseline. Source `as_of` remains request time, not upstream sync freshness.

References: [TypeSafe API](https://docs.typesafe.ai/api), [System One](https://docs.typesafe.ai/concepts/system-one), [known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
