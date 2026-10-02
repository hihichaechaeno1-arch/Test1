# Original project review and analysis

> **Historical baseline:** findings below describe commit `d93b74b1035af155e08902877b8cc046c14649b9` before source repairs. They are preserved as review evidence, not presented as current unresolved code defects. See [Remediation status](REMEDIATION.md) for issue-by-issue fixes and remaining external blockers.

## Executive assessment at baseline

The project has a small, understandable frontend and a separate importer, with controlled member selection, explicit AND semantics, reusable card/selector components, and a practical sample fallback. The main operational boundaries are visible and inexpensive to test.

However, the checked-in importer and frontend do not agree on playback/thumbnail fields, the type check fails, and automated tags do not establish the co-appearance guarantee suggested by the UI. Ingestion failures can also look successful. **Resolve these before treating the site as a verified live archive.**

The original review changed documentation only. Subsequent owner-requested remediation changed source, dependencies, tests, workflow configuration, and documentation locally. No live database migration/import, commit, or push was performed.

## Review scope and evidence

Baseline: **`d93b74b1035af155e08902877b8cc046c14649b9`**, reviewed **2026-10-02**.

- Examined all tracked source, configuration, workflow, sample metadata, and asset references.
- Used a code knowledge graph plus direct source reads to establish runtime relationships.
- Reproduced installation/type/build behavior in temporary copies.
- Used mocked offline checks for mapper, member detection, pagination, and failure behavior.
- Served development and production-preview HTML for HTTP smoke checks.
- Consulted current Supabase security/key documentation and YouTube search API documentation.

No live database configuration, production data, deployment, GitHub secret, or channel identity was inspected. There is no originating issue/spec or documented local coding standard to compare against. See [validation details](DEVELOPMENT_TESTING.md).

Severity: **High** affects core functionality, data trust, or a required quality gate; **Medium** affects reliability, coverage, access, or maintainability; **Low** is a secondary improvement. No critical live security exploit is claimed.

## Findings

### R1 — High: importer/frontend contract loses video identity and thumbnails

**Evidence:** `scripts/fetch-youtube.cjs:138–146` inserts `url` and `thumbnail`; `src/lib/supabase.ts:77–78` reads different fields; `src/components/VideoCard.tsx:20` constructs a link from `youtubeId`.

**Impact:** a row written by the current importer maps to `youtubeId=''` and the bundled group thumbnail. Users can receive `https://www.youtube.com/watch?v=` instead of the intended video. The original `thumbnail` is discarded by the mapper, so reading it in the card cannot repair the mismatch. Description is read during discovery but never stored.

**Validation:** offline mapping of an importer-shaped record confirmed the empty identity, wrong fallback image, blank description, and default duration.

**Recommendation:** choose canonical fields and either change/backfill importer writes or build an explicit validated legacy adapter. Do not assume uncommitted live triggers bridge the gap.

**Acceptance:** a fresh staging import and a legacy row each map to valid intended YouTube links and thumbnails; both formats work; required description behavior is tested.

### R2 — High: current type-check command fails

**Evidence:** `src/components/VideoCard.tsx:32` reads `video.thumbnail`, but `VideoItem` declares only `thumbnailUrl` in `src/types.ts`. `package.json:11` runs `tsc --noEmit`.

**Impact:** the documented quality check fails. `vite build` still succeeds because it does not enforce type correctness, allowing the error through a build-only release process.

**Validation:** TS2551 reproduced under both npm-diagnostic and frozen Bun installations.

**Recommendation:** fix the field contract, not just an `any` cast; run type-checking and build as independent release gates.

**Acceptance:** a clean installation passes both commands without suppressing the error.

### R3 — High: heuristic tags contradict strict co-appearance messaging

**Evidence:** `scripts/fetch-youtube.cjs:47–56` uses substring detection and returns all eight members for unmatched nonempty text. `src/App.tsx:98` trusts those tags. The selector promises strict joint participation.

**Impact:** unknown videos become apparent full-group matches; incidental words create false member tags; description mentions are treated as actual appearances. An AND filter is logically correct over tags but cannot make inaccurate tags factual.

**Validation:** unlabeled text returned all eight; `piano solo` matched Ian; `banana` matched A-na.

**Recommendation:** preserve unknown status, use boundary-aware language rules, record tag provenance/confidence, and require editorial verification for appearance claims. Rename UI claims if only text-derived association is supported.

**Acceptance:** unknown metadata cannot populate verified full-group search; incidental aliases are rejected; verified and inferred tags are distinguishable.

### R4 — High: the main “official” source is not authenticated by channel identity

**Evidence:** `scripts/fetch-youtube.cjs:31–32, 72–76, 108–112` searches globally and accepts channel titles containing the group name rather than a verified channel ID.

**Impact:** a similarly named or impersonating channel can satisfy the title test. The code's “strict whitelist”/official-source description is stronger than its actual checks.

**Validation:** directly established from source; real channel ownership was not verified.

**Recommendation:** verify and pin the official channel ID; independently verify each configured broadcaster ID.

**Acceptance:** same-name unapproved channel fixtures are rejected; documented source identities have verified provenance.

### R5 — Medium: ingestion errors can produce a green-looking completion

**Evidence:** `scripts/fetch-youtube.cjs:132–150` ignores lookup errors and does not log insertion failures; per-channel exceptions/API errors are caught and converted to normal completion. `run()` has no aggregated failure policy.

**Impact:** a job can silently fail to write data or report completion when every channel failed. Operational checks based solely on the workflow result or final banner are misleading.

**Validation:** mocked lookup/insert failures returned zero without their error details; all mocked API failures still resolved `run()` with a completion banner.

**Recommendation:** distinguish lookup success, existing row, insertion success, and failure; report structured summaries; define a nonzero exit policy; add timeout/backoff where justified.

**Acceptance:** simulated database/API failures produce actionable logs and a defined failing status, while a legitimate no-new-content run remains successful.

### R6 — Medium: discovery is bounded recent search, not complete history synchronization

**Evidence:** `scripts/fetch-youtube.cjs:160` stops after three pages; all searches request newest-first and no cursor/checkpoint is saved. Existing rows are never updated.

**Impact:** older records can remain undiscovered; comments/logs claiming full history are inaccurate. Corrections, deletions, durations, views, and tagging changes are not synchronized.

**Validation:** mocked persistent `nextPageToken` still stopped after three pages.

**Recommendation:** document current bounds honestly; separate backfill from incremental discovery and choose a quota-aware cursor/source strategy. Define which metadata should be refreshed.

**Acceptance:** coverage bounds and freshness are visible; controlled fixtures verify the chosen backfill/incremental algorithm.

### R7 — Medium: duplicate prevention is URL-based and not race-safe

**Evidence:** `scripts/fetch-youtube.cjs:126–145` generates format-dependent URLs and performs separate lookup then insert operations.

**Impact:** changing classification can represent the same YouTube ID with two URLs. Concurrent runs may both see no existing row. Duplicate rows can also make `maybeSingle()` error, which the script ignores.

**Validation:** source establishes the race and identity mismatch; actual database uniqueness constraints are unknown.

**Recommendation:** use stable YouTube identity, database uniqueness, race-safe write semantics, and workflow concurrency controls as appropriate.

**Acceptance:** overlapping imports and format changes cannot create a second record for the same source video.

### R8 — Medium: npm installation has a direct dependency peer conflict

**Evidence:** `package.json:31` declares esbuild `^0.25.0`, locked to 0.25.12; locked Vite 8.3.2 requires optional peer `^0.27.0 || ^0.28.0` when present. The workflow installs with `--legacy-peer-deps` and ignores `bun.lock`.

**Impact:** a standard npm install can fail and CI dependency resolution is not lockfile-reproducible. Bypassing peer checks hides rather than resolves incompatibility.

**Validation:** exact direct-version npm installation failed with `ERESOLVE`. Diagnostic legacy-peer install and frozen Bun install succeeded; builds then succeeded with the separate type error still present.

**Recommendation:** standardize installation, remove/reconcile unnecessary direct build dependencies, pin supported tooling, and make CI use the chosen lockfile.

**Acceptance:** documented clean installation and CI work without unreviewed peer bypasses or lockfile drift.

### R9 — Medium: all-data frontend query has no pagination

**Evidence:** `src/App.tsx:36–51` requests `.select('*')` without `.range(...)`, a paging loop, or server-side filters.

**Impact:** records beyond the configured Data API response cap may never load, so local filtering can incorrectly claim no matching videos. Larger permitted responses increase payload and in-memory/rendering work. Selecting all fields also expands the public response if columns are later added.

**Validation:** source-level finding; the actual server cap and dataset size were not inspected.

**Recommendation:** define server/client pagination and public column selection; choose scalable filtering/search based on expected archive size.

**Acceptance:** matches beyond a test API cap remain discoverable, and private fields never enter the public response.

### R10 — Medium: fallback data and static status misrepresent live state

**Evidence:** `src/App.tsx:61,67` silently substitutes samples for empty/error responses; `src/App.tsx:156` always shows the same green connection label. `src/data/h2hData.ts` contains illustrative titles and reused unrelated YouTube IDs.

**Impact:** users can mistake invented sample content for a live curated archive. Empty policy-filtered responses also look like samples rather than a configuration problem. Successful database rows are sorted but fallback rows are not.

**Validation:** source plus offline sample-order check. No interactive browser assessment was performed.

**Recommendation:** show explicit live/sample/error source state, distinguish empty archives from failures, correct the badge, and label or replace demo metadata. Sort fallback intentionally.

**Acceptance:** users can identify data provenance and connection/freshness state in every fetch outcome; demo links are not presented as verified H2H content.

### R11 — Medium: mapper is permissive but not domain-validating

**Evidence:** `src/lib/supabase.ts:31–81` accepts `any`, uses casts for names, random IDs, hardcoded dates, and fallback category `'all'` outside `VideoItem.category`.

**Impact:** malformed types can survive into rendering/search; unknown/case-variant tags fail silently; missing IDs are unstable; invalid dates undermine sorting; made-up defaults conceal data-quality errors.

**Validation:** source-level contract analysis; supported member encodings/date truncation were also tested offline.

**Recommendation:** use a typed database row boundary plus runtime validation for external data, explicit unknowns, canonical names, stable identities, and aligned category definitions.

**Acceptance:** invalid rows cannot crash filtering or masquerade as valid records, and expected legacy formats have explicit tests.

### R12 — Medium: active controls have accessibility gaps

**Evidence:** `src/components/MemberSelector.tsx:135–138` uses toggle buttons without `aria-pressed` and removes outline without a visible replacement focus style. `src/App.tsx` search input has placeholder text but no associated label; format selected state is communicated through visual classes.

**Impact:** keyboard users may lose focus visibility and assistive technology may not announce selection/search controls reliably.

**Validation:** source inspection only; no screen-reader or interactive keyboard testing.

**Recommendation:** visible focus styles, accessible search label, explicit toggle/format state, and user testing. If dormant components are activated, also address clickable recommendation divs and modal focus management.

**Acceptance:** all active flows are usable via keyboard and announced accurately by a screen reader.

### R13 — Low: image and card loading costs need optimization

**Evidence:** sample imports emit four JPEGs totaling about 3.33 MB; active card images have no lazy-loading attribute; card image errors repeatedly assign the same remote Unsplash fallback without a one-time guard.

**Impact:** potentially unnecessary image transfer and eager requests; if the fallback also fails, repeated error handling is possible. Actual runtime load impact was not measured.

**Recommendation:** appropriately sized modern/responsive images, card lazy loading, an idempotent/local error fallback, and measured performance targets.

**Acceptance:** representative mobile tests meet agreed transfer/loading targets and repeated image failures terminate cleanly.

### R14 — Low: source/metadata advertises features that are not active

**Evidence:** `HeroSection`, `Navbar`, `MemberProfiles`, `PairingRecommendations`, and `VideoModal` are not imported/mounted by `App`; `metadata.json` advertises a Gemini capability without a call implementation. The active header's official-channel link points to YouTube's home page.

**Impact:** maintainers and users may infer profile pages, AND/OR filtering, embedded playback, or AI capabilities that are unavailable. Unused dependencies add maintenance surface.

**Recommendation:** explicitly retain as future components or remove through a separately scoped change; correct product metadata and link targets; audit unused dependencies.

**Acceptance:** product descriptions, visible links, dependency purpose, and active functionality agree.

### R15 — Low: licensing, content provenance, and operational configuration are incomplete

**Evidence:** many files have Apache-2.0 SPDX headers, but no root license file exists. Asset rights/profile fact sources are not recorded. No committed schema, RLS/grants, backup procedure, or deployment pipeline existed before this documentation.

**Impact:** reproducibility and redistribution decisions depend on information outside the repository. Lack of RLS files does not prove live RLS is disabled.

**Recommendation:** confirm code/asset ownership and licensing; record data provenance; version database/security configuration and add release/backup verification after inspecting the live system.

**Acceptance:** a new maintainer can reproduce the intended environment and identify content rights without relying on undocumented assumptions.

## Positive implementation properties

- Active UI uses controlled selection and derived filters rather than mutating the dataset.
- Multi-member behavior uses clear inclusive AND semantics.
- Successful database rows are normalized and sorted client-side.
- Image failures have basic visual fallback handling.
- External links use `noopener noreferrer`.
- Public frontend credentials and privileged importer credentials are separate variable sets.
- The scheduled workflow is small and easy to inspect.
- The core codebase is compact, with straightforward module boundaries suitable for focused tests.

These strengths do not neutralize the contract and data-trust findings above.

## Original recommended remediation sequence

### Phase 1 — Core correctness

1. Verify the live table and implement one consistent playback/thumbnail contract (R1).
2. Fix the type error and require both type-check/build gates (R2).
3. Stop unknown→all-eight tagging and establish accurate source identity (R3–R4).
4. Distinguish demo/live/error states before exposing sample content as archive results (R10).

### Phase 2 — Reliable data operations

5. Make ingestion errors observable and job status meaningful (R5).
6. Define coverage, refresh strategy, canonical uniqueness, and concurrency (R6–R7).
7. Standardize lockfile-aware dependency installation (R8).
8. Add paging and validated public row contracts (R9, R11).
9. Verify grants/RLS and add schema/security reproducibility (external checks in R15).

### Phase 3 — User experience and maintainability

10. Add regression tests around the corrected boundaries.
11. Improve accessibility and measured image performance (R12–R13).
12. Align dormant components, metadata, licensing, and content provenance (R14–R15).

This was the original recommended order. Current implementation progress and remaining owner requirements are recorded in [Remediation status](REMEDIATION.md).

## Original owner questions (historical)

- Does the live `videos` table contain triggers/generated columns bridging `url`/`thumbnail` to frontend fields?
- What ID default and uniqueness constraints exist?
- Which member tags are manually verified, and what is the desired definition of “co-appearance”?
- Are all thirteen configured channel IDs correct and approved?
- Should the product show only verified appearances or include heuristic associations?
- Is Bun the intended supported package manager for contributors and CI?
- What dataset size, freshness target, backfill coverage, and quota allocation are required?
- Where is the frontend deployed, and who owns database backups and credential rotation?
- What rights and factual sources cover the profile prose, JPEGs, and external avatars?

## Documentation deliverables

[Root README](../README.md) plus the [documentation index](README.md), [user guide](USER_GUIDE.md), [architecture](ARCHITECTURE.md), [setup](SETUP_CONFIGURATION.md), [data model](DATA_MODEL.md), [sync reference](YOUTUBE_SYNC.md), [operations guide](DEPLOYMENT_OPERATIONS.md), [development/testing guide](DEVELOPMENT_TESTING.md), and this review report.

Application source, configuration, dependencies, and lockfile were unchanged by the original documentation-only review; subsequent local fixes are detailed in [Remediation status](REMEDIATION.md). No commit or push was performed.
