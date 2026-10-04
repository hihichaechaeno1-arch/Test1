# YouTube importer: 850 write failures

Incident: [GitHub run 37210961443](https://github.com/hihichaechaeno1-arch/Test1/actions/runs/37210961443), manual execution on 2026-10-04 at commit `fecf14c`. The owner committed/pushed the previous repairs and ran ingestion. The importer repair described below is a new local, uncommitted change; the agent did not rerun live ingestion or modify the database.

## What the run actually says

Read-only retrieval and aggregation of the action logs established:

| Outcome | Count |
| --- | ---: |
| Failed INSERT operations | 847 |
| Failed UPDATE operations | 3 |
| Failed lookups, YouTube searches, or metadata validation events | 0 |
| Items rejected/skipped by the importer | 305 |
| Successful inserts / updates | 0 / 0 |
| YouTube request attempts | 28 |
| Channels with no continuation token | 9 |
| Channels left bounded/incomplete | 4 |

The importer deliberately exits 1 whenever `summary.failed > 0`. This is correct failure reporting, not a GitHub scheduling or Node runtime problem. Do not fix it by suppressing the exit code.

`channel-finished` and `complete: true` mean that the search API returned no continuation token for that channel/query. They do **not** assert successful database writes or complete historical archive coverage. A very old `oldestPublishedAt` is metadata from the search response, not an exception. The four incomplete channels are a separate page-bound/coverage issue, not the cause of 850 database failures.

## Diagnosis and its limits

The leading cause is the previously established absent `videos.description` column:

- Both insert and update payloads always included `description` in the deployed importer.
- The public database used by the browser still rejects `select=id,description` with HTTP 400 / PostgreSQL `42703`.
- A current read-only request for required legacy fields succeeds with HTTP 200.
- Real-SDK fixtures reproducing an absent description column produce the same all-write-failure pattern; compatibility tests failed before the repair.

However, the old `database-failed` events deliberately omitted both provider messages **and error codes**. Those logs cannot conclusively prove that all 850 writes failed for this column, nor rule out an additional default, constraint, permission, or importer-target difference. No privileged credential values were retrieved and no production write was attempted to diagnose the issue. The new sanitized code diagnostics make a subsequent run actionable without exposing raw errors.

## Local repair

`scripts/fetch-youtube.cjs` now handles an absent optional description column for writes:

1. Keep the full payload normally; supported descriptions continue to be stored.
2. Recognize only `PGRST204` naming the `description` column of `videos` in the schema cache, or `42703` with the recognized missing-description SQL message.
3. Retry that rejected statement once with only `description` removed. A missing-column statement did not successfully mutate a row, so this is not a retry after an ambiguous network outcome.
4. Reuse reduced payloads for subsequent items/pages/channels in this run, avoiding hundreds of repeated schema errors.
5. Emit one `schema-compatibility` warning and include `metadataOmissions: ["description"]` in the summary. Description text still contributes to group filtering and member inference, but is not persisted when omitted.
6. Preserve canonical URL identity, lookup checks, editorial tags on refresh, exact update counts, and confirmed unique-race handling.
7. Continue failing on required fields, permissions, constraints, retry failure, zero-row updates, and unrelated errors.
8. Retain standardized database `code` plus a fixed `reason` in `database-failed`; never log raw database messages, credentials, SDK URLs, or row values.

No automatic migration, guessed schema, relaxed policy, service-key exposure, or false-success exit was introduced. A reviewed schema change is still appropriate if storing descriptions is required; compatibility alone does not establish complete database readiness.

## Regression evidence

`node --import tsx --test tests/youtubeSync.test.ts` failed on the original importer: missing-description insert/update fixtures had `failed: 2` instead of zero, and no retry occurred. It now passes.

Eight added importer tests cover:

- Real-SDK missing-column inserts and updates, one retry, and subsequent compatible writes.
- Normal description retention and explicit omission reporting.
- Failed retries with sanitized permission codes.
- Missing required columns and permissions never triggering fallback.
- Zero-row updates never reporting success.
- Unrecognized codes/messages never leaking.
- A paginated fixture matching the incident's **850 write candidates / 305 skips**: **847 inserts, 3 updates, 305 skips, zero failures**, with one compatibility warning and one rejected schema statement before 850 successful mocked writes. The fixture minimizes the incident to one channel and 24 pages; it is not a replay of private production row contents or the exact 13-channel search history.

All external writes in these tests are mocked. Validation: **51 tests**, TypeScript checking, production build, Node script syntax, documentation links, and whitespace checks passed on local Node 26.3.0. No successful live ingestion is claimed.

## Apply and verify

1. Review, commit, and push this newer importer repair. Merely rerunning commit `fecf14c` repeats its old write behavior.
2. After owner/staging review, run the workflow and inspect the actual write counts and `metadataOmissions`.
3. If description is missing, expect a compatibility warning rather than a failure for every row. If other failures remain, use `database-failed.code` and `reason` to distinguish schema, permission, not-null, check, or unique-constraint problems. Do not publish raw SDK/provider messages.
4. Validate actual stored metadata and frontend reads. Keep required identity/default/uniqueness/security checks in the release process.
5. Adding the description column through a reviewed migration restores full payloads automatically on the next run; compatibility state is not persisted across runs.

No agent memory or skill changes were written.
