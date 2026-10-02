# Setup and configuration

## 1. Prerequisites and installation

- **Node 22.12+**, as declared in `package.json`.
- **Bun 1.4.2**, as declared by `packageManager` and both CI workflows.
- Modern browser; live data requires an appropriately configured Supabase project.
- Ingestion additionally requires a private YouTube Data API key and owner-approved channel IDs.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Edit the copied environment file before starting if using live data. Open `http://localhost:3000`. The development script binds `0.0.0.0`, so use a trusted network or override the host.

Retained package versions are pinned and the Bun lockfile has been regenerated. Unused direct esbuild, Express, Gemini, dotenv, motion, autoprefixer, and Express types were removed. A clean npm diagnostic installation now passes without `--legacy-peer-deps`; npm does not consume `bun.lock`, so Bun remains the supported reproducible installer.

Local installation verification disabled dependency lifecycle scripts for safety. CI uses the normal frozen installation; lifecycle-script behavior on a fresh CI runner remains to be observed by the owner.

## 2. Public frontend variables

Despite the names, this is Vite, not Next.js. The Vite configuration explicitly exposes `NEXT_PUBLIC_` and `VITE_` variables. All such values must be treated as public.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key. Current name also accepts a compatible publishable key; it does not read a differently named publishable-key variable. |
| `NEXT_PUBLIC_VIDEO_ROW_FORMAT` | `legacy` (default): `url`/`thumbnail`; `canonical`: `youtube_id`/`thumbnail_url`. |
| `NEXT_PUBLIC_YOUTUBE_CHANNEL_ID` | Optional owner-verified channel ID for the header link; otherwise the link is labeled simply YouTube. |
| `DISABLE_HMR` | Exact `true` disables the existing development HMR/watching behavior. |

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-client-key
NEXT_PUBLIC_VIDEO_ROW_FORMAT=legacy
NEXT_PUBLIC_YOUTUBE_CHANNEL_ID=
```

- Both Supabase values blank: explicit labeled demo, with no database request.
- Partial/invalid values: visible configuration/load error, not a placeholder client crash or silent sample fallback.
- Empty live result: empty state, not invented data.
- Fetch/validation failure: visible error; the user may explicitly choose demo.
- Environment changes require rebuilding/redeploying a static bundle.
- `.env*` files are ignored except `.env.example`; keep real credentials out of that example.

**Never place a privileged Supabase key or YouTube API key in browser-exposed variables.** The code cannot make a bundled secret private.

## 3. Private importer configuration

The script does not load dotenv automatically. For an intentional staging run, create an ignored private `.env.sync.local` containing:

```dotenv
YOUTUBE_API_KEY=your-private-api-key
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-private-server-key
YOUTUBE_CHANNEL_IDS=your-approved-UC-channel-id
```

Values above are placeholders, not valid credentials/IDs. Use comma-separated IDs to approve multiple sources. IDs must be `UC` followed by 22 valid channel-ID characters. Format validation does not verify ownership.

The repository retains legacy-named key variables. Current Supabase guidance recommends publishable client keys and server secret keys; migration must preserve/update the actual readers deliberately.

```bash
node --env-file=.env.sync.local scripts/fetch-youtube.cjs
```

**This consumes quota and writes/updates database metadata. There is no dry-run option.** Do not run against production before schema/security validation.

Missing settings or an absent allowlist fail closed. No guessed channel IDs or channel-title-based official discovery remain.

## 4. GitHub Actions configuration

Two workflows exist:

- `quality.yml`: on push/PR/manual trigger, frozen install → tests → type-gated production build. No credentials required.
- `auto-update.yml`: scheduled at 00:00/12:00 UTC and manually triggerable, but the job is disabled unless `ENABLE_YOUTUBE_SYNC` equals `true`.

Configure privately:

| GitHub setting | Name |
| --- | --- |
| Secret | `YOUTUBE_API_KEY` |
| Secret | `SUPABASE_URL` |
| Secret | `SUPABASE_SERVICE_ROLE_KEY` |
| Repository variable | `YOUTUBE_CHANNEL_IDS` |
| Repository variable | `ENABLE_YOUTUBE_SYNC` — set to `true` only after staging approval. |

The importer workflow serializes writers, grants only `contents: read` to the workflow token, and has a 20-minute timeout. Both workflows use the locally tested Node 24.18.0 and Bun 1.4.2. Action versions are pinned to major tags, not immutable SHAs; a later supply-chain hardening pass may pin audited revisions.

No remote variable, secret, workflow execution, or schedule was changed during remediation.

## 5. Database prerequisites — owner inspection required

There is still no verified migration for the unknown live schema. Use [Data model](DATA_MODEL.md) as a reference checklist, not executable SQL.

Before enabling ingestion:

1. Inspect `videos`, ID defaults, types, existing rows/duplicates, triggers, grants, and RLS.
2. Confirm the legacy importer fields and **`description`** column. The script now refreshes source metadata through UPDATE as well as INSERT.
3. Verify public SELECT grants/policies for the intended archive metadata; deny anonymous writes.
4. Verify privileged SELECT/INSERT/UPDATE access.
5. Reconcile legacy Shorts/watch duplicates and establish stable YouTube-identity uniqueness. Application pre-checks and workflow serialization cannot replace a database constraint.
6. Test one staging import through the selected frontend projection and card link.
7. Review historical all-eight member defaults; they are not overwritten automatically.
8. Version the actual schema/security configuration after inspection rather than inventing a migration over an unknown database.

## 6. Validation/build

```bash
bun run test
bun run lint
bun run build
bun run preview
```

`build` already runs `lint` first. `lint` is TypeScript checking, not ESLint. Preview is normally on port 4173 and is for local inspection, not production hosting.

## Official references

- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Range/pagination](https://supabase.com/docs/reference/javascript/range)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)

Current documentation was consulted during review/remediation. Explicit grants and RLS are separate controls; do not assume a newly created table is publicly exposed or safely protected by default.
