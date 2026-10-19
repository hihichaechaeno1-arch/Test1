# Vercel build repair and validation

## Scope and root cause

Repairs apply to the working tree based on `2b61799`. No commit, push, deployment, production configuration change, migration, or real ingestion was performed.

The supplied Vercel log confirms failure during `bun run build` → TypeScript checking. Local reproduction found **94 TypeScript errors**, missing exports, and incompatible UI/domain/reader contracts. Independently bypassing TypeScript still produced five bundler missing-export errors. A separate frozen-install reproduction failed because `bun.lock` disagreed with the manifest.

These are repository defects, not evidence of a Vercel outage or DNS failure. The historical missing-`description` runtime incident is separate.

## Implemented repairs

### Contracts and browser behavior

- Restored a concrete `Member`/`VideoItem` model with `accentColor`, validated `youtubeId`, demo markers, and supported metadata. Strict TypeScript checking is explicit; no checks/tests were excluded.
- Standardized UI modes (`including`, `only`; retained `AND`/`OR` for the dormant recommendation interface) and sorting (`new`, `old`, `popular`). Oldest genuinely sorts ascending; unknown dates sort last.
- Restored all required reader/classifier/category exports and removed obsolete imports rather than adding incompatible aliases.
- Shared dependency-free inference in `src/lib/videoMetadata.cjs` is used by browser mapping and the Node importer. It defines five content genres: `mv`, `shorts`, `stage`, `original`, `other`.
- Categories do not certify source ownership. Display names/group hashtags do not make an unclassified video a Short. Explicit Shorts URLs/metadata and text keywords are still heuristic content/format evidence, not aspect-ratio or appearance verification.
- Legacy `url`/`thumbnail` and canonical `youtube_id`/`thumbnail_url` map to the same validated playback model. Previously imported genre-like `type` values are accepted and normalized to `video`/`shorts`.
- Stored member tags are authoritative, including an explicit empty list. Missing tags remain unknown; title guesses never overwrite them. Importer inference uses title and description together, with Unicode-aware aliases and no unknown→all-eight default.
- Exact supported YouTube hosts/IDs are required; inherited object keys cannot become member aliases. Invalid rows/dates/identity fail visibly, and unknown dates/channels/views are not fabricated.
- Restored paginated allowlisted archive reads with stable ordering, server-cap/count handling, cancellation, and a 30-second overall read timeout. Browser cancellation no longer depends on `AbortSignal.any`/`timeout` support.
- Only an initial exact missing-description error permits a bounded read retry. Permissions, required-column errors, malformed rows, and mid-read schema failures still reject.
- Live failures/empty responses do not become sample data. Demo is explicit and nonplayable. Error state no longer also displays ordinary no-match advice.
- Reduced repeated category-count classification to one pass. Popularity is disabled when the loaded dataset has no usable view counts; the importer still does not fetch analytics.
- Removed unsupported active official/co-appearance/aspect-ratio claims. Content and tag inference are not represented as verification.

### Importer and workflows

- Restored dependency-free preflight and explicit approval before both workflow ingestion and direct CLI execution. `ENABLE_YOUTUBE_SYNC` must be exactly `true`.
- Required explicit HTTPS database target, privileged-key setting, and approved channel-ID allowlist. Removed hardcoded target, anonymous-key fallbacks, handle resolution, and unconditional curated-playlist ingestion.
- Restored bounded approved-channel search. The former `full_backfill`/`incremental` workflow choices are intentionally removed: scheduled/manual workflow runs are bounded `recent` scans. They do not promise full history or curated-playlist coverage. Explicit bounded backfill/resume remains a trusted CLI operation.
- Every accepted source snippet must have the requested channel ID and valid video metadata.
- Canonical watch URLs identify both formats; legacy Shorts URLs are recognized. Existing editorial tags are not overwritten, and generic refresh cannot erase stored Shorts evidence.
- Source metadata refresh checks update errors and affected-row count. Failed lookups never proceed to insert. Only exact absent-description write errors permit one compatibility retry; permission/constraint failures remain failures.
- Structured sanitized failure/completeness summaries, request budgets (including retries), timeout-bounded requests, and nonzero failure/backfill-incomplete exits are restored.
- Both workflows use Node 22 and Bun 1.4.2 with frozen installation. Ingestion has read-only workflow-token permissions, a 20-minute job limit, and writer serialization.

### Deployment and dependencies

- Regenerated `bun.lock` from the existing pinned manifest; no application dependency was added or upgraded. Obsolete direct dependencies are no longer in the workspace lock.
- Build runs `tsc --noEmit && vite build`; it does not require nested npm execution.
- Added `vercel.json`: framework `vite`, install `bun install --frozen-lockfile`, build `bun run build`, output `dist`.
- Added deployment/lock contract tests and additional data, playback, approval, isolated-preflight, and Shorts-preservation regressions.
- Updated the obsolete four-group tests to the existing five-category product model. Removed unsafe expectations that an official-looking name/group hashtag alone proves Shorts. Existing playback, validation, paging, error, editorial-tag, and nonplayable-demo safety assertions remain.

## Verification evidence

### Before repair

| Check | Result |
| --- | --- |
| `npm run build` | Failed: 94 TypeScript errors. |
| `npm test` | 2 pass / 32 fail runner entries; three test files failed to load. |
| Vite-only production build | Failed: five missing-export errors. |
| Bun 1.4.2 frozen installation | Failed: lockfile would change. |

### After repair

| Check | Result |
| --- | --- |
| Full Node regression suite | **70 tests pass**; all test files load. |
| Explicit strict TypeScript / normal `lint` | Pass. |
| Type-gated production build | Pass; static assets emitted to `dist`. |
| Clean isolated frozen installation, tests, and build | Pass on macOS with **Node 22.23.3 / Bun 1.4.2**, normal install lifecycle behavior. Revalidated after final source changes. |
| Checked-in Chrome smoke runner | Pass: mobile 390×844 and desktop 1440×1000; zero page exceptions. |
| `git diff --check`, JavaScript syntax, documentation checks | Pass. |

Bun and Node 22 were provisioned as temporary command-line tools through npm exec, not added to application dependencies. The Chrome runner uses optional Playwright 1.58.2 provisioned the same way. Docker/Linux validation was attempted but the local Docker daemon is unavailable; actual Linux CI/Vercel execution remains an external release check.

The browser runner builds isolated demo/public-fixture bundles in a temporary directory. It intercepts fixture Supabase HTTP and blocks other nonlocal traffic. Covered flows: demo nonplayability, member including/only, presets/search, real link identities, oldest sort, missing-count popularity disabling, server-cap pagination, optional-column retry, visible permission errors without fallback, explicit demo switching, empty live results, invalid identity rejection, retry recovery, description search, and mobile/desktop overflow. It does not play a real YouTube video or validate live policies.

### Re-run

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
git diff --check

# Optional browser tool; requires installed Google Chrome.
npm exec --yes --package=playwright@1.58.2 -- node scripts/browser-smoke.cjs
```

Set `CHROME_EXECUTABLE` to an installed Chrome/Chromium binary if needed. The smoke runner leaves project `dist` untouched and removes its own temporary artifacts. Tool provisioning requires registry access; provider traffic is mocked/blocked during the tests.

## Vercel release checklist

1. Review/commit/push these repairs through the owner's process. They are not present in production merely because local checks passed.
2. Use repository root as Vercel Root Directory; select the repaired branch/commit and Node **22.x**. Keep the checked-in Vite/frozen-install/build/`dist` settings; do not bypass TypeScript.
3. Configure only public browser values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `NEXT_PUBLIC_VIDEO_ROW_FORMAT=legacy|canonical`, optional header channel ID. Blank Supabase values deliberately select demo. Never supply privileged importer keys under public prefixes.
4. Create a new deployment. Public environment changes require rebuilding, not just restarting.
5. Verify deployment SHA, install/build logs, assets, source status, live reads, intended playback links, and member/category/search/sort flows. No migration is required just to resolve the compile failure.
6. Keep ingestion disabled until actual schema/RLS/grants/defaults/uniqueness, channel approval, backups, and a controlled staging round trip are verified. Existing remote flag values were not inspected or changed here.

## Remaining risks / deliberately deferred work

This repair is **not closure of all 51 findings** in the [baseline review](COMPREHENSIVE_REVIEW.md). In particular:

- Actual Linux CI/Vercel deployment, database policies/schema/defaults/constraints, credentials, source availability, project quotas, and staging writes are unverified.
- Workflow serialization and URL lookup do not replace stable database identity uniqueness. Historical duplicates, overwritten tags, or misclassified rows need reviewed cleanup; no destructive cleanup was attempted.
- Search remains bounded and query-dependent, not exhaustive playlist/history ingestion or persistent automatic checkpointing. Existing Shorts evidence is conservatively retained and may require editorial correction.
- Content classification/format inference is heuristic. No verified source/appearance provenance schema, view-statistics sync, or deleted-video reconciliation is implemented.
- Large-archive client memory/rendering performance, full keyboard/screen-reader/contrast audit, reduced-motion handling, dormant modal/recommendation accessibility, React error-boundary recovery, privacy/legal/content rights, security headers, dependency vulnerability audit, immutable action pins, monitoring/alerts, and restore/rollback operations remain separate work.
- The optional browser smoke runner is rerunnable but not automatically run by the quality workflow; broader browser/device coverage is still needed.

No agent memory or skill proposal was written.
