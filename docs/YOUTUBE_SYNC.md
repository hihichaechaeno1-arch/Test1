# YouTube synchronization

## 1. Execution boundary

[`scripts/fetch-youtube.cjs`](../scripts/fetch-youtube.cjs) exports `detectMembers`, `loadConfig`, and `syncVideos` for regression testing. Importing the module does not start ingestion or require credentials. Executing it as a CLI requires `ENABLE_YOUTUBE_SYNC` to equal exactly `true`, then loads configuration, creates the privileged Supabase client, runs the bounded scan, prints a summary, and sets an exit code.

No real import was run during remediation. Local tests mock external HTTP/database services.

## 2. Approved channels and configuration

Required private settings:

```text
YOUTUBE_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
YOUTUBE_CHANNEL_IDS
```

`YOUTUBE_CHANNEL_IDS` is a comma-separated allowlist of IDs, each `UC` plus 22 valid characters. The owner must independently verify identity/ownership. The old hardcoded broadcaster list and global official-title search were removed; no guessed replacement ID was introduced.

Every search specifies an approved `channelId`. Every accepted snippet must return that exact ID. A same-name unapproved channel cannot pass the identity check.

For GitHub, use the three credential secrets and the channel-ID repository variable. Set `ENABLE_YOUTUBE_SYNC=true` only after staging/database verification. Every scheduled/manual job now executes [`scripts/check-youtube-sync.cjs`](../scripts/check-youtube-sync.cjs) before dependency installation. This dependency-free preflight reuses `loadConfig`, checks explicit approval, and reports missing/invalid settings through error annotations and `GITHUB_STEP_SUMMARY`, without revealing values or contacting YouTube/Supabase. Blocked configuration exits 1 and prevents ingestion; it no longer silently skips the entire job. Manual triggers do not override approval.

On the initial 2026-10-04 inspection, both repository variables were absent; all three secret names existed. Following the owner's explicit subsequent request, 13 channel IDs were verified from YouTube metadata, `YOUTUBE_CHANNEL_IDS` was set, and `ENABLE_YOUTUBE_SYNC=true` was applied and read back from GitHub. See [verified channels and live configuration](YOUTUBE_CHANNELS.md) and the historical [skip diagnosis](YOUTUBE_SYNC_DIAGNOSIS.md).

The owner subsequently committed the prior repairs in `fecf14c` and manually ran the workflow. Run `37210961443` completed YouTube discovery but reported 847 insert and 3 update failures. The old logs omitted database error codes; the missing `description` column remains the leading diagnosis, not a conclusively decoded provider error. The subsequent local importer repair supports that optional column's absence and preserves sanitized codes for other failures. See [write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md). No migration or live import was performed by the agent.

## 3. Schedule and dependency installation

- Schedule: `0 0,12 * * *` — 00:00/12:00 UTC, 08:00/20:00 Hong Kong time.
- Manual trigger: `workflow_dispatch`.
- Node 22 and Bun 1.4.2; frozen lockfile installation.
- Scheduled/manual workflow runs use `--mode=recent --max-pages=3 --max-requests=39`. The unsafe full-history/playlist workflow choices were removed; explicit bounded backfills use the trusted CLI.
- Workflow token: `contents: read` only.
- Concurrency group serializes scheduled/manual writers; current work is not canceled by a queued run.
- Timeout: 20 minutes.

Scheduled workflows use the default branch and may be delayed/disabled by GitHub rules. This workflow is not a deployment pipeline.

## 4. Recent scan and backfill CLI

Default execution is a bounded recent scan:

```bash
node --env-file=.env.sync.local scripts/fetch-youtube.cjs
```

Available options use `--name=value` syntax:

| Option | Default / constraint |
| --- | --- |
| `--mode=recent` or `backfill` | `recent`; backfill requires `published-before`. |
| `--max-pages=N` | 3 pages per channel; positive integer. |
| `--max-requests=N` | 39 actual search requests per run, including retries; 1–99. |
| `--published-after=TIMESTAMP` | Optional lower date bound. |
| `--published-before=TIMESTAMP` | Optional upper bound; required for backfill. |
| `--page-token=TOKEN` | Manual continuation, only with exactly one configured channel. |

Timestamps must be valid UTC ISO timestamps. Lower bound must precede upper bound. Example staging backfill:

```bash
node --env-file=.env.sync.local scripts/fetch-youtube.cjs \
  --mode=backfill --published-before=2026-10-01T00:00:00Z --max-pages=3
```

Each channel summary reports `pages`, `complete`, `nextPageToken`, and `oldestPublishedAt`. Save the output if manually backfilling. To continue an incomplete channel, configure only that channel and reuse its token with **the same date window/query**:

```bash
node --env-file=.env.sync.local scripts/fetch-youtube.cjs \
  --mode=backfill --published-before=2026-10-01T00:00:00Z --page-token=YOUR_SAVED_TOKEN
```

Tokens are subject to API validity and changing results. There is no automatic persistent checkpoint or complete-history guarantee. The search API itself limits channel search coverage for this request shape. Define a uploads-playlist/checkpoint strategy separately if exhaustive history is required.

## 5. Discovery and record processing

1. Validate settings, channel IDs, options, and windows.
2. Search `youtube/v3/search` with `part=snippet`, `maxResults=50`, `order=date`, `type=video`, `q=Hearts2Hearts`, and an approved channel ID.
3. Follow pages within both per-channel and global request budgets.
4. Reject invalid video IDs, different source IDs, or invalid source dates/titles.
5. Keep group-token or explicit member-name associations from title/description.
6. Infer member tags using Unicode-aware alias boundaries; unknown stays empty.
7. Use the shared content classifier for Shorts/challenge evidence; this is heuristic, not definitive format/aspect-ratio verification. A generic refresh preserves an existing Shorts type or legacy Shorts URL instead of downgrading it.
8. Lookup canonical watch and legacy Shorts URLs for the video ID.
9. Insert a new canonical watch URL with tags and description, or refresh existing source metadata without overwriting editorial member tags.
10. Report all relevant counts and whether each channel's result set finished.

Channels/items are processed sequentially. Existing source metadata is refreshed, but availability, deletion, duration, view metrics, and member verification are not synchronized.

## 6. Aliases and tag limitations

| Canonical name | Aliases |
| --- | --- |
| Carmen | `carmen`, `카르멘` |
| Jiwoo | `jiwoo`, `지우` |
| Yuha | `yuha`, `유하` |
| Stella | `stella`, `스텔라` |
| Juun | `juun`, `준` |
| A-na | `a-na`, `a_na`, `ana`, `아나`, `에이나` |
| Ian | `ian`, `이안` |
| Ye-on | `ye-on`, `ye_on`, `yeon`, `예온` |

Aliases require boundaries outside Unicode letters/numbers. Hashtags work. Incidental words such as `piano`, `banana`, and `준비` no longer match. This conservative rule may miss attached Korean particles or other variants; missed tags are safer than fabricated verified appearances.

Text/description association is not proof of actual visual presence. The UI labels tags as unverified. Existing historical all-eight defaults remain until the owner reviews/corrects them; source refresh deliberately preserves stored tags.

## 7. Identity and duplicate protection

Both formats store `https://www.youtube.com/watch?v={id}`. Legacy `/shorts/{id}` records are recognized and normalized during refresh.

A unique-conflict response is treated as an already-inserted record only after a lookup confirms the same canonical URL. An unrelated conflict still counts as failure.

**Required external work:** inspect legacy duplicates and enforce stable YouTube-identity uniqueness in the real database. Workflow serialization only protects writers in this concurrency group; it does not replace a database constraint or protect against other applications.

The table must have the required legacy identity/metadata fields, a valid ID default, and privileged UPDATE permission for source refresh. `description` is optional for compatibility: a write rejected specifically for that absent column is retried once without it, and subsequent writes in the run omit it. The summary reports `metadataOmissions: ["description"]` and a `schema-compatibility` warning. Source description text still participates in filtering/tag inference, but is not stored when omitted. Other errors still fail. Add the column through a reviewed migration if persisted description/search is required. See [Data model](DATA_MODEL.md).

## 8. Errors, retries, and exit codes

- HTTP status/API errors and malformed JSON are checked.
- HTTP requests have a 15-second timeout.
- Network, 429, and 5xx failures get up to three attempts with short exponential delays.
- Every attempt counts against the run-wide quota budget; retry loops cannot exceed it.
- Lookup, insert, and update failures are reported as structured `database-failed` events with operation, standardized error code, and sanitized reason; lookup failure never proceeds blindly to insert.
- Only a confirmed absent optional `description` column (`PGRST204` / `42703` with the exact recognized table/column message) permits one retry of a rejected write. Failed retries, permissions, required columns, constraints, and zero-row updates remain failures.
- Configuration preflight reports all missing settings and absent approval before installing dependencies. Only a successful preflight allows the importer step to execute.
- Logs omit credentials, request URLs, raw provider response messages, and private database details.
- Summary contains `inserted`, `updated`, `skipped`, `failed`, `requests`, channel completeness, and `metadataOmissions`. `complete` describes search pagination, not database-write success.

| Exit code | Meaning |
| --- | --- |
| 0 | No detected errors; recent mode may intentionally remain bounded/incomplete. |
| 1 | Invalid configuration or at least one API/database/budget failure. |
| 2 | Backfill has no errors but is incomplete and needs continuation. |

A legitimate no-new-content run can succeed. A completion summary is not a claim of exhaustive archive coverage.

## 9. Quota and coverage

Inspect the current Google project's quota buckets, per-operation costs, and daily limits before enabling scheduled/backfill runs. No live quota was verified during this repair, and a request-count bound is not a guarantee that provider quota is sufficient.

Default maximum is 39 **attempts** per run, so two scheduled runs can use up to 78 search attempts. Backfill and other applications share the project's allocation. Budget exhaustion is visible, not silently treated as complete.

The API documents a 500-video channel-search cap for the request shape used here. Page/request bounds may be lower. No claim of complete catalog coverage is made.

## References

- [YouTube search.list](https://developers.google.com/youtube/v3/docs/search/list)
- [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Supabase key guidance](https://supabase.com/docs/guides/api/api-keys)
