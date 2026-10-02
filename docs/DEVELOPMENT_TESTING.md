# Development and testing

## 1. Supported workflow

Use Node 22.12+ and Bun 1.4.2. Read [Architecture](ARCHITECTURE.md), [Data model](DATA_MODEL.md), and [Remediation status](REMEDIATION.md) before changing contracts.

```bash
bun install --frozen-lockfile
bun run test
bun run lint
bun run build
bun run dev
```

`lint` is `tsc --noEmit`, not ESLint. `build` runs type-checking before Vite. The quality workflow installs from the pinned Bun lockfile, runs tests, and builds without credentials. There is no coverage threshold or formatting linter.

Use local/staging public configuration. Importing the importer module is safe; executing its CLI performs real writes unless external services are mocked.

## 2. Regression suite and seams

The existing tsx dependency loads TypeScript into Node's built-in test runner. No new test-framework dependency was needed. Current suite has **27 passing tests**:

| File | Boundary covered |
| --- | --- |
| `tests/videoData.test.ts` | Legacy/canonical row identity/image preservation, normalization, stable unknowns, malformed data rejection. |
| `tests/archive.test.ts` | External Data API paging, smaller server caps, empty archives, database errors, cancellation. |
| `tests/components.test.tsx` | Public rendered markup: no demo playback links, valid live links/lazy images/unverified labels, member state/focus semantics. |
| `tests/youtubeSync.test.ts` | Importer configuration/allowlist, conservative tags, wrong-channel rejection, observable failures, stable writes/refresh, bounds/retries/conflicts/backfill validation, and actual installed-SDK HTTP-boundary update behavior. |

Tests use real application functions/components and mock external HTTP/database services. They do not start live ingestion, create privileged browser credentials, or mutate a real database.

The component tests render with React's server renderer; they are not a substitute for interactive screen-reader testing. One-off Chromium checks were run separately as described below.

## 3. Current validation results

Working tree after remediation; original baseline commit remains `d93b74b1035af155e08902877b8cc046c14649b9` because no commit was made.

Environment: Node 24.18.0, npm 11.16.0, ephemeral Bun 1.4.2. CI is configured for the same Node 24.18.0 version; actual hosted-runner execution remains to be observed.

| Check | Result |
| --- | --- |
| `node --check scripts/fetch-youtube.cjs` | Pass. |
| 27 regression tests | Pass. |
| Type-check | Pass. |
| Type-gated production build | Pass; previous `thumbnail` type error and `__dirname` warning removed. |
| `bun install --frozen-lockfile --ignore-scripts` | Pass; regenerated current lockfile is consistent. |
| Clean temporary npm install, scripts disabled | Pass without `--legacy-peer-deps`; direct esbuild conflict removed. |
| Chromium demo/live-mock smoke checks | Pass; no page exceptions. |
| Local docs links/fences/whitespace | Checked before completion. |

Lifecycle scripts were disabled during local installation review. Fresh CI installation and real service/schema behavior remain separate verification steps.

### Chromium checks performed

Temporary Playwright/Chromium probes, outside the committed test suite, tested:

- Mobile viewport: explicit demo state, member toggles/announced state, keyword search, presets, and no demo playback anchors.
- Mocked live Supabase response with a two-row server cap: all three records load in two requests.
- Full-video/Shorts filtering and case-insensitive description search.
- Failed remote images produce a stable local placeholder.
- HTTP/read failure clears results and shows an alert, not automatic samples.
- Retry restores live data.

Provider requests were intercepted or blocked. No real database/API reads/writes occurred. A full accessibility audit, real playback, or measured mobile-network benchmark was not performed.

### Production output

Measured principal artifacts:

| Artifact | Size | Gzip where reported |
| --- | ---: | ---: |
| HTML | 1.27 kB | 0.64 kB |
| JS entry | 262.85 kB | 83.29 kB |
| CSS | 47.80 kB | 8.70 kB |
| Group WebP | 47.67 kB | Not reported. |
| Dance WebP | 76.49 kB | Not reported. |
| Concept WebP | 95.00 kB | Not reported. |
| Vlog WebP | 100.60 kB | Not reported. |

Image bytes fell from about 3.33 MB to 0.320 MB; originals remain preserved. These are artifact sizes, not page-load-time guarantees. Hashes and values may change after subsequent edits.

## 4. Historical baseline

The original review found a failing type check, a successful unchecked Vite build, an npm peer conflict, incorrect importer-to-mapper fields, fabricated all-eight defaults, and silent database failures. These are retained as historical findings in [Project review](PROJECT_REVIEW.md), with current status in [Remediation](REMEDIATION.md).

Do not rerun the old external temporary harness and interpret assertions for old defects as the desired current behavior. Use the repository's regression suite.

## 5. Required staging integration checks

Mock tests cannot verify live grants, RLS, constraints, schema, credentials, or channel ownership. Before enabling ingestion:

1. Inspect the actual table and prove intended public SELECT access.
2. Prove public INSERT/UPDATE/DELETE are denied.
3. Confirm required fields, `description`, and ID default.
4. Prove privileged lookup/insert/update behavior through a staging import.
5. Validate the row through the chosen frontend projection, mapper, and real playback link.
6. Test duplicate/concurrent writes against the actual stable-identity constraint.
7. Reconcile existing legacy Shorts/watch duplicates and incorrect historical tags.
8. Verify each approved source channel and the provider's current quota.

These checks require owner-approved service access. Do not embed a service-role/secret key in a browser test or publish private test output.

## 6. Remaining test opportunities

- Screen-reader audit and complete keyboard/focus traversal across all active controls.
- Fresh CI checks on Node 24.18.0/Bun 1.4.2 with normal lifecycle scripts.
- Large/concurrently changing archives, cursor strategy, memory/render performance.
- Real source freshness and unavailable/deleted video handling.
- Backfill/checkpoint policy beyond bounded manual continuation.
- Existing duplicated database identities and live race constraints.
- Device/network image/loading benchmarks and dependency vulnerability audit.
- Dormant component accessibility before any future activation.

## 7. Change/validation discipline

Work one boundary at a time: reproduce the behavior, make the smallest targeted repair, rerun the relevant tests, then run the full suite/type-gated build. Update status/docs and keep external assumptions explicit.

Before handing off:

```bash
bun run test
bun run build
git diff --check
git status --short
```

Validate Markdown links and generated/ignored artifacts separately. Do not stage, commit, push, deploy, migrate, or run production ingestion automatically; those remain owner decisions.
