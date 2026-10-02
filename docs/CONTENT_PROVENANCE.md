# Content and licensing register

This register records known limitations rather than asserting rights that the repository does not establish.

| Material | Known origin | Verification status / required owner action |
| --- | --- | --- |
| Application source | Existing repository; many files carry Apache-2.0 SPDX headers. | Confirm ownership and intended root license before adding `LICENSE`; no license was invented during remediation. |
| Four original JPEGs | Existing `src/assets/images/*.jpg`. | Source creator, consent, and redistribution rights are not recorded. Obtain evidence or replace with cleared assets. |
| Four WebP derivatives | Generated locally from the original JPEGs, max dimension 960px, quality 80. | Same unresolved rights as originals; conversion grants no new rights. Originals are preserved; only derivatives are bundled. |
| Member avatars | Existing Imgur URLs in `h2hData.ts`. | Verify attribution/usage rights or replace. |
| Member profile prose, roles, birthdays, MBTI | Existing repository data. | Unsourced and unverified; dormant profiles must not be published as factual until reviewed. |
| Sixteen sample videos | Existing `MOCK_VIDEOS` fixtures. | Illustrative titles and unrelated/reused video IDs. Active demo cards are labeled and have no playback links. |
| Imported metadata | YouTube search snippets from owner-approved channel IDs. | Text-derived tags are associations, not verified appearances. Record editorial corrections and source evidence externally until a provenance schema is approved. |

## Release blockers for the owner

1. Confirm the intended source-code license and ownership; then add the correct root license text.
2. Establish rights and factual provenance for images, avatars, and member descriptions.
3. Inspect/version the actual database schema, grants, RLS, defaults, and unique constraints before enabling ingestion.
4. Verify each configured channel ID and document the approval evidence.
5. Define who can verify appearance tags and how that evidence is retained.

No production license, source ownership, database security, or channel verification is claimed by this register.
