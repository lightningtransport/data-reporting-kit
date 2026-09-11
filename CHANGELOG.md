# Changelog

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
