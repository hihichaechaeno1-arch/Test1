# Auto Update YouTube Videos: skipped-run diagnosis

Inspection date: 2026-10-04. The initial diagnosis below used read-only GitHub inspection. Source repairs are local and uncommitted; no workflow was dispatched or live import performed.

**Follow-up:** after this diagnosis, the owner explicitly requested activation. All 13 supplied channel URLs were verified and both repository variables were applied/read back from GitHub. The missing-variable skip is resolved remotely; importer database readiness remains unverified and the browser database is known to lack `description`. See [channel register and activation evidence](YOUTUBE_CHANNELS.md).

## Finding

The scheduler and manual trigger work. The entire `update-videos` job was skipped by this condition:

```yaml
if: ${{ vars.ENABLE_YOUTUBE_SYNC == 'true' }}
```

The repository has **no Actions repository variables**, so `ENABLE_YOUTUBE_SYNC` resolves to an empty string. It is not equal to `true`. GitHub evaluates the job condition before provisioning a runner; consequently no checkout, installation, or importer code executes. `workflow_dispatch` does not bypass a job condition.

The allowlist variable `YOUTUBE_CHANNEL_IDS` is also missing. Merely setting the enable flag or deleting the condition would expose a second configuration failure in `loadConfig`, not restore ingestion.

## Verified evidence and timeline

| Evidence | Observation |
| --- | --- |
| Last successful run examined | `37021227123`, manual, 2026-10-02 14:38:02 UTC, commit `d93b74b`; job steps executed. Success status alone does not establish correctness of imported data. |
| Change introducing the gate | `b7c014f`, 2026-10-02 17:24:24 UTC (October 3, 01:24:24 +0800). Its workflow diff adds `ENABLE_YOUTUBE_SYNC`, and passes the newly required channel allowlist to the rewritten importer. |
| First skipped run in retrieved history | `37081838984`, scheduled, 2026-10-03 00:23:04 UTC. |
| Subsequent skips | Two more scheduled runs and two manual runs, through 2026-10-04 13:27:47 UTC: all five post-change runs were skipped. |
| Latest run | [`37205699541`](https://github.com/hihichaechaeno1-arch/Test1/actions/runs/37205699541), manual, commit `2612082`; `update-videos` has `conclusion: skipped` and `steps: []`. |
| Repository metadata | Default branch `main`; not archived, disabled, or a fork. |
| Repository variables API | Returns an empty list. Neither `ENABLE_YOUTUBE_SYNC` nor `YOUTUBE_CHANNEL_IDS` exists. |
| Secret names | `YOUTUBE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` exist. Values, validity, provider permissions, and database readiness were not inspected. |

Read-only commands used included:

```bash
gh run list --workflow auto-update.yml --limit 20 \
  --json databaseId,event,conclusion,headBranch,createdAt
gh run view 37205699541 --json jobs,headSha,event,conclusion
gh api repos/hihichaechaeno1-arch/Test1/actions/variables
gh secret list --json name
git show b7c014f -- .github/workflows/auto-update.yml
```

The original reproduction evaluated the actual gate with repository-variable API results: both `schedule` and `workflow_dispatch` reported `skipped`; the assertion that the job would run failed (`false !== true`). The permanent regression command is `node --test tests/youtubeWorkflow.test.cjs`. It failed on the original job-level condition and now passes.

## Why this happened

The October 2 change introduced a deliberate safety gate alongside importer hardening. Existing documentation requires database/schema/security inspection, staging approval, and independently verified channel IDs. However, the necessary repository configuration was never supplied. Putting that approval check at **job level** turned an actionable configuration problem into a zero-step skip with no diagnostic output.

This is a configuration rollout omission plus an observability defect, not a cron, dependency, API, database, or concurrency failure:

- GitHub created both scheduled and manual runs, ruling out a missing trigger as the cause of these runs.
- No runner steps executed, so package installation and API/database operations cannot explain this skip.
- The run conclusions are `skipped`, not failed/canceled, and the absent variable directly reproduces the condition.
- Earlier credential secrets do not populate the separate `vars.*` namespace.
- Rerunning the workflow without changing configuration repeats the same condition.

## Local repair

1. Remove the job-level `if`, so every trigger reaches a diagnostic step.
2. Run `scripts/check-youtube-sync.cjs` after checkout/Node setup and **before Bun setup or dependency installation**.
3. Require the same exact approval value (`true`), explicit channel allowlist, and three credential settings. Report all missing settings together.
4. Reuse the importer's `loadConfig` for channel-ID syntax validation without loading the Supabase SDK or performing network/database activity.
5. Emit sanitized GitHub error annotations and a run summary. Blocked configuration exits 1; normal Actions step sequencing prevents installation/import after failure.
6. Keep approval, source allowlisting, secret scoping, serialized writers, read-only workflow-token permissions, and the timeout intact. Manual dispatch is not an approval bypass.
7. Add eight dependency-free regression tests and include them in `npm test` / quality CI.

After deployment, the current missing-variable configuration will produce a **visible configuration failure**, not a successful import. When all approved settings are present, preflight succeeds and the existing importer executes. Syntax/presence validation is not proof of credential validity, ownership, or database safety.

## Required activation steps

1. Complete the database and staging checklist in [setup](SETUP_CONFIGURATION.md#5-database-prerequisites--owner-inspection-required). The importer requires `description`, privileged UPDATE access, stable identity/uniqueness, and reviewed security policies.
2. Independently verify allowed YouTube channel identities and content rights. Do not restore guessed IDs or title-based identity discovery.
3. In **Settings → Secrets and variables → Actions → Variables**, create repository variable `YOUTUBE_CHANNEL_IDS` containing the verified comma-separated IDs (`UC` followed by 22 valid characters).
4. After approval, create repository variable `ENABLE_YOUTUBE_SYNC` with the exact value `true`. Do not create these as secrets or environment-only variables; this workflow reads repository `vars` and specifies no GitHub environment.
5. Commit and push the local repair to `main` under the owner's release process.
6. Run the workflow manually once; inspect preflight, importer counts/errors, and actual database results. Scheduled execution remains 00:00/12:00 UTC (08:00/20:00 Hong Kong time), subject to GitHub scheduling delays.

For an intentional pause, disable the workflow in Actions. An unset/false approval variable also stops writes, but the repaired workflow will report configuration failures on each trigger rather than silently skip.

## Validation and remaining limits

- Original regression: eight tests failed before the repair; eight pass afterward.
- `npm test`: **35 tests passed**, zero failures/skips, including importer SDK-boundary tests and the new workflow tests.
- `npm run build`: TypeScript checking and Vite production build passed. These tests/build ran on local Node 26.3.0; the workflow's pinned Node 24.18.0 runner was not executed during this task.
- Frozen Bun 1.4.2 installation passed via `npm exec --yes --package=bun@1.4.2 -- bun install --frozen-lockfile --ignore-scripts`; existing dependency versions and lockfile were unchanged. Local dependency lifecycle scripts were intentionally disabled.
- Ruby YAML parsing verified the workflow structure, absence of a job-level gate, and preflight-before-install ordering.
- `node --check scripts/check-youtube-sync.cjs` and `git diff --check` passed.

After this initial diagnosis, the owner committed/pushed the earlier repairs in `fecf14c` and manually executed the workflow. The supplied variables resolved the skip, but run `37210961443` had 850 database write failures and zero successful writes. The known absent optional `description` column is the leading cause; the newer local compatibility/error-code repair is documented in [write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md). No successful live import, privileged credential validation, or production database change by the agent is claimed. No agent memory or skill changes were written.
