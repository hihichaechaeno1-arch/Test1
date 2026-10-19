# Comprehensive current-state review

Reviewed revision: `2b61799` (working tree initially clean).

> **Pre-repair baseline:** subsequent owner-approved repairs and their current verification are recorded in [REPAIR_VALIDATION.md](REPAIR_VALIDATION.md). Findings, line numbers, and failing results below describe the reviewed revision, not the repaired working tree. Not all 51 findings were in scope for this repair.

## Executive conclusion

**The current revision is not deployable and is not ready for production ingestion.** This is not merely a Vercel setting problem: the source has broken module contracts, 94 TypeScript diagnostics, failing regression tests, and a stale dependency lockfile. Several previously documented repairs have been removed or replaced without updating their consumers.

This report covers the tracked application, dormant components, importer, workflows, configuration, database migration, tests, and operational documentation. It is a whole-repository review, not a review against a supplied PR/spec. No sub-agent tool was available; review axes were examined directly.

There are **51 findings below**, including explicitly marked external verification requirements. They are not 51 independent root causes: several are consequences of the same contract regressions. No review can establish every possible issue, and absence of a finding is not a security guarantee.

### Evidence labels

- **Reproduced:** actual local command or offline fixture exercised the behavior.
- **Code-confirmed:** implementation establishes the issue, but the full browser/production path was not exercised.
- **External/unverified:** missing evidence or an operational risk, not a claimed live vulnerability.

### Verification performed

Environment: Node `26.3.0`, npm `11.16.0`, existing installed dependencies matching the direct versions in `package.json`. Bun is not installed on this machine.

| Check | Result |
| --- | --- |
| `npm ls --depth=0` | Pass; direct installed dependency versions match the manifest. This does not validate the Bun lockfile or clean installation. |
| `npm run lint` / `tsc --noEmit --pretty false` | Fail: **94 compiler diagnostics**. |
| `npm test` | Fail: **34 runner entries, 2 pass, 32 fail**. Three entries are whole test files that fail module loading, so this is not a count of all individual intended tests. |
| `npm run build` | Fail at the TypeScript gate; Vite is not reached. |
| `./node_modules/.bin/vite build --outDir /tmp/test1-review-dist` | Fail independently: **five missing-export errors**. Bypassing type-checking does not solve deployment. |
| Offline mapper/filter/importer probes | Reproduced invalid playback identity, canonical-field loss, all-eight defaults, overwritten tags, unsafe host matching, invalid rows accepted, inherited alias acceptance, wrong oldest sorting, inconsistent duration classification, broken configured preflight, Shorts classification reversal, overly broad insert retry, and API errors not propagated. |
| Manifest/Bun lock workspace comparison | Drift confirmed, including obsolete direct dependencies and version specifiers. |
| `git diff --check` | Pass before report creation. |

No package installation, live Supabase/YouTube request, database write, migration, deployment, commit, or push was performed. Importer probes used mocked fetch/database objects only. No credentials were printed. The existing Vercel site, dashboard, project settings, build logs, and actual database policies were not inspected during this review.

## Vercel deployment diagnosis

The deterministic local failure chain is:

```text
Vercel install step
  -> may fail or resolve differently because bun.lock != package.json
Vercel build step, if installation succeeds
  -> npm/bun run build
  -> tsc --noEmit
  -> 94 diagnostics
  -> exit 1, no publishable new build
If build is changed to vite build to bypass tsc
  -> five missing exports
  -> exit 1 anyway
```

Missing exports reported by Vite:

| Importer | Missing export | Module actually provides |
| --- | --- | --- |
| `src/App.tsx:10` | `fetchArchiveVideos` | `loadArchiveVideos` in `src/lib/archive.ts:13`. |
| `src/App.tsx:21` | `FIVE_CATEGORIES` | No equivalent category metadata map. |
| `src/App.tsx:22` | `classifyVideoGenre` | `getVideoGroup`, with different output semantics. |
| `src/components/VideoCard.tsx:9` | `classifyVideoGenre` | Same missing symbol. |
| `src/lib/archive.ts:3` | `getSupabaseClient` | `supabase` and `supabaseConfigError` in `src/lib/supabase.ts:31–32`. |

These are verified blockers for this revision, **not proof of the exact failure stage in the user's last Vercel deployment**. That requires its build log and commit SHA.

`docs/VERCEL_DATA_LOAD_DIAGNOSIS.md` describes a different, historical incident: an already-deployed site whose Supabase query failed because `description` was absent. That document is historical evidence, not a current live observation. Its described compatibility reader is no longer the reader in this revision. Adding `description`, changing keys, or clearing the Vercel cache will not repair the current missing exports and type errors.

The eventual intended host configuration is Vite, repository root, build `bun run build` or equivalent validated script, output `dist`, and a host-supported Node version satisfying `>=22.12.0`. Public configuration is embedded at build time. A `vercel.json` is not inherently required for this root-only static Vite app; lack of that file is not itself the failure.

## A. Build, dependency, and interface failures

### A1 — Blocker: required exports have disappeared

**Reproduced.** References and missing symbols are listed above. Both Node test loading and the production bundler reject the module graph. A development server starting successfully would not establish that the page can execute.

**Repair:** restore coherent APIs or migrate every caller and test together. Do not bypass the checks or add placeholder exports that return incompatible data.

### A2 — High: the archive API changed more than its name

**Code-confirmed.** `src/App.tsx:97–100` expects `fetchArchiveVideos(client, signal, rowFormat): Promise<VideoItem[]>`. `src/lib/archive.ts:13–15` instead accepts one override and returns `{ videos, usingFallback, warning, source }`. It has no signal or row-format argument.

Simply renaming/aliasing `loadArchiveVideos` would leave `loaded.filter(...)` calling an array method on an object. The UI's cancellation/30-second timeout and legacy/canonical setting would also not reach the query.

**Repair:** define and test one archive boundary, including its return type, cancellation, row format, and failure semantics.

### A3 — Blocker: shared types no longer describe their consumers

**Reproduced.** `src/types.ts:61–101` conflicts with `src/data/h2hData.ts`, cards, modal, selector, and tests. Removed fields include `youtubeId`, `isSample`, `highlightNote`, `genre`, `group`, and member `accentColor`. Newly required `date`, `videoUrl`, and member `color` are absent in the old fixtures. `Member.name` is widened to `string` while selection callbacks require `MemberName`.

`VideoType` and `VideoGroup` also include `| string`, making their apparent allowed-value unions ineffective. `any` inputs and type assertions hide additional runtime disagreement.

**Repair:** choose a single validated domain model; migrate fixtures and both active/dormant consumers. Do not make every property optional merely to silence the compiler.

### A4 — High: sorting and match-mode vocabularies disagree

**Reproduced/code-confirmed.** UI state uses `new`, `old`, and `including` (`src/App.tsx:66,72,443–460`); types use `newest`, `oldest`, and `INCLUDE`/other variants (`src/types.ts:23–34`). `sortVideoItems` only recognizes `oldest` as ascending (`src/lib/videoData.ts:358`). Passing the UI's `old` returns newest first. `including` happens to take the default AND branch at runtime but is not an accepted type.

**Repair:** use one vocabulary at the UI/domain boundary and assert oldest/newest/including/only behavior from the actual UI values.

### A5 — High: Bun lockfile is stale and contradicts the manifest

**Code-confirmed by structured comparison.** `bun.lock:5–30` still declares removed dependencies including `@google/genai`, Express, dotenv, motion, `@types/express`, autoprefixer, and direct esbuild. Most specifiers differ from the pinned manifest. For example, the lock workspace says React `^19.0.1`, while the manifest pins `19.3.0`.

The stale graph also contains direct esbuild `0.25.12`, while its locked Vite declares an optional esbuild peer of `^0.27.0 || ^0.28.0` (`bun.lock:332,552`). The current installed npm tree is a different, cleaned graph; its passing `npm ls` cannot validate this lockfile.

**Repair:** regenerate and review the lock with the intended Bun version, then prove a clean frozen installation. A frozen Bun failure was not executed locally because Bun is unavailable.

### A6 — High: installation/runtime paths are inconsistent and release checks are not proven

**Code-confirmed/external.** Quality CI uses Bun on exact Node `24.18.0` (`.github/workflows/quality.yml:19–23`), ingestion uses Node 22 and `npm install --legacy-peer-deps` without a checked-in npm lock (`auto-update.yml:27–30`), and local validation here used Node 26. Documentation promises frozen Bun installs, but the quality workflow specifies plain `bun install` (Bun may enforce frozen behavior automatically in CI).

This gives different dependency-resolution paths; the peer bypass masks incompatible dependency relationships rather than proving correctness. No versioned Vercel settings or evidence shows that production deployments wait for the quality job.

**Repair:** standardize a reviewed lock-aware installer, remove the peer bypass, validate on the actual deployment runtime, and verify required checks/deployment gating. Confirm pinned runtime/package-manager versions are available on the host; no provider rejection is claimed here.

## B. Data correctness and trust failures

### B1 — High: live playback links use a field the mapper never supplies

**Reproduced.** `mapSupabaseRowToVideoItem` (`src/lib/videoData.ts:236–277`) returns `videoUrl`/`url`, not `youtubeId`. `VideoCard.tsx:21` and the modal interpolate `video.youtubeId`. A normal importer-shaped row produces `https://www.youtube.com/watch?v=undefined` at that card boundary.

**Repair:** preserve a validated YouTube identity in the domain model and build playback URLs from that identity. Test an actual importer-shaped row through the card renderer.

### B2 — High: canonical database rows lose identity and thumbnails

**Reproduced.** The mapper ignores `youtube_id`, `youtubeId`, and `thumbnail_url` (`src/lib/videoData.ts:240–243`). A canonical row with `youtube_id='abcdefghijk'` and `thumbnail_url` maps to blank URL and blank thumbnail. The UI still offers canonical row-format configuration.

**Repair:** implement deliberate legacy/canonical adapters with equivalent validated output.

### B3 — High: malformed external rows are accepted as valid videos

**Reproduced.** The `any` mapper accepts `null`, arrays, arbitrary non-YouTube URLs, impossible dates, and unsupported types. Nonstring truthy titles/descriptions/channels can survive into React rendering or `.toLowerCase()` calls in `App.tsx:169–173`, causing render/search failures. One malformed row can affect the entire page.

**Repair:** validate the unknown input boundary and define whether malformed records reject the archive or are explicitly quarantined with visible completeness warnings.

### B4 — Medium: URL parsing is neither host validation nor a complete YouTube parser

**Reproduced/code-confirmed.** `extractYouTubeId` (`src/lib/videoData.ts:229–234`) accepts `https://notyoutube.com/watch?v=abcdefghijk` because the regex matches a substring. It does not enforce exact ID length at the end and misses supported-looking alternate query arrangements/live URLs. Thumbnail URLs are passed through without protocol validation (`:243`).

This is a data trust/privacy problem, not a demonstrated arbitrary-JavaScript execution exploit: current cards reconstruct links on YouTube, and React renders text normally.

**Repair:** parse with `URL`, allow exact supported hosts/protocols/forms, and validate exactly 11 identity characters. Validate image protocols/host policy separately.

### B5 — Medium: defaults fabricate metadata and destabilize identity

**Reproduced/code-confirmed.** `src/lib/videoData.ts:239,244,261` invents an official channel and `2025-02-24` date; absent identities fall back to `Math.random()`. Numeric ID `0` is treated as absent. Invalid dates are not rejected, so date comparisons can become `NaN`. The importer also invents dates (`scripts/fetch-youtube.cjs:206`).

**Repair:** keep unknown metadata explicit, use stable validated identities, and validate dates before sorting.

### B6 — High: unknown membership is converted to all eight members

**Reproduced.** `normalizeMembers` ends with `ALL_MEMBER_NAMES` (`src/lib/videoData.ts:224`); importer `detectMembers` does the same (`scripts/fetch-youtube.cjs:65`). An unlabeled clip and an explicitly empty member array both become full-group records. Every inclusive member combination can falsely match them.

**Repair:** preserve unknown as empty/unknown, record inferred versus verified tags, and review historical contaminated rows separately.

### B7 — High: title guesses override stored/editorial member tags

**Reproduced.** `normalizeMembers` returns title-detected names before examining `row.members` (`src/lib/videoData.ts:199–215`). Stored `['Jiwoo','Yuha']` with title `Carmen official performance` becomes `['Carmen']`. An all-eight stored list can also be reduced by later inference. This is not a harmless display normalization.

**Repair:** establish explicit editorial/source precedence; do not replace trusted stored metadata with weaker inference.

### B8 — Medium: member encoding/alias handling loses legitimate associations

**Reproduced/code-confirmed.** The mapper only accepts arrays, not the documented JSON-array/comma-separated encodings. Title matches prevent description member matches from contributing; `Carmen` plus description `Jiwoo rehearsal` yields only Carmen. Common punctuation variants such as `A_NA` are not covered, and the displayed `아나` alias is accepted in stored arrays but not the corresponding text-detection rule. Korean patterns besides Juun lack consistent boundaries.

**Repair:** specify supported encodings, normalize Unicode/punctuation deliberately, and test title/description precedence and language-boundary cases.

### B9 — Medium: alias lookups accept inherited Object properties

**Reproduced.** `MEMBER_ALIAS_MAP` is a normal object and lookups use truthiness (`src/lib/videoData.ts:30,208–209,295,307`). `normalizeMembers(['constructor'])` returns a function as a purported member; `__proto__` can yield an object. Those are not valid domain values and can reach rendering/filtering.

**Repair:** use `Map`, a null-prototype dictionary, or an own-property check, then runtime-validate the result.

### B10 — High: official-source labels rely on spoofable display names

**Reproduced/code-confirmed.** `isOfficialH2HChannel` (`src/lib/videoData.ts:75–82`) accepts any channel containing the group name, including `Unofficial Hearts2Hearts Fan Reuploads`, and even literal `official`. The importer uses similar matching (`scripts/fetch-youtube.cjs:68–71`) and rewrites matching source names to `Hearts2Hearts` (`:234`). MV classification does not require an official source at all.

**Repair:** retain and validate source channel IDs; separate verified identity from classification keywords. Do not erase source provenance.

### B11 — High: there are incompatible, duplicated classification models

**Code-confirmed.** Importer categories are `mv/shorts/stage/original/other`; `getVideoGroup` returns human-readable labels; active UI expects `genre` codes and `FIVE_CATEGORIES`; tests additionally expect older `official/shorts/stage/others` groups (`tests/videoData.test.ts:64–97`). Frontend/importer regexes and exclusions differ. A function alias alone cannot reconcile these semantics.

**Repair:** choose whether source group, content genre, and physical format are separate dimensions, define one authoritative taxonomy, and share/test the classification contract.

### B12 — Medium: Shorts inference contradicts itself and makes unsupported format claims

**Reproduced/code-confirmed.** The duration regex (`src/lib/videoData.ts:100`) treats `01:00` as long but `1:00` as short. Title keywords are used as format evidence; nonofficial Shorts are excluded from the Shorts group even when `type='shorts'`. Cards can therefore display a Shorts/9:16 badge independently of the category (`VideoCard.tsx:20,95–99`), despite no aspect-ratio metadata being fetched.

**Repair:** distinguish physical format from official-source policy, normalize duration numerically, preserve reliable playlist/source evidence, and avoid asserting orientation without evidence.

### B13 — Medium: popularity is not reliable view-count sorting

**Reproduced/code-confirmed.** The importer never fetches/writes view statistics. Missing views become the channel name (`src/lib/videoData.ts:274`), and `parseViewsCount('Hearts2Hearts')` becomes `2`. Localized counts `1.2萬` and `1億` parse as `1.2` and `1`. Missing dates/views and mixed units produce misleading ordering.

**Repair:** store numeric view metadata with freshness, or remove/disable the popularity control until meaningful data exists. Keep display formatting separate from numeric values.

## C. Archive loading and public read behavior

These defects are in the current reader; it cannot yet be reached by the active UI because A1/A2 block that integration.

### C1 — High: a single limited request does not load the complete archive

**Code-confirmed.** `src/lib/archive.ts:28–32` requests one `.limit(5000)` page. A lower Supabase server cap still truncates it, and more than 5,000 rows can never be loaded. There is no count, continuation/completeness check, or stable secondary ordering for tied publication dates.

**Repair:** deterministic pagination advancing by actual returned length, or server-side cursor/filter/search pagination with explicit completeness semantics.

### C2 — Medium: wildcard SELECT expands the public response unexpectedly

**Code-confirmed.** `.select('*')` (`src/lib/archive.ts:30`) reads every accessible column, contradicting tests and the documented public projection. A future internal column can be delivered to browsers if database column permissions allow it. Replacing it with an allowlist does not substitute for RLS/grants.

**Repair:** explicit verified column projections plus independently enforced database authorization.

### C3 — High: live empty/error states silently substitute sample content

**Code-confirmed.** `src/lib/archive.ts:34–49,60–66` returns `FALLBACK_VIDEOS` for empty data, query errors, and exceptions. Those fixtures are not themselves marked `isSample`; the active UI marks samples only inside `showDemo` (`App.tsx:79`). A superficial API repair that unwraps `.videos` could therefore label samples as live and enable their unrelated YouTube IDs as playback.

**Repair:** keep live failures/empty archives distinct and fail visibly. Only deliberate demo mode should supply explicitly nonplayable sample records.

### C4 — Medium: loader errors are unsanitized, and optional-schema compatibility is gone

**Code-confirmed.** `src/lib/archive.ts:38,64` copies raw provider/exception messages into returned warnings. The documented selective missing-description retry no longer exists. `select('*')` avoids that particular missing-column request by overfetching rather than preserving the reviewed contract. Missing required columns can instead be concealed by permissive mapper defaults.

**Repair:** sanitized error classifications, verified required columns, and narrowly bounded compatibility behavior. Preserve actionable diagnostics without leaking raw provider details or hiding schema failures.

## D. Ingestion safety and reliability

### D1 — High: scheduled writes no longer require documented owner approval

**Code-confirmed.** `.github/workflows/auto-update.yml:19–44` runs the writer on schedule/manual dispatch without reading `ENABLE_YOUTUBE_SYNC`, without passing `YOUTUBE_CHANNEL_IDS`, and without calling the preflight. `main()` does not check the enable flag either.

With configured secrets, the schedule can perform broad writes even when the documented approval flag is false/unset. This is independent of Vercel frontend deployment.

**Repair:** restore the tested explicit approval/source gate before installation/network/database activity; verify both workflow and CLI paths.

### D2 — High: a fully configured preflight always rejects valid configuration

**Reproduced.** `scripts/check-youtube-sync.cjs:3,26` imports/calls `loadConfig`, but `scripts/fetch-youtube.cjs:460–469` no longer exports it. The resulting TypeError is caught and mislabeled as invalid channel syntax. The preflight also eagerly imports the SDK despite its configuration-only/no-SDK description.

**Repair:** restore a pure shared configuration validator, distinguish validation versus program errors, and test the standalone preflight in an environment without installed application dependencies if it runs before installation.

### D3 — High: hardcoded playlist ingestion bypasses channel allowlisting

**Code-confirmed.** `TRACKED_PLAYLISTS` has `skipKeywordFilter: true` (`scripts/fetch-youtube.cjs:25–31`) and always runs first (`:399–401`). `syncPlaylistById` does not verify the video's source channel ID. A playlist owner can add unrelated or unapproved-channel content. Configured channels are read from JSON rather than the documented approved environment allowlist, and channel-ID validation only checks a prefix (`:163–170`).

**Repair:** enforce source IDs for every ingestion route, validate manifest inputs, and make curated-playlist exceptions explicit owner-approved policy rather than a bypass.

### D4 — High: importer can silently target a hardcoded project or use public write credentials

**Code-confirmed.** `scripts/fetch-youtube.cjs:6–19` falls back to a specific Supabase project and several anon/public key variables. `main()` checks only YouTube/key presence (`:387`). A missing target can therefore direct requests at the wrong project; accepting a public key normalizes the possibility of anonymous writer permissions.

**Repair:** require explicit target URL and dedicated privileged credential from trusted configuration, validate them, and fail closed. Do not loosen public database policies to make this importer work.

### D5 — High: update failures and zero-row updates are reported as repairs

**Code-confirmed.** `scripts/fetch-youtube.cjs:223–228` awaits `.update(...).eq(...)` but discards its error and affected-row result, then prints a success message. The function returns false for both successful existing-record handling and failure, so callers cannot distinguish them.

**Repair:** validate every update result, assert expected affected rows, and return explicit inserted/updated/skipped/failed outcomes.

### D6 — High: every insert error triggers a schema-changing retry payload

**Reproduced.** `scripts/fetch-youtube.cjs:242–250` retries any error without `description`, including a mocked `42501` permission denial. This is not restricted to a verified missing optional column. Timeouts/ambiguous outcomes and uniqueness failures also need different handling; blindly repeating inserts can create duplicates where uniqueness is absent.

**Repair:** classify error code and affected column exactly, retry only safe confirmed cases, and use stable-identity/idempotent write semantics.

### D7 — High: API/database failures can leave the job green

**Reproduced/code-confirmed.** Playlist/search errors log and break (`scripts/fetch-youtube.cjs:282–285,315–317,340–343,373–375`); database failures return false. `main()` aggregates only additions and prints completion (`:397–450`). Only uncaught exceptions set exit 1. A mocked HTTP 403 resolves normally rather than rejecting.

**Repair:** aggregate failures/incompleteness, set defined nonzero exit statuses, and distinguish legitimate zero-new-content runs from failed runs.

### D8 — High: ingestion overwrites editorial member tags

**Code-confirmed and observed in the Shorts fixture.** Existing rows are updated with inferred `members` whenever classification/URL changes (`scripts/fetch-youtube.cjs:222–226`). Human corrections are lost, often replaced with all-eight defaults.

**Repair:** preserve editorial fields during source refresh; require a separate reviewed correction/re-inference operation with provenance.

### D9 — High: the uploads scan undoes the preceding Shorts scan

**Reproduced.** `main()` scans forced official Shorts first, then all uploads (`scripts/fetch-youtube.cjs:422–441`). For a Short titled `Cute moment`, the first pass sets `shorts` and a Shorts URL; the second, with no Shorts keyword/force flag, reclassifies it as `other` and changes back to a watch URL. Both passes can also overwrite tags.

**Repair:** deduplicate by stable identity and combine source evidence before persisting classification. Weaker generic uploads evidence must not erase explicit Shorts-playlist evidence.

### D10 — Medium: existing metadata remains stale unless classification changes

**Code-confirmed.** Existing rows return without refreshing title, description, thumbnail, channel, or publication metadata (`scripts/fetch-youtube.cjs:219–230`). Even the classification update only writes type/URL/members. Corrected source titles/descriptions are therefore not reflected; removed/private/unavailable records are not reconciled.

**Repair:** define refresh/availability policy and update mutable source metadata separately from editorial fields. Treat absence from a bounded scan as insufficient deletion evidence.

### D11 — High: URL lookup is not concurrency-safe uniqueness

**Code-confirmed/external.** Lookup followed by insert (`scripts/fetch-youtube.cjs:209–245`) is a race. Duplicate matches are silently reduced to the first row, and watch/Shorts URLs vary with classification. The workflow has no concurrency group. Actual database uniqueness is unverified; the one migration only adds `description`.

**Repair:** inspect existing duplicates, establish reviewed stable YouTube-identity uniqueness, use conflict-aware writes, and serialize intended workflow writers. Do not blindly apply a constraint to unknown live data.

### D12 — Medium: bounded scans cannot guarantee complete history or resume reliably

**Code-confirmed.** Page caps are 30 for the curated playlist, 50 for official playlists, and 8 for broadcast searches in full mode (`scripts/fetch-youtube.cjs:400,404–406`). Continuation tokens are discarded when limits are reached; there is no persisted checkpoint or incomplete outcome. Comments claim 100% coverage despite those limits.

**Repair:** explicit windows/budgets, resumable checkpoints, and honest completeness reporting. Derived Shorts-playlist availability and source coverage require actual API validation; no exhaustive guarantee is established.

### D13 — Medium: incremental mode repeatedly starts from the beginning

**Code-confirmed.** Mode changes page counts, not a stored watermark/date window. Search always starts after fixed `2025-01-01`, and the curated playlist always scans up to 30 pages (`scripts/fetch-youtube.cjs:23,333,400–406`). Scheduled/default manual runs choose `full_backfill` (`auto-update.yml:10,43`).

**Repair:** make routine sync truly incremental with overlap/reconciliation policy; make expensive historical backfill explicit and resumable.

### D14 — High: API/network work lacks explicit operational bounds and recovery

**Code-confirmed.** Fetches (`scripts/fetch-youtube.cjs:175,279,337`) have no explicit timeout, status-based transient retry/backoff, shared request/quota budget, or Retry-After handling. Search is used across twelve broadcast channels, up to eight pages each in full mode: **96 potential search requests**, before other API calls. The workflow lacks its own `timeout-minutes` and concurrency control.

**Repair:** bounded requests and elapsed time, quota accounting, backoff only for safe retry classes, cancellation, and a job timeout. Measure quota usage rather than assuming the project quota is adequate.

### D15 — Medium: raw external errors are logged without sanitization

**Code-confirmed.** Database/provider messages and raw top-level exceptions are printed (`scripts/fetch-youtube.cjs:215,250,283,316,341,374,455`). They can contain operational details or reflected input; no actual secret leak was observed. The safe fixed-message preflight cannot compensate for writer logging.

**Repair:** structured allowlisted error codes/events/counts with redaction; never log credential-bearing request URLs or raw exceptions by default.

### D16 — Medium: importer input validation and source fidelity are weak

**Code-confirmed.** Video ID validation only requires length at least five (`scripts/fetch-youtube.cjs:191`), title/date types are not comprehensively validated, and fallback publication dates hide missing data. Broadcast discovery combines an English search term with a title-only group filter (`:333,358`), missing related clips without the chosen group tokens. Playlist owner title can be mistaken for source-video owner when metadata is missing (`:295`).

**Repair:** validate normalized API records, preserve source video/channel identity, and document/test multilingual discovery coverage without weakening the source allowlist.

## E. UI, accessibility, compatibility, and test quality

### E1 — Medium: filtering/rendering does unnecessary work and does not scale with the requested archive

**Code-confirmed; performance impact unmeasured.** `App.tsx:140–155` classifies the base list in five separate count scans on every render; search and every card classify again. Search triggers a full filter/sort without debouncing/deferral, and `App.tsx:604` renders all matches without pagination/virtualization. Lazy images reduce transfer, not DOM/card work.

**Repair:** normalize classification once, derive counts in one pass, and add measured pagination/virtualization/server-side search appropriate to agreed archive size.

### E2 — Medium: visible copy still implies verified appearances and official provenance

**Code-confirmed.** The selector describes strict solo/co-appearance guarantees (`MemberSelector.tsx:109–111`), loading/results copy still says co-appearance (`App.tsx:512,543`), and cards label arbitrary `other` records as official (`VideoCard.tsx:88`). These contradict unverified-tag disclaimers and name-based source inference. Active presets also present unsourced role groupings.

**Repair:** consistently describe tag matching, not proven on-screen membership; reserve official/verified claims for documented evidence.

### E3 — Medium: errors and empty search states are conflated and difficult to diagnose

**Code-confirmed.** `App.tsx:104–109` discards all underlying errors for one generic message. After failure, the ordinary no-results area is also rendered, suggesting filter adjustment rather than a failed archive. There is no error-class/correlation telemetry or freshness indicator, and the empty-results controls cannot directly clear a keyword query.

**Repair:** distinct load-error/empty/archive-filter states, sanitized diagnostic classification, actionable retry/reset controls, and visible freshness/source health.

### E4 — Medium: accessibility is incomplete; dormant components carry additional blockers

**Code-confirmed; full WCAG conformance not tested.** Many secondary texts use very light `text-slate-400` at 10–12px on white; the standard palette is a likely contrast concern requiring rendered measurement. Small selected-chip remove buttons have small hit areas and require WCAG target-size/spacing verification. Motion/hover transforms, spinner, and smooth scrolling have no app-level reduced-motion handling (`src/index.css`, `Footer.tsx:11`).

If activated, `PairingRecommendations.tsx:112` uses click-only divs with no keyboard activation, and `VideoModal.tsx:35–40` lacks an accessible dialog name, initial focus, focus trap/restoration, and background inertness/scroll management. These dormant issues do not currently affect active runtime navigation but must not be treated as ready components.

**Repair:** measure contrast/targets, test keyboard/screen-reader flow/reduced motion, and implement proper dialog/button semantics before activation.

### E5 — Medium: browser compatibility assumptions are not specified or tested

**Code-confirmed/external.** `App.tsx:98` directly calls `AbortSignal.any` and `AbortSignal.timeout`. Unsupported browsers fall into the generic load error even when Supabase is healthy. No supported-browser matrix or fallback is checked in.

**Repair:** declare target browsers; test them and feature-detect or polyfill cancellation composition if older required browsers need support.

### E6 — Medium: render failures have no user-facing recovery boundary

**Code-confirmed.** `src/main.tsx:5` mounts App directly with no React error boundary. The fetch catch cannot catch later render exceptions from malformed title/channel/member data. A blank/crashed page is therefore possible even after a successful request.

**Repair:** validate data first and add a narrow recovery/error boundary with sanitized diagnostics; a boundary is not a substitute for validation.

### E7 — High: tests exist but current regression protection is broken/incomplete

**Reproduced/code-confirmed.** Three test files fail before individual tests run, importer tests reference removed `loadConfig`/`syncVideos`, and classification tests mix incompatible old and new taxonomies. Existing tests successfully expose failures but do not establish a green, enforceable release gate.

`tests/components.test.tsx` uses static markup, not browser interactions; there is no checked-in E2E suite, no cross-browser keyboard/network test, and no current rendered performance/accessibility evidence. Historical documentation of temporary Chromium probes is not a rerunnable suite for this revision.

**Repair:** restore tests against the agreed behavior without deleting safety assertions to obtain green output; add browser tests for demo/live/error/retry, paging, category/member modes, oldest sort, and imported-row playback. Gate production on the full suite.

## F. Documentation, security assurance, and operations

### F1 — High: documentation materially misrepresents the current implementation

**Code-confirmed.** README says checks pass and importer repairs remain uncommitted, but the initial working tree was clean and checks fail. `docs/REMEDIATION.md` marks conservative tags, paged allowlists, stable IDs, workflow gates, checked updates, and frozen dependencies as repaired; current code contradicts these claims. `docs/DATA_MODEL.md` also describes a different type/mapper contract.

**Repair:** tie verification claims to commit SHA/runtime/date, distinguish historical reports from current guarantees, and regenerate operational instructions from tested contracts. Do not follow the old release assurances without revalidation.

### F2 — High verification requirement: database security and schema cannot be reproduced or certified

**External/unverified.** The only migration (`db/migrations/20261004152543_add_videos_description.sql`) adds one optional column. There is no complete versioned table/default/constraint/RLS/grant contract or migration-test suite. Actual public SELECT scope, anonymous write denial, privileged permissions, triggers, duplicates, and backups remain unverified.

This does **not** prove RLS is disabled or production data is exposed. Public anon/publishable keys are intentionally public; their presence alone is not a secret leak.

**Required evidence:** read-only schema/policy inspection, staging tests that public reads succeed and anonymous writes fail, reviewed uniqueness/defaults, and verified restore procedures. Do not change permissions blindly.

### F3 — Medium hardening gap: workflow/dependency/browser defense is not fully assured

**Code-confirmed/external.** Actions use mutable major tags; ingestion has no explicit least-privilege `permissions` block. There is no checked-in dependency vulnerability/SBOM/secret scan or reviewed host security-header policy. Vite exposes all `VITE_`/`NEXT_PUBLIC_` variables by design (`vite.config.ts:10`), so any privileged key placed under those prefixes becomes public.

No known exploitable package CVE, actual excessive token grant, secret exposure, or absent live host header is claimed: external scans/settings were not checked.

**Repair:** pin reviewed action revisions, minimize workflow permissions, assess dependencies, and test CSP/frame/MIME/referrer policies at the host. Keep secret-prefixed configuration out of public build variables.

### F4 — Medium release requirement: content rights and factual provenance remain unresolved

**External/unverified, acknowledged in `docs/CONTENT_PROVENANCE.md`.** There is no root license text, recorded asset redistribution evidence, or factual source register for member biographies/roles/birthdays/MBTI. Imgur avatars and Google Fonts add external availability/privacy dependencies. Sample fixtures deliberately contain fictional descriptions and unrelated repeated video IDs; they are safe only while nonplayable demo labeling is reliably enforced.

**Repair:** owner-reviewed code/asset licenses and sources, cleared/local replacements where appropriate, consistent demo separation, and a privacy/takedown/contact policy suitable for the intended public service. The copyright footer does not establish permission.

### F5 — Medium: operational health, rollback, and production release evidence are missing

**Code-confirmed/external.** There is no persistent successful-sync checkpoint/freshness record, alerting integration, frontend exception monitoring, automated deployment smoke check, verified backup/restore process, or versioned deployment rollback evidence. Social metadata requests a large preview card without an `og:image`; canonical/share URL and real social preview behavior are not established (`index.html:7–11`). These are operational/polish gaps, not the present build failure.

**Repair:** define owner/SLO/freshness requirements, monitor real successful writes/read/playback, retain sanitized release evidence, validate restore/rollback, and finish metadata only after the canonical deployed URL and cleared image are known.

## Reproduced examples (offline, no real API/database operations)

| Scenario | Observed current result |
| --- | --- |
| Map an importer-style legacy video | `youtubeId` missing; card would use `watch?v=undefined`. |
| Map `youtube_id` + `thumbnail_url` | Both playback URL and thumbnail become blank. |
| Normalize no member evidence | All eight names. |
| Stored Jiwoo/Yuha, title contains Carmen | Stored tags replaced with Carmen. |
| Title Carmen, description Jiwoo | Only Carmen retained by importer. |
| Parse `https://notyoutube.com/watch?v=abcdefghijk` | Accepted as YouTube ID `abcdefghijk`. |
| Map null/array/impossible date | Accepted instead of rejected. |
| Normalize stored member `constructor` | Function included as member. |
| Classify `Unofficial Hearts2Hearts Fan Reuploads` | Accepted as official-name match. |
| Sort UI mode `old` | Newest first. |
| Shorts duration `1:00` versus `01:00` | Different classification for the same duration. |
| Parse `1.2萬`, `1億`, `Hearts2Hearts` as views | `1.2`, `1`, `2`. |
| Run preflight with all valid fixture settings | Rejected as bad channel syntax because validator export is missing. |
| Scan explicit Short, then generic uploads | `shorts`/Shorts URL overwritten to `other`/watch URL. |
| First insert returns permission denial | Second insert attempted without description. |
| Playlist API returns HTTP 403 | Sync function resolves normally. |

### Small rerunnable probes

These commands use repository modules and fixture strings only:

```bash
npm run lint
npm test
npm run build
./node_modules/.bin/vite build --outDir /tmp/test1-review-dist

node --import tsx --input-type=module <<'JS'
import { mapSupabaseRowToVideoItem, normalizeMembers, extractYouTubeId, sortVideoItems } from './src/lib/videoData.ts';
const v = mapSupabaseRowToVideoItem({url:'https://youtu.be/abcdefghijk',members:[]});
console.log({youtubeId:v.youtubeId,members:v.members});
console.log(normalizeMembers(['Jiwoo','Yuha'],'Carmen performance'));
console.log(extractYouTubeId('https://notyoutube.com/watch?v=abcdefghijk'));
console.log(sortVideoItems([{...v,id:'old',date:'2025-01-01'},{...v,id:'new',date:'2026-01-01'}],'old').map(x=>x.id));
JS
```

Do not run the real ingestion CLI against production as a diagnostic; it writes records.

## Recommended repair sequence and acceptance gates

1. **Prevent unintended ingestion:** inspect/disable the scheduled workflow through the owner-controlled process until approval gates and write safety are restored. Do not assume `ENABLE_YOUTUBE_SYNC=false` currently prevents writes.
2. **Recover coherent contracts:** agree the video model, source identity, taxonomy, archive return type, modes, and public database formats; migrate code/tests together. Compare prior reviewed implementations where useful, but do not blindly roll back unrelated changes.
3. **Repair dependency reproducibility:** reconcile the manifest and lock, standardize the installer/runtime, prove a clean frozen Linux install without peer bypasses.
4. **Restore data trust and safe reads:** validated IDs/rows, unknown membership, editorial precedence, paginated allowlisted reads, cancellation, explicit live/error/empty/demo states, valid playback from imported fixtures.
5. **Repair safe writes:** pure configuration gate, source allowlists everywhere, explicit target/privileged credential, checked update counts, narrow retries, preserved editorial tags, stable identity, failure exit policy, Shorts evidence precedence.
6. **Inspect staging/database:** verify schema/RLS/grants/defaults/uniqueness and backups before enabling the repaired writer; validate a controlled ingestion-to-browser round trip. Production migration needs explicit reviewed authorization.
7. **Pass release checks:** all intended tests individually run and pass; type-check, bundler, clean install, browser flows, and public-read/anonymous-write-denial tests pass on the actual deployment environment.
8. **Deploy and verify:** Vercel Vite/root/`dist` settings, correct branch/commit and build-time public variables; confirm deployment SHA, asset loading, live reads, actual playback, no console exceptions, and distinct demo/error behavior. Changing environment variables requires a new build.
9. **Complete assurance:** accessibility/performance targets, operational freshness/alerts/rollback, current documentation, rights/provenance, and reviewed security hardening.

## Evidence needed to finish the Vercel-specific diagnosis

Provide the failed deployment's **build log and commit SHA**, plus framework preset, root directory, install/build commands, output directory, Node/Bun versions, and public variable **names and configured/not-configured status only**. Do not share key/token values. A deployment URL can help distinguish build failure, domain/routing failure, and a successful deployment whose live data fetch fails.

## Deliverables and residual risk

- Added only `docs/COMPREHENSIVE_REVIEW.md`; no implementation changes.
- Local checks and offline probes are listed above; they do not certify production.
- Deployment logs, clean Bun/Linux installation, live database policies/schema, actual provider quota, content rights, dependency vulnerability results, and rendered browser/accessibility/performance behavior remain unverified.
- No agent memory or skill proposal was written.
