# Project documentation

**Current overview:** start with [Current-state analysis](CURRENT_STATE_ANALYSIS.md) (2026-10-19 whole-repo review). For build-repair evidence, use [Vercel build repair and validation](REPAIR_VALIDATION.md). Historical incident reports remain evidence of their specific inspected revisions, not current production status.

## Reading paths

| Audience | Start here |
| --- | --- |
| User | [User guide](USER_GUIDE.md) |
| Developer | [Current-state analysis](CURRENT_STATE_ANALYSIS.md) → [Setup](SETUP_CONFIGURATION.md) → [Architecture](ARCHITECTURE.md) → [Data model](DATA_MODEL.md) → [Testing](DEVELOPMENT_TESTING.md) |
| Data maintainer | [Data model](DATA_MODEL.md) → [YouTube sync](YOUTUBE_SYNC.md) → [Operations](DEPLOYMENT_OPERATIONS.md) |
| Release owner | [Current-state analysis](CURRENT_STATE_ANALYSIS.md) → [Remediation status](REMEDIATION.md) → [Operations](DEPLOYMENT_OPERATIONS.md) → [Content register](CONTENT_PROVENANCE.md) |

## Document map

- [Current-state analysis](CURRENT_STATE_ANALYSIS.md): 2026-10-19 architecture, stack, flows, test inventory, doc drift, risks, and owner actions.
- [Current repair/validation](REPAIR_VALIDATION.md): verified build repair, current contracts, clean installation, browser runner, release checklist, and residual risks.
- [51-finding baseline review](COMPREHENSIVE_REVIEW.md): whole-repository findings at `2b61799`, before this repair.

- [Remediation status](REMEDIATION.md): issue-by-issue code fixes, verification, and remaining blockers.
- [User guide](USER_GUIDE.md): active behavior and unverified-tag semantics.
- [Architecture](ARCHITECTURE.md): runtime boundaries, file inventory, state, interfaces, and data flow.
- [Setup/configuration](SETUP_CONFIGURATION.md): pinned tooling, public/private variables, database prerequisites.
- [Data model](DATA_MODEL.md): legacy/canonical fields, validation, sample identity, and schema requirements.
- [YouTube synchronization](YOUTUBE_SYNC.md): approved channels, discovery, refresh, limits, failures, and resume.
- [YouTube workflow skip diagnosis](YOUTUBE_SYNC_DIAGNOSIS.md): verified GitHub run history, missing-variable root cause, preflight repair, and activation requirements.
- [Vercel data-load diagnosis](VERCEL_DATA_LOAD_DIAGNOSIS.md): confirmed missing-description schema mismatch, backward-compatible reads, live read-only evidence, and redeployment requirements.
- [Verified YouTube channels](YOUTUBE_CHANNELS.md): first-party verification of all 13 owner-supplied URLs, live GitHub variable updates, and outstanding importer/schema risks.
- [YouTube write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md): run `37210961443`, 850 failed writes, optional-description compatibility, and sanitized database diagnostics.
- [Description-column migration](VIDEOS_DESCRIPTION_MIGRATION.md): owner-requested nullable text column, tested standalone migration, production-access blocker, and verification steps.
- [Deployment/operations](DEPLOYMENT_OPERATIONS.md): security, rollout, incidents, backups, and rollback.
- [Development/testing](DEVELOPMENT_TESTING.md): tests, checks, browser validation, and remaining coverage.
- [Original project review](PROJECT_REVIEW.md): historical findings at baseline commit.
- [Content/licensing register](CONTENT_PROVENANCE.md): known content origins and required owner evidence.

## Evidence and boundaries

The original review analyzed commit `d93b74b1035af155e08902877b8cc046c14649b9` on 2026-10-02. Source remediation was then applied in the documented issue order. The owner subsequently committed/pushed the prior repairs in `fecf14c` and ran the workflow. The newest importer compatibility/error-diagnostic repair remains local; see [write-failure diagnosis](YOUTUBE_WRITE_FAILURE_DIAGNOSIS.md).

Current implementation documents describe the modified working tree. The original review is historical, not a list of still-unfixed code defects. [Repair validation](REPAIR_VALIDATION.md) is authoritative for the current working-tree repair scope and verification. [Remediation status](REMEDIATION.md) retains the earlier 15-issue lineage.

Validation includes local regression tests, type-checking/build, frozen Bun installation, a clean npm diagnostic installation, and mocked Chromium browser checks. No live Supabase schema, database policy, production data, deployment, or channel ownership was verified. The later [skip diagnosis](YOUTUBE_SYNC_DIAGNOSIS.md) inspected GitHub run history, repository variables, and secret names read-only; no credential values were retrieved. No real YouTube import was executed. The subsequent [Vercel diagnosis](VERCEL_DATA_LOAD_DIAGNOSIS.md) performed read-only requests with the deployed browser's public anon key, confirming seven valid legacy rows and an absent optional description column. No database values or keys were printed, and no database writes, migrations, or deployments were performed.

Classifications:

- **Implemented locally:** source/configuration changed and tested within available boundaries.
- **Partial:** code mitigations exist, but external constraints or broader coverage are still needed.
- **Blocked on owner:** ownership, credentials, database inspection/migration, or product targets are required.

## Terminology

| Term | Current meaning |
| --- | --- |
| Member | One of eight canonical `MemberName` values. |
| Member tag | Stored/inferred association, not verified on-screen presence. |
| AND filter | Every selected tag must be included; additional tags are allowed. |
| Format | `video` or `shorts`; separate from category. |
| Demo | Sixteen illustrative fixtures, sorted newest-first and rendered without playback links. |
| Recent scan | A quota-bounded newest-first YouTube search, not complete history coverage. |
| Backfill | An explicit older date window, with bounded pages and manual token resume. |
| Public client key | Publishable/legacy anon Supabase key protected by grants and RLS. |
| Privileged key | Secret/legacy service-role key reserved for trusted importer execution. |

## Maintenance

Update docs whenever fields, variables, dependency tooling, schedule, UI behavior, or external requirements change. Maintain each issue's status and validation evidence. Do not describe a database or ownership requirement as resolved solely because local mocks pass.
