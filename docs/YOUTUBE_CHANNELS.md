# Approved YouTube channels and GitHub activation

Verified on **2026-10-04 at 14:38 UTC**, following the owner's explicit request to configure these 13 sources and enable GitHub ingestion.

## First-party identity verification

Each supplied YouTube URL was fetched directly. Its `ytInitialData.metadata.channelMetadataRenderer.externalId` was checked against both the channel's canonical URL and `microformatDataRenderer.urlCanonical`. Handle URLs were checked against `vanityChannelUrl`, ignoring only case; the supplied Running Man channel URL was checked against the exact returned ID. All requests returned HTTP 200, and all 13 IDs are distinct.

The following source links are the actual primary sources used; the IDs link to YouTube's canonical channel pages. This verifies the supplied URL-to-ID mapping, not content licensing or the operator's legal identity.

| Requested channel / primary source | Verified channel ID |
| --- | --- |
| [Hearts2Hearts](https://www.youtube.com/@hearts2hearts.official) | [UC7Q3HUnJA3nvjZR2JeMn2Cw](https://www.youtube.com/channel/UC7Q3HUnJA3nvjZR2JeMn2Cw) |
| [SBSKPOP X INKIGAYO](https://www.youtube.com/@SBSKPOP) | [UCS_hnpJLQTvBkqALgapi_4g](https://www.youtube.com/channel/UCS_hnpJLQTvBkqALgapi_4g) |
| [SBSKPOP ZOOM](https://www.youtube.com/@SBSKPOP_ZOOM) | [UCM3jwNRfl5-W8VzgT6DsaEQ](https://www.youtube.com/channel/UCM3jwNRfl5-W8VzgT6DsaEQ) |
| [KBS Kpop](https://www.youtube.com/@KBSKpop) | [UCeLPm9yH_a_QH8n6445G-Ow](https://www.youtube.com/channel/UCeLPm9yH_a_QH8n6445G-Ow) |
| [MBCkpop](https://www.youtube.com/@MBCkpop) | [UCe52oeb7Xv_KaJsEzcKXJJg](https://www.youtube.com/channel/UCe52oeb7Xv_KaJsEzcKXJJg) |
| [Mnet K-POP](https://www.youtube.com/@mnet) | [UCbD8EppRX3ZwJSou-TVo90A](https://www.youtube.com/channel/UCbD8EppRX3ZwJSou-TVo90A) |
| [THE K-POP](https://www.youtube.com/@thekpop) | [UCoRXPcv8XK5fAplLbk9PTww](https://www.youtube.com/channel/UCoRXPcv8XK5fAplLbk9PTww) |
| [ALL THE K-POP](https://www.youtube.com/@allthekpop) | [UCPde4guD9yFBRzkxk2PatoA](https://www.youtube.com/channel/UCPde4guD9yFBRzkxk2PatoA) |
| [STUDIO CHOOM](https://www.youtube.com/@STUDIOCHOOM) | [UCEIi7zFR_wE23jFncVtd6-A](https://www.youtube.com/channel/UCEIi7zFR_wE23jFncVtd6-A) |
| [아는형님 Knowingbros](https://www.youtube.com/@knowingbros) | [UCOHM2N1YQdb-cHWxJxwBMLQ](https://www.youtube.com/channel/UCOHM2N1YQdb-cHWxJxwBMLQ) |
| [JTBC Entertainment](https://www.youtube.com/@jtbcentertainment) | [UCFL1sCAksD6_7JIZwwHcwjQ](https://www.youtube.com/channel/UCFL1sCAksD6_7JIZwwHcwjQ) |
| [런닝맨 - 스브스 공식 채널](https://www.youtube.com/channel/UCaKod3X1Tn4c7Ci0iUKcvzQ) | [UCaKod3X1Tn4c7Ci0iUKcvzQ](https://www.youtube.com/channel/UCaKod3X1Tn4c7Ci0iUKcvzQ) |
| [SBS Entertainment](https://www.youtube.com/@SBSenter.official) | [UCmjNKt6kITwaZTqvWuaSPLg](https://www.youtube.com/channel/UCmjNKt6kITwaZTqvWuaSPLg) |

YouTube's returned display title for STUDIO CHOOM includes `[스튜디오 춤]`. Handle capitalization differs for Mnet, ALL THE K-POP, Knowingbros, and JTBC Entertainment; the handle identity checks match case-insensitively. Running Man's returned handle is `@SBSRunningMan`.

The machine-readable evidence snapshot is [`config/youtube-channels.json`](../config/youtube-channels.json). It is not an implicit importer fallback: the workflow still reads the explicit GitHub variable.

## Live GitHub changes applied

Repository: `hihichaechaeno1-arch/Test1`.

- Repository variable `YOUTUBE_CHANNEL_IDS` was set to the 13 verified IDs joined with commas, in the table's order.
- Repository variable `ENABLE_YOUTUBE_SYNC` was set to the exact value `true`, as explicitly requested.
- Both values were read back from the GitHub API and asserted to match the local manifest/enable value exactly. GitHub also confirmed the workflow state is `active`.
- Existing secrets, cron schedule, permissions, and concurrency were unchanged. Neither a workflow dispatch nor a database operation was performed.

The workflow already consumes these repository variables. The remote configuration update is effective immediately; it does not require committing the manifest. The old job-level approval condition will now evaluate true rather than skip. The owner subsequently committed/pushed the earlier preflight/frontend repairs in `fecf14c` and ran the workflow. That run had 850 failed database writes. The newer optional-description compatibility/error-diagnostic repair remains local; see [write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md).

To repeat the configuration intentionally after reviewing the manifest:

```bash
CHANNEL_IDS="$(node -e 'process.stdout.write(require("./config/youtube-channels.json").channels.map(c => c.channelId).join(","))')"
gh variable set YOUTUBE_CHANNEL_IDS --repo hihichaechaeno1-arch/Test1 --body "$CHANNEL_IDS"
gh variable set ENABLE_YOUTUBE_SYNC --repo hihichaechaeno1-arch/Test1 --body true
```

These commands alter live repository configuration; they are not a dry run.

## Known blockers and limits

**Enabled is not the same as verified successful ingestion.** The prior [Vercel diagnosis](VERCEL_DATA_LOAD_DIAGNOSIS.md) established that the deployed browser's Supabase database lacks `description`. At activation, the importer unconditionally wrote that column and lacked the browser's compatibility behavior. The newer local importer repair recognizes a confirmed missing optional description column and retries without it, explicitly reporting the omission; other write failures still fail. See [write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md). Importer secret values/database target were not inspected, and the broader schema, grants, ID default, uniqueness, and security readiness remain unverified. No migration was authorized by this configuration request.

The schedule remains 00:00/12:00 UTC (08:00/20:00 Hong Kong time); scheduled runs can now execute. Manual import was deliberately not triggered because of the known schema risk. Review/push the newer importer repair and address any remaining database readiness failures before expecting successful writes, or explicitly disable the workflow while completing that work.

The default three-page/channel and 39-request/run budget is unchanged. With 13 channels, three requests each can use the entire budget; retries may leave later scans incomplete. Two scheduled runs can consume up to 78 attempts/day. This remains a bounded Hearts2Hearts search within approved channels, not an import of every video from those channels or a full-history guarantee.

## Validation

- All 13 channel IDs were resolved from first-party metadata and checked for syntax, canonical agreement, source-URL agreement, and uniqueness.
- GitHub variable readback exactly matched the manifest and `true`.
- A regression test checks the 13-channel manifest against the actual importer configuration loader and workflow preflight without performing network writes.
- All 43 repository tests, TypeScript checking, production build, register/manifest agreement, local documentation links, and `git diff --check` passed.
- No agent memory or skill changes were written.
