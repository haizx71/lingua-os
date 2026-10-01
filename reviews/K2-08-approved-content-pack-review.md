# K2-08 Owner-Approved Content Pack — Independent Exact-Hash Review

Date: 2026-10-01; reviewer: configured GPT-6 Luna / Max; source commit:
`512c906848a76da4cfc0189dee103fa813247d85`

## Verdict

**PASS for the exact owner-approved, metadata-applied candidate and its local preview.**
No HIGH or BLOCKER issue was found in the four-field metadata update, the content/preview
hash binding, or the staging-only scope. The earlier independent editorial verdict still
applies because all article bodies, titles, levels, and target mappings are unchanged.

**Hosted publication and K2-08 acceptance remain NOT PASS.** The owner approved the
articles, levels, and exact metadata for staging/hosted acceptance only. Both the frozen
packet and preview still set `publication_authorized: false`. A normal owner-authorized
Admin session has not been established; the read-only Admin page returned an explicit
access-denied response. No Admin create, validate, or publish action, hosted content write,
or learner-state mutation occurred. The exact live catalog check and fresh-actor/full
K2-08 cycle remain outstanding.

## Frozen inputs

| Artifact | SHA256 |
|---|---|
| `knowledge/staging/k208-minimal-content-pack/content-pack.json` | `5eb2d97d94f6288f6195c22cf9ae87d7e912ce09dc9b97e4eab626620fa4a679` |
| `knowledge/staging/k208-minimal-content-pack/editorial-preview.md` | `039503232d8a310a97d7de819fe544b785c070cd5dda767fc2595dc4690c41ed` |
| `knowledge/staging/k208-minimal-content-pack/catalog-match-snapshot.json` | `ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07` |
| `knowledge/staging/k208-minimal-content-pack/preview-result.json` | `9b47705593bab7c942e1eefac28d51d368bd01cf1f96a9ab9035a77cf64de170` |
| `knowledge/preview_k208_content_pack.py` | `37b0326c7db3e2db2f37d448c58468bac3c716f894d82d685484c2dbeffb227d` |
| `plans/TASK-K2-08-minimal-content-pack.md` | `972df09a6b244b0493be7e6485453d9474aff1348b466b9b2fe0efec9074144d` |

The owner’s 2026-10-01 PR #38 approval is recorded as `staging_hosted_acceptance_only`;
the metadata-applied packet records editorial and rights approval for that scope and
continues to deny publication authorization. The earlier review at commit
`4ebef4d991cc15695c52722cfa712b1387ba21dc` covers only its then-frozen packet
`b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b`, editorial preview
`c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373`, and unchanged
catalog snapshot. This review covers the new metadata-applied hashes above.

## Exact delta from the approved packet

Against baseline `4ebef4d991cc15695c52722cfa712b1387ba21dc`, I compared each N/W/F
`admin_create_dto`. Exactly these four fields changed in each DTO:

- `author_name`: `LINGUA OS Editorial (AI-assisted)`
- `source_name`: `LINGUA OS First-Party Reader`
- `attribution_text`: `LINGUA OS original first-party article. AI-assisted drafting, reviewed by the project owner for staging Reader use.`
- `rights_statement`: `Original AI-assisted first-party text; owner-approved use in LINGUA OS staging Reader. No external text was reused.`

All remaining DTO fields are identical, including title, body, level, `source_version`,
and the approved target metadata. Each item’s role, expected minutes, and expected concepts
are also unchanged. The top-level approval and candidate-status records were updated to
reflect the owner’s exact staging-only approval. No approval field authorizes publication.

The editorial Markdown contains the same complete article bodies as the DTOs after
whitespace normalization. Its historical-review references point to the committed
`4ebef4d` review hashes above. The six frozen inputs use LF line endings. The only source
code delta from the baseline is in the local preview script: it reports the packet’s
staging-only approval scope and keeps `publication_authorized` false. That local annotation
does not authenticate an owner or change any production Admin, Auth, RLS, migration, or
Reader publication rule.

## Independent verification

I reran the production-backed local matcher preview to a temporary file. The CLI exited
successfully with three items and zero violations; its fresh output was byte-identical to
the frozen `preview-result.json`. The report binds the exact pack, catalog-snapshot, and
editorial-preview hashes above. It reports `owner_approval_scope:
staging_hosted_acceptance_only`, `publication_authorized: false`, and
`fresh_actor_baseline.proven: false`.

| Item | Level | Tokens | Sentences | Minutes | Concepts | Annotations | Private target matches |
|---|---:|---:|---:|---:|---:|---:|---:|
| N | A1 | 790 | 72 | 5 | 4 | 82 | 46 tea |
| W | A2 | 876 | 69 | 5 | 3 | 76 | 35 coffee |
| F | B1 | 859 | 74 | 5 | 3 | 76 | 49 water |

The independent offset audit covered 234 annotations across 215 sentences. Every sentence
has an automatic match; every UTF-16 span selects its exact surface text on a code-point
boundary; there are no overlaps or W/F private-target cross-maps. The unchanged snapshot
is a public approved English catalog projection with 99 forms and 94 concepts, excluding
Auth and learner data. The preview proves deterministic DTO matching against that
snapshot only; its N/W/F ordering remains a static catalog-fit prediction, not a live
selector result.

The preview’s approval-scope label is derived from fields in the local packet. It is not
proof of human approval or a security boundary. The explicit owner decision recorded for
PR #38 is the approval evidence; server-side Admin authorization remains independent.

## Publication and actor gates

The plan still requires a normal owner-authorized Admin HTTP route. Calling
`AdminContentApplication` directly or writing catalog rows with SQL would bypass the
HTTP actor policy and is not an accepted execution path. A read-only Admin request returned
the application’s access-denied page; the current session therefore does not prove owner
authorization. No credentials, allowlist or grant changes are authorized by this review.

Before any hosted content write, the plan requires the retained learner-state snapshot
through the read-only probe. After publication, an actorless catalog-only check must prove
the exact N/W/F membership, eligibility, target links, publication-gate results, and
metrics, and compare learner-state counts/hashes with the retained snapshot. Actors may be
created only after that gate passes. The current exact live pack membership, actual
selector order, fresh-actor baseline, and full K2-08 learner-isolation cycle remain
unverified. Root’s read-only staging check reports migration `0020` and zero currently
eligible published Reader items; no actor creation has occurred.

The exact-hash review gate is closed by this report only. Normal Admin authorization,
hosted publication, the actorless post-publication catalog/learner-state gate, and the full
hosted K2-08 acceptance remain separate requirements. Do not report hosted K2-08 PASS.
