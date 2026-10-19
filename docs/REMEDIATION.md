# Remediation status

**Current working-tree repair:** regressions at `2b61799` and the supplied Vercel TypeScript failure have been repaired locally. See [repair validation](REPAIR_VALIDATION.md) for the current contracts, 70-test/clean-install/build/browser evidence, deployment checklist, and explicit remaining risks. No deployment, migration, or real ingestion was performed. The 51-finding [current-review baseline](COMPREHENSIVE_REVIEW.md) is preserved as pre-repair evidence, not a claim that all findings remain open or are now closed.

The table below tracks the earlier 15-issue remediation lineage. Historical commit/uncommitted-state assertions in older incident reports apply only to their recorded inspections.

## Issue-by-issue progress

| Issue | Status | Applied solution / remaining requirement |
| --- | --- | --- |
| R1: playback/thumbnail contract | Implemented locally; live validation pending | Explicit adapter accepts importer `url`/`thumbnail` and canonical fields. Valid YouTube hosts/IDs are required. Importer saves snippet description when supported; the newer compatibility repair explicitly omits it after a confirmed missing-column rejection. Owner must verify required fields and the staging round-trip; add `description` through review if full retention is required. |
| R2: type error / build gate | Resolved locally | Card reads declared `thumbnailUrl`. Build runs type-check first; quality workflow runs tests/build. |
| R3: inaccurate appearance claims | Resolved for new ingestion/UI; legacy cleanup pending | Boundary-aware Unicode alias matching; unknown stays empty. UI calls these unverified tags, not proven co-appearances. Existing tags are not overwritten; owner must review historical all-eight defaults. |
| R4: official source identity | Fail-closed code implemented; owner configuration pending | Removed guessed channel list/title matching. Importer requires `YOUTUBE_CHANNEL_IDS`; browser accepts an optional channel ID and does not label it officially verified. Owner must verify IDs. |
| R5: silent ingestion failures | Resolved locally | Checked lookup/insert/update failures, structured summaries, sanitized logs, timeouts, bounded retries, nonzero failure exit. |
| R6: misleading full-history claim | Partial | Recent/backfill modes, explicit windows, page/request budgets, continuation token and completeness reporting. Backfill can be manually resumed. Search API coverage is still bounded; no automatic persistent checkpoint or exhaustive historical guarantee. |
| R7: URL identity / races | Partial; database work blocked | New and refreshed URLs use stable `watch?v=` identity; legacy Shorts lookup supported. Confirmed unique conflicts are handled, unconfirmed conflicts fail. Workflow writers serialize. Owner must inspect duplicates and apply a reviewed stable-identity uniqueness constraint. |
| R8: dependency conflict | Resolved locally | Removed unused direct esbuild and unused packages, pinned retained versions/Bun, regenerated Bun lock, switched CI to frozen install. Clean npm diagnostic install passes without peer bypass. |
| R9: paging/public projection | Resolved locally | Explicit legacy/canonical column allowlists; deterministic paging advances by actual returned length, even with smaller server caps. Errors reject partial results. |
| R10: deceptive fallback/status | Resolved locally | Missing credentials select labeled demo. Empty live response stays empty; failures show errors. Demo cards have no playback links. All states have visible source messaging and reload controls. |
| R11: permissive mapper | Resolved locally | `unknown` boundary, canonical/deduplicated names, stable IDs, valid date/format/YouTube identity, no fictional dates/durations, aligned category types. Invalid required metadata causes a visible load error. |
| R12: accessibility | Code implemented; broader user QA pending | Search label, toggle/format `aria-pressed`, global visible focus, live status/error/busy semantics. Keyboard/member flows tested in Chromium; screen-reader audit remains manual. |
| R13: image cost/failure loop | Implemented; performance targets pending | Lazy/async images, bounded local placeholder after failure, WebP derivatives. Bundled image bytes fall from ~3.33 MB to ~0.320 MB (about 90%). Originals preserved. Full device/network performance target remains owner-defined. |
| R14: misleading metadata/dependencies | Resolved locally | Removed unused server/AI/animation packages and Gemini capability claim; active metadata describes tagged-video search. Dormant components retained intentionally and documented. Generic YouTube link no longer claims official status. |
| R15: licensing/provenance/schema | Blocked on owner evidence | Added [content register](CONTENT_PROVENANCE.md), operational checklist, quality CI, and explicit import enable gate. No license text, channel ownership, live RLS, grants, uniqueness, or backup guarantee was invented. |

## Original remediation verification (historical)

- 27 repository regression tests pass through mapper, archive reader, component rendering, and importer interfaces; external services are mocked. Test files are currently uncommitted like the rest of the work.
- Type-check and production build pass.
- Frozen Bun 1.4.2 installation passes with lifecycle scripts disabled for local review.
- Clean temporary npm installation passes without `--legacy-peer-deps`.
- Chromium smoke checks pass for mobile demo selection/search/presets, non-playable demo cards, mocked live pagination, format/description filters, image failure, visible fetch failure, and retry. No page exceptions were observed.
- The browser checks were temporary review probes, not a checked-in Playwright suite.
- No real database/API operation, scheduled import, deployment, migration, commit, or push was executed.

## Required next owner actions

1. Inspect the actual `videos` schema, RLS/grants, ID default, duplicates, and uniqueness. The current importer requires legacy identity/metadata fields and metadata UPDATE permission, and can explicitly omit an absent optional `description` column; the frontend defaults to the legacy projection.
2. Reconcile legacy duplicates and implement a verified stable video identity constraint through a reviewed migration. Do not apply an invented schema over an unknown live table.
3. Verify channel IDs, set GitHub variable `YOUTUBE_CHANNEL_IDS`, then set `ENABLE_YOUTUBE_SYNC=true` only after staging validation. Ingestion remains disabled by default.
4. Audit/correct historical member tags; new boundary matching does not repair already stored tags automatically.
5. Confirm license/content rights and record source evidence before public redistribution.
6. Define required history coverage, checkpoint strategy, freshness, and performance targets. Use bounded backfill only as documented until then.
