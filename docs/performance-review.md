# Reporting performance review — 2026-10-06

## Scope and compatibility

Compare canonical `main` revision `22f55b3ec515bb8abfa2eb999792681772c40148` with production `agent-reporting` version 122/schema 3.8.0 before editing: all four deployed source files were byte-identical. Changes are limited to additive catalog discovery and the portable helper's complete-collection page size. No database migration, authorization/control change, data cache, query projection change, calculation change, or audit deferral is required.

Schema 3.8.1 adds `report=catalog&compact=true`. Default discovery remains full. Compact discovery preserves the permission-filtered report list (including composite dependency authorization), global business guardrails, response/freshness semantics, exact filters, required anchors, and metadata links. It explicitly requires full selected-report metadata for unfamiliar fields/calculations. Data and metadata requests reject `compact`.

Portable skill 0.10.1 requests `limit=1000` for complete stable-ID collection unless explicitly overridden. The API's default page size and `--one-page` default remain 100. Exact totals, unique row identities, safe cursor progression, normalized filters, and final reconciliation remain enforced. Volatile ID-less Out Schedule still uses one live snapshot; departure aggregate source completeness is preserved unchanged.

## Measured bottleneck

Authenticated September 2026 fuel queries returned the identical ordered **5008 rows** with both page sizes:

| Existing page size | Requests | End-to-end request time |
|---|---:|---:|
| 100 | 51 | 28.3013 seconds |
| 1000 | 6 | 3.4000 seconds |

These are observations from this host, not guaranteed latency or isolated server processing time. Per-page exact counts and mandatory successful audit inserts are retained; fewer pages means fewer of both without weakening correctness.

The initial full catalog response was 45,713 uncompressed JSON bytes. Compact discovery avoids loading every field dictionary and per-report calculation into the model when only one report is needed. It does not replace report metadata or business guidance.

A read-only `EXPLAIN (ANALYZE, BUFFERS)` of the equivalent September fuel date/order/1000-row ID projection executed in 9.525 ms, using a sequential scan and top-N sort. This is not the complete PostgREST query with every field/count/audit. It supports prioritizing network round trips over speculative database changes. Existing fuel indexes cover primary key and Ninox identity, not `(Store Date,id)`; a date/order index is a possible separately benchmarked follow-up, not part of this rollout.

## Post-deployment verification

Production version **123**, schema **3.8.1**: all four downloaded deployed files match the committed source byte-for-byte; custom-key authentication remains enabled with platform JWT verification disabled as before.

Live default responses for all eight stable-ID reports plus full catalog and fuel metadata match their pre-change payloads, excluding only schema version, request timestamp, and request ID. All ten full report metadata dictionaries remain identical to the full catalog entries. Legacy response shape and direct/API one-page defaults are preserved. Live Out Schedule and Departures responses are complete and validate against OpenAPI; synthetic source-failure tests remain separate from these live successes.

| Post-deployment test | Existing mode | Optimized mode |
|---|---:|---:|
| Full September fuel helper collection | 51 requests / 26.9416 s | 6 requests / 3.5674 s |
| Catalog JSON payload | 45,713 bytes | 15,057 bytes |
| Catalog median request time (7 samples per mode) | 0.2903 s | 0.2375 s |

The fuel helper returns identical ordered rows with exact total 5008 and `complete=true` in both modes. Observed speedup is 7.55×; catalog payload reduction is 67.06%. Results are measurements, not guarantees of model answer time or isolated server latency.

**97 targeted tests pass:** 52 Deno function/contract tests, 25 portable-helper tests, 9 Python contract/document tests, and 11 MCP tests. Three pre-existing unrelated dashboard assertions remain as documented below; do not claim the entire repository test suite is green.

## Verification boundaries and deferred findings

- No business rows or credentials are included in this repository. Live comparison snapshots are local mode-0600 scratch files.
- Handler tests cover compact/full/default-false discovery, authorization, expired credentials, empty allowlists, composite input permissions, invalid/duplicate parameters, preserved global guardrails, and rejection of compact on all data/metadata paths. Existing source failure/audit fail-closed tests remain active.
- The helper/MCP/contract suites exercise exact counts, short pages, identity casings, replay/count drift, incomplete sources, and one-page behavior.
- Three dashboard text/layout assertion failures reproduce on unchanged baseline `22f55b3`; dashboard code is not altered to silence unrelated tests. An existing outside-repairs test's overly broad TypeScript cast is narrowed to its actual report literal, preserving the test's coverage and enabling type-checking.
- The original rollout left MCP catalog tooling requesting full discovery. The subsequent client skill 0.11.2 change makes the canonical ChatGPT MCP catalog compact-first with explicit `compact=false` full opt-in; it does not automatically update installed wrappers. Hermes wrappers must request compact at the HTTP layer before the output size guard, without disabling/raising that guard. Selected metadata remains required for unfamiliar fields/calculations. The MCP report tool still retrieves one page; it is not a complete collector. Update/restart and verify the actual installed client separately.
- The existing urllib clients follow redirects and can retain `x-agent-key` across origins. Redirect rejection merits a separate security-focused patch with transport regressions; it is not changed as a speculative performance optimization.
- Same-count source replacements are not a snapshot guarantee. Larger pages reduce round trips but do not establish source-sync freshness.
- Live schemas contain additional unexposed import columns beyond the documented API projection; this rollout does not silently expose them or change the reporting field dictionary.
