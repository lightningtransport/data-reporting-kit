# Departures and Out Schedule — schema 3.8.0

## Business rule and routing

Owner-approved departure totals reconcile **DriverPay + live Ninox Schedule_Teams** using the same inclusive `Out Date` frame. DriverPay uses `Truck_Number`; Schedule_Teams uses `Truck`. Normalize only vehicle-key type/format (trim whitespace; canonicalize numeric keys), remove blank keys, and deduplicate each source and the union. Never add source counts or count driver/assignment rows. Do not apply `Termination`/`Transfer` return exclusions or `floor(tc / 2 + ts)` to departures; those rules belong exclusively to returning-trucks reports.

The exact live Schedule_Teams source is:
`https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240`

It is volatile planned state, not a historical ledger; fetch immediately before reporting. The shared JSON is not a new Supabase physical table and does not change the seven-table/125-column dictionary count. A planned row is not evidence of an actual departure.

## Prepared gateway reports (confirm deployment before use)

- `out_schedule`: planned Schedule_Teams list with allowlisted projection, bounded live fetch and normal gateway authorization/audit. It is not the complete leaving-trucks total.
- `departures`: server-side two-source distinct-truck reconciliation. Its aggregate evidence must survive every helper/MCP wrapper unchanged.
- `out_from` and `out_to` are optional but must be supplied together as valid `YYYY-MM-DD` dates, ordered and at most **31 inclusive days**. Omit both for the current **Monday–Sunday** week in **America/New_York**. Do not use the Tuesday–Monday settlement cycle.
- Reject return-date/on-road/termination/transfer/solo and other undocumented filters. Metadata requests accept only `report` and `metadata=true`.
- Never expose source credentials. Sensitive planned driver/team labels require explicit `include_sensitive=true` and principal authorization; omit internal driver database identifiers and unallowlisted source fields.

### Aggregate evidence

`period` contains `out_from`, `out_to`, `time_zone`.
`status` is `complete` or `incomplete`; `complete` means both sources were fetched completely, **not** merely that a page ended.

`reconciliation` contains:
- `driver_pay_count`
- `schedule_teams_count`
- `driver_pay_only_count`
- `schedule_teams_only_count`
- `overlap_count`
- `combined_distinct_total`

`truck_sets` contains `driver_pay`, `schedule_teams`, `driver_pay_only`, `schedule_teams_only`, `overlap`, `combined`.

For complete sources, the combined distinct total is the size of the union, equivalently source counts minus overlap. That is a reconciliation check, not permission to add raw counts. On any source failure, preserve available source evidence but return `complete=false`, `status=incomplete`, and **null** `combined_distinct_total`/combined set (also null cross-source overlap/source-only evidence). Never turn a failed source into an empty successful source, claim zero departures, or substitute a partial source total.

Source failure returns HTTP **503** with this structured incomplete envelope; audit failure remains a sanitized **500**, not a usable report. Clients must retain the 503 evidence rather than discarding it or rewriting completeness.

`out_schedule` intentionally omits persistent/internal row IDs and allows duplicate rows. The packaged helper requests one bounded snapshot (default limit 1000), preserves ID-less duplicates and source `complete`/`status`, and fails closed if a full-list request exceeds one page; `--one-page` explicitly permits a partial page. Do not invent a stable identity from truck/date or pagination position. Source `complete=true` does not mean a caller has fetched all rows: inspect `has_more`/counts separately. MCP `run_report` returns one gateway page unchanged; multi-request planned snapshots are volatile and cannot be represented as an identity-verified complete historical list.

`count`, `page_count`, `total_count`, and `data` (when present) are transport/row evidence, not a substitute for `reconciliation.combined_distinct_total`. Do not infer source completeness from `has_more=false`.

## Gateway deployment evidence

On **2026-10-06**, `agent-reporting` schema **3.8.0**, Edge Function version **122**, was deployed and read back byte-for-byte against the source. Live catalog/metadata, default-week and explicit-date requests, empty results, rejected return filters, non-sensitive schedule projection, and OpenAPI response validation were verified. The live aggregate truck sets were independently reconciled against fully paginated DriverPay and a newly downloaded exact Ninox share. This proves the gateway path, not installed client-chat integration; the client limitation below remains.

## Client rollout — still not integrated until verified

The gateway evidence above does **not** prove that installed clients support either new report. This repository provides the packaged helper and ChatGPT MCP replacement path. The installed local MCP runtime at `~/.stackchan/gateway/lightning_reporting_mcp.py` currently hardcodes eight reports and uses a cached canonical helper. It has not been modified by this repository change. Keep the **not integrated** limitation until deployment and installed-client verification succeed.

Required operator steps (no runtime change is authorized by this document alone):
1. Deploy/verify gateway schema 3.8.0, authorization, audit, exact source URL, metadata and both report entries for the intended principal. An explicit report-restricted principal must allow `departures`, `driver_pay` and `out_schedule` to run the union; allowing the aggregate alone is not permission to read both inputs. Verify success, empty success and failed-source/null-total behavior without storing operational rows in the repository. Re-download the volatile share for the verification period; compare the actual sets rather than hardcoding row or truck counts from an earlier fetch.
2. Publish and synchronize the approved canonical skill/helper revision into the active installed profile/cache. Confirm helper CLI accepts both reports and retains `reconciliation`, `truck_sets`, `period`, `status`, `complete` on successful and incomplete aggregates.
3. Update the installed `~/.stackchan/gateway/lightning_reporting_mcp.py` hardcoded `REPORTS` allowlist from eight reports to include `out_schedule` and `departures`, report-specific filter validation, descriptions and cached helper reference to that verified revision; restart/reload the gateway and MCP client. Locate any separate client-model limitation before editing it (its location is not yet verified); do not assume repository instructions replace installed client policy. Do not modify other profiles as a shortcut.
4. Rebuild/redeploy the remote ChatGPT MCP package if used; refresh its canonical knowledge and tool instructions. Confirm OAuth and dedicated principal controls remain in place.
5. Through each actual installed client, read catalog/metadata and run a paired-date/default-week planned-list and combined-departures request. Verify equal Out Date bounds on both sources, union reconciliation, source-failure completeness preservation and unsupported return-filter rejection.
6. Only then replace “not integrated” with verified integration evidence (revision, deployed schema, client identity and verification timestamp). Until then disclose the limitation and, if authorized, use the approved manual two-source reconciliation rather than a DriverPay-only answer.

See [API guide](agent-reporting.md), [OpenAPI](../api/openapi.yaml), [agent rules](agent-rules.md), and [ChatGPT deployment](chatgpt-plugin.md).
