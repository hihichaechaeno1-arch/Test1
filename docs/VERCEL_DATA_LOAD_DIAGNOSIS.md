# Vercel archive-load failure: diagnosis and repair

Inspected 2026-10-04. Changes are local and uncommitted; no production deployment, migration, permission change, or database write was performed.

## Confirmed root cause

The production site, `https://test1-liart-tau.vercel.app`, serves deployment `test1-jzjwb67uq-hi-hi-ondogdog.vercel.app`, built from commit `2612082`. The deployed client requests:

```text
id,title,url,thumbnail,channel,type,published_at,members,description
```

The public Supabase Data API returns **HTTP 400 / PostgreSQL `42703`** because `videos.description` does not exist. The archive reader rejects the response, and `App.tsx` replaces the underlying error with:

> 無法載入完整資料；請檢查公開設定、資料表欄位及讀取權限後重試。

The reload/demo buttons are normal error-state controls, not additional failures. Reloading repeats the same incompatible query; selecting demo does not repair live data access.

The schema mismatch was introduced when commit `b7c014f` added an explicit frontend projection that always selected `description`. The row mapper already supports missing descriptions as blank, but PostgreSQL rejects the SELECT before any rows reach that mapper. No corresponding database migration was verified or applied.

## Read-only evidence

1. The Vercel homepage and deployed JavaScript are reachable. Build-time configuration contains one Supabase project and a **public anon-role key**, not a privileged key. Key values were never printed or written to diagnostic files.
2. Replaying the deployed projection with that public key returns HTTP 400 / `42703`; the missing-description classification is true. The original assertion that this query should succeed failed.
3. Removing only `description`, retaining the same explicit legacy fields, order, and pagination, returns **HTTP 200, seven rows, count `0-6/7`**.
4. All seven rows pass the actual `mapSupabaseRowToVideoItem` validator. No row contents were printed.
5. Executing the repaired `fetchArchiveVideos` through the real Supabase SDK against that same public database returns **seven valid live videos**, with statuses `[400, 200]` and zero writes.

These checks rule out missing public configuration, inaccessible public SELECT, and malformed existing rows as the cause of this particular failure. They do not establish the safety of write policies, RLS configuration, triggers, uniqueness, or importer credentials.

This is separate from the missing GitHub ingestion variables: stopped ingestion can prevent future updates but does not explain the browser's missing-column SQL error.

## Repair

`src/lib/archive.ts` now treats `description` as optional for **browser reads**:

- First request still includes it, preserving description display/search where supported.
- Only an initial PostgreSQL `42703` explicitly naming the absent `description` column permits a retry.
- Retry removes only `description`, retains the same allowlisted identity/metadata fields and deterministic order, and restarts the same first page.
- Subsequent pages use the reduced projection; missing descriptions map to blank strings.
- Retry is bounded to once and allowed only before any rows have loaded.
- Auth/permission/network failures, missing required columns, malformed rows, and mid-read schema changes still reject the archive. No `select('*')`, format guessing, partial success, or automatic demo substitution was added.

No live schema change is needed to restore reads. **Importer writes still require `description`**, so this compatibility repair must not be mistaken for database approval to enable ingestion. Add the column only through an owner-reviewed schema change after inspecting the actual database contract.

## Regression and validation

Seven new tests in `tests/archive.test.ts` exercise the installed Supabase SDK HTTP boundary:

- Legacy and canonical tables without descriptions load every valid page.
- Present descriptions are retained without retry.
- Missing required fields, auth/permission errors, and unrecognized failures do not trigger fallback.
- A failed retry stops instead of looping or substituting samples.
- Missing description after an earlier page fails closed.
- Invalid live identities remain rejected after compatibility retry.

The focused test command failed before the source repair and passes afterward:

```bash
node --import tsx --test tests/archive.test.ts
npm test
npm run build
git diff --check
```

Results: **11 archive tests / 42 total tests passed**; TypeScript checking, Vite production build, and whitespace checks passed on local Node 26.3.0. The repaired reader also passed the live read-only SDK probe described above. No interactive browser test of a newly deployed artifact is claimed.

## Apply to Vercel

The existing hosted bundle remains unchanged until deployment:

1. Review, commit, and push the repair to `main` through the owner's release process. The earlier YouTube workflow repair is also still in the working tree; select/review changes deliberately.
2. Let the connected Vercel project build the new commit, or deploy that reviewed commit using the owner-approved release procedure. Redeploying the old commit without this source change repeats the failure.
3. Confirm production uses the new deployment. The public environment remains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_VIDEO_ROW_FORMAT=legacy`; this diagnosis found no need to replace the current key or relax permissions.
4. Reload the site. Expect a first missing-column response followed by one successful metadata request, a live-data status, and seven valid archive records. Select a member tag to display matching cards; initially no selected members means no result cards by design.
5. Without the column, description search has no description text to match; title/channel/tag/format filtering and playback remain available. When a reviewed migration adds descriptions, the initial full projection will succeed automatically.

No agent memory or skill changes were written.
