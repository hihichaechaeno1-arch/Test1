# Deployment, security, and operations

## 1. Deployment model

The frontend is a static Vite build in `dist/`. Supabase and the enabled importer operate separately. There is no Express/server process or checked-in deployment workflow.

| Host setting | Value |
| --- | --- |
| Framework | Vite/React, not Next.js. |
| Working directory | Repository root. |
| Install | Bun 1.4.2, `bun install --frozen-lockfile`. |
| Build | `bun run build` — includes type-checking. |
| Publish | `dist/`. |
| Environment | Only documented public variables from [Setup](SETUP_CONFIGURATION.md). |

Use HTTPS. Vite base defaults to `/`; subdirectory hosting needs an intentional base change and asset verification. Preview is local inspection, not a production server. There are no deep-link routes beyond the root page.

Environment values are embedded at build time. Changing runtime host variables does not repair an already published bundle; rebuild/redeploy.

## 2. Owner release gates

- [ ] Tests and type-gated build pass on the actual CI runtime.
- [ ] Inspect live table fields, ID defaults, duplicates, grants/RLS, and any triggers.
- [ ] Verify `description` and privileged metadata UPDATE support.
- [ ] Public reads work; anonymous writes are denied.
- [ ] Stable identity is constrained in the database, including legacy URL cleanup.
- [ ] A controlled staging import round-trips through the selected frontend projection and real link.
- [ ] Approved channel IDs have ownership/source evidence.
- [ ] Historical all-eight tags and unsourced data are reviewed.
- [ ] License/image/profile rights are established; see [content register](CONTENT_PROVENANCE.md).
- [ ] Keyboard/screen-reader and representative device/network checks are acceptable.
- [ ] No private credentials are embedded in source/build/public variables.
- [ ] Backup/restore and rollback ownership are documented externally or versioned after live inspection.

Local code repairs do not satisfy external gates automatically. No production release, live migration, or real import was executed during remediation.

## 3. Safe rollout order

1. Verify/code-version the actual database contract and security, using a staging environment.
2. Reconcile duplicate identities and historical metadata with backups in place.
3. Configure public frontend variables and deploy a known build revision.
4. Verify live/empty/error/demo states, tag search, and real playback.
5. Configure private importer secrets and owner-verified `YOUTUBE_CHANNEL_IDS`.
6. Set `ENABLE_YOUTUBE_SYNC=true` only after approval.
7. Inspect the first run's counts, errors, completeness, and actual data freshness.

The ingestion job is deliberately disabled by default. Its schedule/trigger exists, but no live database writer should run solely because the workflow file is present.

## 4. Security boundaries

### Public browser

All frontend code and `NEXT_PUBLIC_`/`VITE_` values are public. Use only publishable/legacy anon client keys. Database grants plus RLS enforce the intended public read surface. The explicit column projection reduces accidental response exposure but is not a substitute for database authorization.

- Enable RLS on exposed tables.
- Grant only intended public SELECT access and appropriate row policies.
- Deny anonymous data writes.
- Keep private notes/personal data outside the public table/API surface.
- Review any views separately; underlying RLS is not automatically sufficient for all view configurations.
- Monitor public read volume and abuse/resource usage.

The actual grants/policies remain unverified; no claim that they are configured safely is made.

### Privileged importer

Service-role/secret keys bypass RLS and must remain in trusted runners/private ignored files. The importer now needs SELECT, INSERT, and UPDATE access. Protect credentials independently of public policy controls.

- Never expose privileged keys under public prefixes.
- Restrict the YouTube key to the intended API/environment where supported.
- Do not publish request URLs containing keys or raw provider/database error details.
- Logs report sanitized event classifications, source IDs, public video IDs, counts, and bounds.
- Workflow token uses `contents: read`; writers serialize and are timeout-bounded.
- Other writers can still race; verified database uniqueness remains required.
- Review dependencies/action revisions; a full vulnerability audit was not performed.

Current provider guidance favors publishable/secret keys; legacy variable names remain for compatibility. Key migration must be deliberate, not an undocumented rename.

### External services/content

| Service | Active purpose |
| --- | --- |
| Configured Supabase project | Public metadata reads. |
| Google Fonts domains | Fonts. |
| Imgur | Existing avatars. |
| Allowed mapped image hosts / YouTube thumbnails | Live video images. |
| YouTube | Navigation from live cards or header. |

Unsplash fallback requests were removed. Demo images are local WebP assets. The dormant modal would use YouTube nocookie embeds only if activated; it is not an active in-page player.

External requests carry privacy/availability implications. No account system, analytics, consent manager, or privacy policy is implemented. The footer is not a legal license or ownership proof.

Text is rendered through React, not raw HTML injection. External links use `noopener noreferrer`; images use `no-referrer`. These protections do not replace metadata validation or RLS.

At the host, consider tested CSP/connect/image/font policies, framing restrictions, and MIME-sniffing protection. No host headers are versioned in this repo; test policies in staging before enforcing them.

## 5. Observability

Current source offers:

- Visible `live`, `demo`, `empty`, `error`, and loading states.
- Structured ingestion events and per-run/channel counts/completeness.
- Nonzero detected-failure exit; separate incomplete-backfill exit.
- Page/request quota bounds and continuation tokens.

Still absent:

- Last successful sync/freshness timestamp in the browser.
- External alerting/structured log retention integration.
- Persistent automatic checkpointing or exhaustive source coverage.
- Frontend exception telemetry and full production health monitoring.

Monitor actual last successful writes, public read/link success, failed request/row counts, quota consumption, and freshness. Zero inserts may mean existing records were updated or no new content; it must not be confused with failures.

## 6. Incident runbooks

### A. Visible live-load error

Check build-time public settings, selected `legacy`/`canonical` projection, required columns, public grants/RLS, invalid source rows, and network response. The app no longer hides errors with samples or an unordered retry. Inspect credentials privately; do not paste them into issue reports.

### B. Empty archive

Check actual row content and whether RLS is filtering everything. Empty read results remain empty. A user can deliberately choose labeled demo, but this does not prove the live configuration is correct.

### C. Incorrect link/thumbnail

Inspect the actual row against [Data model](DATA_MODEL.md), including valid YouTube identity and selected projection. Known legacy fields now map correctly; invalid identity rows fail visibly. Validate real source availability separately from syntax.

### D. Ingestion disabled or failing

First inspect `ENABLE_YOUTUBE_SYNC` and approved `YOUTUBE_CHANNEL_IDS`. If enabled, inspect missing settings, HTTP/API status classification, database-failed events, description/UPDATE schema requirements, and quota/budget. Use staging; repeated production reruns consume quota and may update many rows.

### E. Incomplete backfill

Read `complete`, token, oldest publication timestamp, and exit status. Resume only one channel with the same date window/query. Search limits still prevent an exhaustive guarantee. Do not treat recent-mode exit 0 as a full-history claim.

### F. Incorrect tags

Verify footage manually. New inference is conservative but still text-based; older all-eight defaults persist. Correct records through trusted editorial operations. Source refresh preserves member tags so it does not erase owner corrections, but no admin UI or provenance schema is implemented.

### G. Duplicates/conflicts

Compare stable YouTube IDs and watch/Shorts URL variants. Back up data before reconciliation. Inspect the actual unique constraint and other writers. Unconfirmed uniqueness conflicts fail rather than being counted as success. Serialization protects only this workflow group.

### H. Credential exposure

Disable affected ingestion, revoke/rotate the credential at its provider, replace trusted secret-store values, review access/data integrity, and rebuild public artifacts if affected. Removing text does not revoke a key. Repository-history cleanup must follow the owner's approved procedure. No secret incident was claimed or remediated here.

## 7. Backup and rollback

No backup/restore script or live retention guarantee exists in this repository. Source control cannot restore database rows or external configuration.

Before schema or metadata repairs, obtain a verified backup and capture policies, grants, defaults, constraints, triggers, and row counts. Confirm restore procedures against the actual provider plan.

Frontend rollback republishes a compatible known artifact with matching public configuration. Disable ingestion before data repair. Reverting frontend files does not reverse imported/updated database rows. Owner approval is required for deployment, migration, cleanup, credential rotation, commit, and push.
