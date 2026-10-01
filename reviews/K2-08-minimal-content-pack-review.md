# K2-08 Minimal First-Party Content Pack — Independent Review

Date: 2026-10-01; reviewer: configured GPT-6 Luna / Max; source commit:
`6b0ed226946b8191749aeda7ab7f52ab54be76ab`

## Verdict

**PASS for the exact candidate packet and local production-matcher preview.** I found no
HIGH or BLOCKER content or preview defect that requires another candidate revision before
the project owner reviews it. The English is coherent and the A1/A2/B1 progression is
plausible for these familiar, short-sentence stories; this verdict is not the required
human editorial approval.

**Publication and hosted K2-08 acceptance are not PASS.** Rights and editorial approval
remain pending. The packet explicitly says `publication_authorized: false`. No exact live
catalog membership/selector check or fresh-actor baseline has been established, and no
authorized staging Admin session or matching strict-TLS connection is available in this
review. No hosted publication or learner-state mutation occurred.

## Frozen review inputs

| Artifact | SHA256 |
|---|---|
| `knowledge/staging/k208-minimal-content-pack/content-pack.json` | `b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b` |
| `knowledge/staging/k208-minimal-content-pack/editorial-preview.md` | `c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373` |
| `knowledge/staging/k208-minimal-content-pack/catalog-match-snapshot.json` | `ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07` |
| `knowledge/staging/k208-minimal-content-pack/preview-result.json` | `88dd92405d41df4295472c33d892dc981d1b3feefa8443ca6a40b47d9d6e9233` |
| `knowledge/preview_k208_content_pack.py` | `1d1e520e795df402c6f5a7ba876831a6945391c21bb8fc4cec7bb2e812f2d877` |
| `plans/TASK-K2-08-minimal-content-pack.md` | `243afe7eb83be0d6e1818191b3cd3f65176670b7bd11adaa17cfa024cbc326a3` |

The six files use LF line endings; each working-tree byte sequence exactly matches its
staged Git index bytes. The editorial Markdown contains all three packet bodies, matching
the DTO bodies after whitespace normalization. The packet, preview result, and plan bind
the hashes above. The local preview writer now specifies LF output, so its report is
reproducible across Windows and Linux checkouts.

## Independent verification

I reran `knowledge/preview_k208_content_pack.py` against the frozen packet and approved
public catalog snapshot, writing only to a temporary file. It exited successfully with
three items and zero violations. The fresh output was byte-identical to the frozen
`preview-result.json`.

| Item | Level | Tokens | Sentences | Minutes | Linked concepts | Annotations | Private target matches |
|---|---:|---:|---:|---:|---|---:|---:|
| N | A1 | 790 | 72 | 5 | 4 | 82 | 46 tea |
| W | A2 | 876 | 69 | 5 | 3 | 76 | 35 coffee |
| F | B1 | 859 | 74 | 5 | 3 | 76 | 49 water |

My strict span audit covered all 234 annotations across 215 sentences: every sentence
has a match; every UTF-16 span selects its exact surface text on code-point boundaries;
spans do not overlap; and W/F private target concepts do not cross-map to another item.
The snapshot is the approved public English catalog projection (99 forms, 94 concepts),
not Auth or learner data. The preview is database-free and certifies the production Admin
DTO/Reader matcher against that snapshot only.

The candidate prose forms a coherent tea visit at A1, a coffee-poster revision at A2,
and a water-route repair and explanation at B1. The structures and reading level sequence
are plausible. Owner review must still decide final editorial suitability, CEFR placement,
and first-party rights claims; the machine preview cannot make those decisions.

## Security and execution review

The normal `/v1/admin/*` route verifies a bearer token and then checks the server-only
owner allowlist (`services/api/src/lingua_api/review/routes.py:64-71`,
`services/api/src/lingua_api/admin/routes.py:55-61`, and
`services/api/src/lingua_api/admin/authorization.py:21-37`). Missing or malformed
allowlist configuration fails closed. The Admin application methods themselves do not
enforce that actor policy, and the store accepts a database URL
(`services/api/src/lingua_api/admin/service.py:16-46`;
`services/api/src/lingua_api/admin/store.py:43-44`). Calling those methods directly from
a script would bypass the HTTP authorization boundary; the plan correctly rejects that,
as well as JWT impersonation, service-role-as-actor, allowlist changes, and broad grants.

The Admin store writes content, source/provenance, sentence, concept mapping, and content
metric records; this path does not write learner state. Validation mechanically changes
a clean source record to `approved` and the content item to `reviewed`
(`services/api/src/lingua_api/admin/store.py:382-446`). Those status values do not prove
that a human reviewed the text or that a rights statement is true. Separate owner approval
must precede Admin validation. The database publication trigger still enforces the
complete Reader publication gate (`database/migrations/0005_reader_content_service_v1.up.sql:323-334`).

The local `DATABASE_URL` capability check did not match the intended staging pooler and
strict-TLS requirements, so no connection was attempted. The browser request-header check
did not establish an authorized Admin session. Use only the existing owner-authorized
HTTP Admin path when it is available. Do not treat this local preview or snapshot as
publication, catalog, or hosted selector proof.

## Owner decision and remaining gates

The content DTOs remain pending human editorial and rights review. The following four
metadata values are **proposals only**, not approved claims or applied values:

- `author_name`: `LINGUA OS Editorial (AI-assisted)`
- `source_name`: `LINGUA OS First-Party Reader`
- `attribution_text`: `LINGUA OS original first-party article. AI-assisted drafting, reviewed by the project owner for staging Reader use.`
- `rights_statement`: `Original AI-assisted first-party text; owner-approved use in LINGUA OS staging Reader. No external text was reused.`

The owner’s explicit decision must cover the exact article bodies, A1/A2/B1 placement,
first-party authorship/rights claims, the four proposed values, and the content-pack and
editorial-preview hashes recorded above. If approved, the executor may apply only those
four metadata fields through the normal Admin DTO path. Because that changes the packet
hash, rerun the production-backed preview and obtain a separate review of the new hash
before validation or publication. Any text change or deviation from the approved metadata
proposal requires renewed owner approval.

Before any actor is created, an approved read-only catalog path must verify the exact
three-item N/W/F membership, eligibility, linked private targets, publication gate,
five-minute metrics, and retained learner-state baseline. Then the already-reviewed
full K2-08 actor cycle remains a separate hosted acceptance gate. The preview’s N/W/F
ordering is only a static catalog-fit hypothesis; actual selector order and fresh-actor
state have not been measured. Do not report K2-08 hosted PASS until those live gates pass.
