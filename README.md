# Hearts2Hearts Video Archive test

A Traditional Chinese React/Vite fan archive that filters by **all selected member tags** (or an exact stored-tag set), five content categories, and title/channel/description keywords. Tags are unverified associations, **not proof of on-screen co-appearance**.

The browser reads Supabase; a separate Node/GitHub Actions importer searches owner-approved YouTube channel IDs. Demo content is explicitly labeled and cannot open unrelated videos.

## Quick start

Requirements: **Node 22.12+** and **Bun 1.4.2**.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
# Edit public Supabase settings for live data, or leave both blank for demo.
bun run dev
```

Open `http://localhost:3000`. The dev server listens on all interfaces; use a trusted network.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-client-key
NEXT_PUBLIC_VIDEO_ROW_FORMAT=legacy
NEXT_PUBLIC_YOUTUBE_CHANNEL_ID=
```

Only public Supabase client keys belong here. **Never expose a service-role/secret key or YouTube API key through a `VITE_`/`NEXT_PUBLIC_` variable.** Environment values are embedded at build time.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite development server, port 3000. |
| `bun run test` | Node regression tests using the existing tsx loader. |
| `bun run lint` | Type-check with `tsc --noEmit`; not ESLint. |
| `bun run build` | Type-check first, then build `dist/`. |
| `bun run preview` | Local preview of built files. |
| `bun run clean` | Delete `dist/` and root `server.js`; destructive. |

Dependencies and Bun are pinned; CI uses the existing Bun lockfile. Equivalent `npm run ...` scripts work after installation, but Bun is the reproducible installation route.

## Status and owner requirements

The Vercel TypeScript/build regression is repaired locally: **70 tests**, strict type-checking, a clean Node 22/Bun frozen installation, production build, and mocked Chrome smoke checks pass. See [repair and validation](docs/REPAIR_VALIDATION.md) for evidence, deployment instructions, and remaining risks; this does not close every finding in the [51-issue baseline review](docs/COMPREHENSIVE_REVIEW.md).

**Do not enable production ingestion yet without inspecting the actual database.** The table must support the documented required fields, privileged metadata updates, public read policies, stable IDs, and reviewed duplicate/uniqueness protection. `description` has narrowly scoped missing-column compatibility; storing it requires the column. Channel identities and content rights remain owner-verification tasks. No live migration or import was executed.

GitHub ingestion requires `ENABLE_YOUTUBE_SYNC=true` and an explicit `YOUTUBE_CHANNEL_IDS` repository variable. Scheduled/manual jobs run a configuration-only preflight; missing approval/settings fail with actionable errors instead of silently skipping the job. See [setup](docs/SETUP_CONFIGURATION.md), [sync operations](docs/YOUTUBE_SYNC.md), and the [skip diagnosis](docs/YOUTUBE_SYNC_DIAGNOSIS.md).

## Documentation

Start at [docs/README.md](docs/README.md). For a full current review, see [current-state analysis](docs/CURRENT_STATE_ANALYSIS.md). Build repairs are documented in [repair validation](docs/REPAIR_VALIDATION.md). The [Vercel data-load diagnosis](docs/VERCEL_DATA_LOAD_DIAGNOSIS.md) describes a separate historical missing-column runtime incident.

- [Current-state analysis](docs/CURRENT_STATE_ANALYSIS.md)
- [Remediation status](docs/REMEDIATION.md)
- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup/configuration](docs/SETUP_CONFIGURATION.md)
- [Data model](docs/DATA_MODEL.md)
- [YouTube synchronization](docs/YOUTUBE_SYNC.md)
- [Deployment/operations](docs/DEPLOYMENT_OPERATIONS.md)
- [Development/testing](docs/DEVELOPMENT_TESTING.md)
- [Original review findings](docs/PROJECT_REVIEW.md)
- [Content/licensing register](docs/CONTENT_PROVENANCE.md)

## Scope and ownership

The active page has member controls, five presets, five content-category tabs, sorting, keyword search, video cards, and a footer. Category names do not certify official ownership or on-screen membership. Popularity is disabled when view counts are unavailable. Multi-tab navigation, member profiles, recommendation panels, and embedded playback components are retained but not mounted. No server, authentication, admin UI, or Gemini feature is implemented.

This is an unofficial fan project. Existing SPDX headers do not establish asset rights or independently verify biographies. A root license must be confirmed by the owner rather than guessed. The current repairs remain local and uncommitted; no deployment or production data/configuration change was performed.
