# Data model and integration contract

## 1. Scope and source of truth

- [`src/types.ts`](../src/types.ts): domain types.
- [`src/lib/videoData.ts`](../src/lib/videoData.ts): pure external-row validation/legacy adapter.
- [`src/lib/videoMetadata.cjs`](../src/lib/videoMetadata.cjs): shared dependency-free member aliases, YouTube identity parsing, and content classification.
- [`src/lib/archive.ts`](../src/lib/archive.ts): public projections and pagination.
- [`src/data/h2hData.ts`](../src/data/h2hData.ts): member data and demo fixtures.
- [`scripts/fetch-youtube.cjs`](../scripts/fetch-youtube.cjs): discovery/write contract.

The original remediation did not inspect the live database. On 2026-10-04, read-only requests using the deployed browser's public anon key confirmed seven valid legacy rows and an absent `description` column; see [Vercel load diagnosis](VERCEL_DATA_LOAD_DIAGNOSIS.md). This is not a full schema/security audit. Defaults, triggers, write permissions, RLS configuration, uniqueness, and generated columns remain unverified.

## 2. Member contract

`MemberName` is the canonical case-sensitive union:

```text
Carmen | Jiwoo | Yuha | Stella | Juun | A-na | Ian | Ye-on
```

`Member` contains string fields `id`, `name`, `koreanName`, `role`, `birthday`, `mbti`, `accentColor`, `avatarBg`, `charm`, and `bio`, plus optional `imageUrl`.

The active selector uses names, Korean labels, avatar/fallback, and selection state. Profile facts are unsourced repository content used by dormant components; see [content register](CONTENT_PROVENANCE.md).

Member names appear in types, profile/sample data, presets, importer aliases, and database records. Renaming them requires an intentional coordinated migration.

## 3. Video contract

`VideoType = 'video' | 'shorts'`.
`VideoGenre = 'mv' | 'shorts' | 'stage' | 'original' | 'other'` drives the five active content tabs. `VideoCategory` additionally accepts legacy `all/dance/vlog/variety` metadata; it is not used as an ownership assertion. Derived `genre` is optional for fixtures and computed at the mapping/UI boundary. `getVideoGroup` returns a genre code, not the removed four-group official-source model.

`MemberMatchMode = 'including' | 'only' | 'AND' | 'OR'`; the active UI uses including/all-selected and only/exact-stored-tag-set. `SortOrder = 'new' | 'old' | 'popular'`; unknown dates remain last. Popularity is disabled in the UI if usable counts are absent.

| Field | Type | Use |
| --- | --- | --- |
| `id` | string | Stable React identity. |
| `title` | string | Display/search. |
| `type` | VideoType | Normalized video/Shorts format metadata, not verified aspect ratio. |
| `genre` | optional VideoGenre | Derived content category for tabs, badges, and keyword matching. |
| `category` | VideoCategory | Retained legacy metadata. |
| `channel` | string | Display/search. |
| `members` | MemberName[] | Inclusive AND tag filtering. |
| `duration` | string | Display only; missing shows `未提供`. |
| `publishedAt` | string | ISO date or blank/unknown. |
| `views` | string | Optional display text, not numeric analytics. |
| `thumbnailUrl` | string | HTTPS image URL; invalid/unsafe values use the YouTube thumbnail fallback. |
| `youtubeId` | string | Valid 11-character YouTube identity. |
| `description` | string | Display/search. |
| `highlightNote` | optional string | Editorial highlight. |
| `isSample` | optional boolean | Demo rendering disables playback. |

Member tags are unverified associations. There is no verified-appearance schema or UI mode. Existing/manual tags are preserved during source refresh and browser mapping, including explicit empty arrays; title/description inference never replaces them. Missing browser member metadata stays empty. Preservation does not prove correctness, and no historical all-eight cleanup is automatic.

## 4. Row normalization

`mapSupabaseRowToVideoItem(value: unknown)` rejects nonobject rows, missing/invalid playback identity, unsupported formats, malformed member JSON, and impossible nonempty dates. Invalid required metadata results in a visible archive-load error rather than publishing partial/misleading data.

| Output | Accepted input | Default/validation |
| --- | --- | --- |
| `youtubeId` | Valid `youtube_id`, `youtubeId`, or known YouTube `url`. | Reject if no valid identity. |
| `thumbnailUrl` | `thumbnail_url`, `thumbnailUrl`, `thumbnail`. | HTTPS without embedded credentials; otherwise derive YouTube `hqdefault.jpg`. |
| `id` | String or numeric `id`. | Stable YouTube ID if missing; never random. |
| `title` | String `title`. | `無標題影片`; wrong types are not passed to rendering. |
| `type` | `type`, lowercased. | `video` if absent; normalize prior importer `mv/stage/original/other` values to video while retaining derived genre; reject other invalid nonempty values. |
| `category` | Supported string category. | `all` for absent/invalid. |
| `channel` | String `channel`. | `未提供頻道名稱`, not an invented official source. |
| `members` | Array, JSON-array string, comma-separated string. | Canonicalize aliases/case, trim, ignore unrecognized names, deduplicate; unknown stays empty and malformed JSON rejects. |
| `publishedAt` | `published_at` or `publishedAt`. | ISO date prefix; absent stays blank; invalid nonempty date rejected. |
| `description` | String. | Blank for missing/wrong type. |
| `duration` / `views` | Strings; numeric nonnegative finite views also accepted. | `未提供` / blank. Localized view counts are parsed for sorting, not invented from channel names. |
| `highlightNote` | `highlight_note` or `highlightNote`. | Optional string. |

`getYoutubeId(value)` recognizes exact IDs, `youtu.be/{id}`, and `/watch`, `/shorts`, `/embed`, `/live` forms on exact supported YouTube hosts. Arbitrary hosts containing a `v` query parameter are rejected. These checks validate syntax/domain, not video availability or ownership.

## 5. Public database projections

The frontend never selects `*`.

| Mode | Exact selected columns |
| --- | --- |
| `legacy` (default) | `id,title,url,thumbnail,channel,type,published_at,members,description` |
| `canonical` | `id,title,youtube_id,thumbnail_url,channel,type,published_at,members,description` |

Set `NEXT_PUBLIC_VIDEO_ROW_FORMAT` deliberately to match the actual table. `description` is optional for browser reads: if the initial query returns PostgreSQL `42703` specifically identifying that missing column, the reader retries once with only `description` removed and uses that same reduced projection for subsequent pages. The mapper represents absent descriptions as blank; other valid metadata, live playback, and filtering remain available. The reader does not switch legacy/canonical formats automatically.

Missing required columns, auth/permission errors, unrecognized failures, malformed rows, and schema changes after rows have already loaded still cause a visible error. The fallback never selects `*` or substitutes demo data. Optional duration/views/category/highlights are supported by the mapper but not requested by these minimal public projections; extend the allowlist explicitly after verifying actual public schema requirements.

`fetchArchiveVideos` requests 100-row ranges with exact count, orders by publication date descending and ID ascending, advances by **actual returned length**, and continues until the count/end is reached. A server cap below 100 therefore does not hide later records. When count is absent, it continues to an empty page. Errors reject partial results. Cancellation and a 30-second default timeout are supported.

Offset pagination is not a transactional snapshot: concurrent edits may move records while reading. Very large archives may need cursor/server-side filtering rather than loading everything into memory; no unlimited-scale claim is made.

## 6. Importer write/refresh contract

New records use legacy fields:

```json
{
  "title": "Discovered title",
  "url": "https://www.youtube.com/watch?v=abcdefghijk",
  "thumbnail": "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg",
  "channel": "Source channel title",
  "type": "shorts",
  "published_at": "2026-10-01",
  "description": "Source snippet description",
  "members": ["Carmen", "Jiwoo"]
}
```

Both formats use the stable watch URL. Lookup recognizes canonical watch and legacy Shorts URLs for the same ID. Existing rows are refreshed with title, URL normalization, thumbnail, channel, format, date, and description; **existing member tags are not overwritten**. `id` is omitted on inserts and must have a verified database default.

Description is the search snippet's description, not a promise of complete video metadata. If the database rejects a write specifically because `videos.description` is absent, the importer retries the rejected operation once without that optional field and uses compatible payloads thereafter. It emits a warning and records `metadataOmissions: ["description"]`; text-based filtering/tag inference still uses the source description. Available descriptions are stored normally. Required-column/permission/constraint errors and zero-row updates still fail, with sanitized error codes. No schema or permission changes occur automatically. Format remains title-token inferred; duration, view counts, deletions, and availability are not synchronized.

## 7. Required database properties

An owner-requested, additive [description-column migration](VIDEOS_DESCRIPTION_MIGRATION.md) now exists and has been tested against isolated PostgreSQL 16 fixtures. It has **not** been applied to production: authorized target-project access/connectivity is unavailable. This is not a full schema migration or a replacement for the checks below.

- An exposed `videos` table matching the selected public projection.
- Stable primary key/default ID for new rows.
- Optional `description` compatible with inserts/updates when full snippet retention is required; absent-column compatibility preserves other metadata but cannot store descriptions.
- Correct title/channel/format/date/member types.
- Public SELECT grants and appropriate RLS; no anonymous writes.
- Privileged SELECT/INSERT/UPDATE grants for the trusted importer.
- Reviewed stable YouTube-identity uniqueness after reconciling legacy URL variants/duplicates.

Confirmed unique-conflict handling is useful only when the database actually enforces identity. A URL pre-check and serialized workflow cannot guarantee uniqueness against other writers or unresolved legacy variants. Do not apply an invented migration to an unknown live database.

## 8. Samples and provenance

There are 16 sample fixtures: 9 videos and 7 Shorts. Carmen + Jiwoo matches 3; all eight match 2. Demo records are sorted newest-first, marked `isSample`, and rendered as non-link articles.

Sample titles/IDs and member biographies are unverified/illustrative. Original JPEGs are preserved; WebP derivatives are used by the bundle. Content rights and historical member-tag cleanup remain owner tasks.
