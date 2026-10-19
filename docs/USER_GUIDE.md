# User guide

## What the archive searches

Select **Carmen, Jiwoo, Yuha, Stella, Juun, A-na, Ian, and/or Ye-on** to find videos with matching stored member tags.

Tags are unverified associations and can originate from text inference or older editorial data. They do **not** prove that members appear visually together. The interface now describes tag search rather than guaranteed co-appearance.

## Search flow

1. Wait for loading to finish and check the visible data-source message.
2. Select at least one member using their avatar/name button.
3. Choose match mode: **including** (all selected tags present; extras allowed) or **only** (exact stored tag set).
4. Optionally narrow with a content-category tab: **全部**, **MV**, **官方 Shorts**, **舞台**, **綜藝**, or **其他**.
5. Optionally search title, channel, or description, and choose sort (new / old / popular when view counts exist).
6. Open a live card in YouTube; demo cards are non-playable.

**Category rules (current):**
- **官方 Shorts**：只收 Hearts2Hearts 官方頻道的 Shorts／挑戰。官方 Vlog 類 Shorts（例如琴房、後台日記）會**同時**出現在 Shorts 與綜藝。
- 其他頻道的 Shorts／挑戰不會進 Shorts tab，會按內容分到舞台、綜藝、或其他影音。

In **including** mode, Carmen + Jiwoo finds records tagged with both; additional members on the record are allowed. **Only** mode requires the stored tag set to match the selection exactly. No selection displays a prompt rather than the entire archive.

## Selection and presets

Click a selected member again to remove them. Individual selected chips have an X; clear/reset buttons remove all selected members.

Active presets:

| Preset | Members |
| --- | --- |
| 全員 8 人標籤 | All eight. |
| Carmen & Jiwoo | Carmen, Jiwoo. |
| Juun & A-na | Juun, A-na. |
| 主唱三人組 | Carmen, Yuha, Ye-on. |
| 舞線三人組 | Jiwoo, Stella, Ian. |

Clearing members or applying a preset **retains** genre, sort, and keyword controls. Clear the keyword manually or switch category tabs if results appear unexpectedly narrow. Reloading the page resets filters.

## Keyword matching and counters

Search matches a trimmed, case-insensitive substring in title, channel, or description. There is no fuzzy matching, remote YouTube search, translation, stemming, or multi-keyword operator syntax.

Category-tab counters reflect member tags before keyword filtering. The results heading reflects the final keyword/category result count. Their counts may therefore differ intentionally.

## Data states

A source message remains visible on mobile and desktop; the desktop header also has a state label.

| State | Behavior |
| --- | --- |
| Loading | Results show a loading indicator. |
| Live data | All publicly readable rows are fetched through pagination. |
| Empty live archive | Explicit empty/read-policy message; no automatic invented samples. |
| Read/validation/configuration failure | Visible error and reload control; no silent sample substitution. |
| No Supabase configuration | Explicit labeled demo, with no fictitious database request. |
| User chooses demo | Sixteen illustrative fixtures; cards have no playback links. |

Demo title/profile information is not independently verified. Reused YouTube IDs in fixtures cannot navigate users to unrelated videos because demo cards are rendered as articles, not anchors.

Use **重新讀取資料** to retry/refetch, or **檢視示範資料** to deliberately inspect the demo. Existing open pages do not automatically refresh when scheduled ingestion changes the database.

## Cards and images

Live cards show title, channel, description, content-category badge, member tags marked **未核實**, publication date, and optional display metadata. Playback uses a valid `watch?v=` link. No embedded modal is active.

Missing duration/date values display `未提供`; view text may be blank. Public minimal projections do not currently load optional duration/views/category/highlight columns. Cards lazy-load images and replace failed images with a local visual placeholder; member avatars fall back to initials.

Demo records are sorted newest-first. Successful database records are ordered by publication date with ID tie-breaking.

## Header link

With an owner-configured valid channel ID, the header links directly to that channel and labels it **已設定頻道**. Otherwise it links to YouTube's home page and labels it **YouTube**. Neither wording pretends the app has independently verified official ownership.

## Accessibility and persistence

Member and format controls expose selected toggle state. Search has an accessible label. Focus-visible styles are supplied for keyboard users; status, busy, and error states expose appropriate semantics.

Filter state is not saved in URLs or local storage. There are no accounts, favorites, uploads, editing controls, or saved searches.

Member profiles, standalone recommendation navigation, AND/OR mode, and embedded playback exist only as dormant source components, not active product features.

## Troubleshooting

- **No matches:** select a member, switch to **全部**, clear the keyword, and try **including** mode if **only** is too strict.
- **Tags disagree with footage:** ask the maintainer to verify/correct the source record; text association is not appearance evidence.
- **Load error:** retry; maintainers should inspect public configuration, table fields, grants, RLS, and invalid rows.
- **Demo instead of live:** check the source message. Blank credentials select demo; failed live reads no longer silently fall back.
- **Image unavailable:** the local placeholder/initial is expected.

Operator procedures are in [Deployment and operations](DEPLOYMENT_OPERATIONS.md).
