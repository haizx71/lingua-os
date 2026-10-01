# TASK-K2-08 — Minimal First-Party Reader Pack

Status: **PREVIEW ONLY — NOT APPROVED FOR HOSTED WRITES OR PUBLICATION**
Base source: `5e44412d4afd3bc1a8939182f780b175ae71e9f8`
Scope: three first-party English Reader articles to unblock the K2-08 catalog gate.

## Goal and frozen boundaries

Create one novel control (`N`), one weak remediation candidate (`W`), and one forgotten
remediation candidate (`F`) using the existing Admin content path. Preserve the approved
Reader matcher, publication gate, learner state, Auth, and schema. Do not create actors or
start hosted K2-08 until the actorless catalog gate passes and the content has separate
human editorial and rights approval.

Current source and migration gates are already recorded as passing in `STATUS.md`. The
full hosted gate remains blocked: the last recorded run stopped at
`preflight_k208_catalog` with zero eligible published English Reader items, before actor
creation. That run must not be repeated until the catalog changes.

## Production rules for this pack

The dry-run tool reads the approved public catalog snapshot and validates each DTO with
the production `CreateAdminContentRequestDto`. It calls the production
`segment_english_text` and `analyze_transient_text` implementation. Every returned match
is retained; the preview does not prune or replace annotations.

The production Admin store counts whitespace-separated sentence tokens using
`len(re.split(r"\s+", sentence.strip()))`; Content and Library report
`ceil(token_count / 180)` minutes. The K2-08 fresh-candidate selector requires every
candidate item to be at least five minutes, while W and F must each be exactly five
minutes. Therefore all three packet bodies must contain 721–900 Admin-counted tokens.

Publication and K2-08 add these structural constraints:

- 1–100 ordered sentence segments, with every sentence receiving at least one approved
  catalog match;
- no more than four distinct linked concepts per sentence;
- exactly 1–4 distinct linked concepts per item, matching every stored occurrence count;
- valid non-overlapping UTF-16 annotation offsets;
- W and F target concepts appear in their own item and do not appear in another pack item;
- English, curated A1/A2/B1 levels for N/W/F, in that order.

The DB publication gate separately verifies the complete visible dependency graph: each
source record is approved and has quality metadata, each license is allowed, required
attribution is representable, segment/metric/annotation aggregates match, and the full
published structure is valid. The catalog-only post-write check must call this gate for
each article; packet metadata alone is not publication proof.

## Current local artifacts

- `knowledge/staging/k208-minimal-content-pack/content-pack.json` — first-party candidate
  packet; approval metadata must remain pending until a human approves the exact final
  content and rights claims.
- `knowledge/staging/k208-minimal-content-pack/editorial-preview.md` — author-owned
  human-readable editorial packet.
- `knowledge/staging/k208-minimal-content-pack/catalog-match-snapshot.json` — approved
  public-only snapshot with 99 forms across 94 concepts at the base SHA above; no Auth or
  learner data.
- `knowledge/preview_k208_content_pack.py` — local, database-free dry-run. It writes a
  deterministic sentence/match/UTF-16/metric report and never creates or publishes content.
- `knowledge/staging/k208-minimal-content-pack/preview-result.json` — current dry-run
  output. It identifies the packet, editorial-preview, and catalog snapshot hashes. Treat
  it as stale whenever an input hash changes; only the final passing run can support review.

## Current local candidate evidence

The final preview packet is frozen at SHA256
`b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b`. The
production-backed preview passes with zero violations against the approved snapshot at
`ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07`:

| Item | Level | Tokens | Sentences | Minutes | Concepts | Annotations | Target matches |
|---|---:|---:|---:|---:|---|---:|---:|
| N | A1 | 790 | 72 | 5 | tea, in, on, room | 82 | 46 tea |
| W | A2 | 876 | 69 | 5 | coffee, in, on | 76 | 35 coffee |
| F | B1 | 859 | 74 | 5 | water, in, on | 76 | 49 water |

Every sentence has at least one approved match; per-sentence concept counts stay within
four. A strict audit verified exact UTF-16 source slices and non-overlap for all 234
annotations across 215 sentences. W and F targets occur only in their own items. The
editorial preview contains the complete final article bodies and the proposed metadata
block. The frozen artifacts are:

- content pack: SHA256 `b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b`;
- editorial preview: SHA256 `c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373`;
- approved public catalog snapshot: SHA256
  `ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07`;
- preview result: SHA256 `88dd92405d41df4295472c33d892dc981d1b3feefa8443ca6a40b47d9d6e9233`.

The result binds those three input hashes, reports `dry_run_pass: true`,
`publication_authorized: false`, and `fresh_actor_baseline.proven: false`. A static
catalog-fit calculation predicts N → W → F under the exact-three-row and fresh-profile
assumptions described below. This is not a live catalog check, selector execution, or
actual fresh-actor baseline.

The independent Max editorial review is still required for these exact content-pack and
editorial-preview hashes. Neither the structural pass nor the catalog-fit prediction
authorizes validation, publication, or actor creation.

## Human approval gate

The authored articles are AI-assisted candidates. Human English editorial review and
rights/provenance approval are required before any Admin validation or publication. The
owner approval must cover the exact article text and the four proposed post-approval values
in `editorial-preview.md`, bound to the content-pack SHA256
`b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b` and editorial-preview
SHA256 `c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373`. The current
DTO metadata remains explicitly pending and is not approved for publication.

After that exact approval, the authorized executor may apply only the four approved
`author_name`, `source_name`, `attribution_text`, and `rights_statement` values to the
three DTOs; `source_version` remains `k208-minimal-content-pack-v1`. That exact preapproved
metadata transition does not require a second owner editorial approval. It does change the
content-pack hash, so the executor must rerun the production-backed preview and obtain a
separate review of the new exact hash before Admin validation or publication. Any change
to article text or deviation from the approved metadata proposal requires renewed owner
approval.

`AdminContentApplication.validate_content` automatically marks a clean source record
`approved` and its content item `reviewed`. It checks that rights and attribution fields
are present, but does not establish that a human actually approved the text or that the
rights claims are true. Do not call it while the packet still says review is pending, and
do not use non-empty placeholder metadata to cross that state transition.

## Authorization and safe execution path

The existing HTTP boundary is `POST /v1/admin/content`, followed by the normal
`POST /v1/admin/content/{contentId}/validate` and `/publish` operations. Every route checks
a verified Supabase actor JWT and the server-side `LINGUA_ADMIN_USER_IDS` allowlist. The
existing `/admin/content/new` and content-detail UI use these routes.

No unattended authorized execution path is currently established. `AdminContentApplication`
methods themselves take a database URL and do not enforce the HTTP actor/owner policy, so
calling them directly from a local script would bypass that boundary. The current local
process has a `DATABASE_URL`, but its fixed capability check did not match the staging
pooler and strict TLS verification settings; it did not connect. Existing hosted workflow
database access is read-only. Do not copy or mint an owner JWT, use a service-role key as
an Admin actor, change the owner allowlist/grants/secrets, or call the application directly
until a reviewer accepts a narrowly scoped trusted control plane.

The desktop browser check could not load its request-header policy, so it did not inspect
tabs or session state and did not establish an authorized Admin UI session. If a normal
owner-authorized UI session is available later, use only the existing Admin HTTP path. If
it is not, stop at the human approval gate; no alternate execution path is accepted in this
plan. No credential entry or extraction is part of this plan.

## Actorless catalog gate before actor creation

The existing `_k208_catalog_preflight` checks aggregate eligibility counts and availability
of the learner-retrievability view. It does not prove that the exact pack forms the full
N/W/F matrix. Before any actor is created, an existing read-only staging probe must prove
all of the following using catalog tables only:

1. The global eligible English Reader catalog contains exactly the three intended pack
   items (the verified pre-change eligible count is zero); all three pass
   `reader_content_passes_publication_gate`, have 1–4 linked concepts, and are exactly
   five minutes.
2. The published packet membership is exactly N, W, and F by their pinned first-party
   source-version metadata and titles, with curated levels A1, A2, and B1 and no duplicate
   packet rows.
3. Each target canonical key resolves to the expected approved concept and is actually
   linked to its item. Coffee and water are absent from every other pack item. Stored
   concept counts equal the complete annotation aggregate.
4. The complete graph remains approved and allowed according to the publication gate;
   the global summary reports at least three eligible items, at least two five-minute
   remediation items, and the rank view is available.
5. The probe reads no Auth or learner-state tables and creates no rows.

The existing aggregate probe does not return pack membership or target mappings, so the
exact pack check is a required additional actorless read-only check alongside it. Use an
already approved read-only catalog path; any probe/workflow source change requires separate
root review. Do not substitute an unbounded database query or a production eligibility
change.

Under the hypothesis that exactly these three rows are eligible, and a fresh profile has
`current_level_id` null, the source ordering expression
`COALESCE(abs(level.rank_order - learner_rank), level.rank_order)` uses the level rank as
the distance. Given the verified A1=1, A2=2, B1=3 ranks, this statically predicts N → W → F
when the other fresh-profile ordering keys are equal. No selector was executed for these
rows and no actor-specific baseline has been measured. Only after the actorless gate passes
may the already-reviewed K2-08 harness create its disposable actors and prove the actual
fresh-actor candidate matrix; its candidate probe must find no linked learner states, no
saved/progress content, all candidates eligible, and the same selected N/W/F identity for
all four actors.

## Conditional publication sequence

Proceed only after separate Max review, exact-hash human editorial/rights approval of the
article text and proposed metadata, and root authorization of the execution path:

1. After owner approval, apply only the four exact metadata values already approved in the
   proposal. Rerun the production-backed preview against the changed DTO hash and obtain a
   separate review of that exact hash. Stop if any article or metadata field differs from
   the approved packet/proposal.
2. Before the first hosted content write, take the existing retained learner-state
   snapshot in memory through the read-only probe. Record only table counts/hashes, never
   rows, actor UUIDs, or Auth data.
3. Submit each exact DTO once through the normal owner-authorized Admin HTTP route. Keep
   response content IDs in process memory only. Because create is not idempotent, after an
   ambiguous response first read back through the authorized Admin list/detail route; do
   not blindly repeat POST.
4. Confirm the matcher-produced sentences, concepts, counts, and offsets through the
   returned Admin projection. Make no manual concept deletions or offset edits.
5. Only after the separate human approval already covers the exact content and truthful
   metadata, invoke Admin validation. Stop on any issue; do not force a state transition.
   Publish only records returned as `reviewed` and only after all three pass.
6. Before any actor setup, run the actorless exact catalog gate above and compare the
   retained learner-state counts/hashes with the pre-write snapshot. Stop on any
   difference or unexpected catalog row.
7. After root authorizes the hosted acceptance run, use the existing full K2-08 harness.
   Its real fresh-actor probes establish N/W/F ordering and state isolation before fixture
   seeding. Do not run the due-only subcase as a substitute for full K2-08.

On any partial failure, preserve created Admin content for an owner to inspect and
reconcile; do not issue SQL deletes or automatic cleanup. The API has no create idempotency
key, so reconcile by authenticated Admin read-back before any retry. Never create actors
until the complete actorless catalog gate passes.

## Explicit remaining gates

- The frozen packet has passed the local production-backed dry-run and strict UTF-16 span
  audit; the recorded input and report hashes above must remain unchanged for review.
- A configured independent GPT-6 Luna / Max review must accept the exact packet and
  editorial-preview hashes with no HIGH/BLOCKER issue.
- A human owner must explicitly approve the final English editorial quality, A1/A2/B1
  placement, first-party authorship/rights, attribution, proposed post-approval metadata,
  and the exact content-pack plus editorial-preview hashes.
- Root must establish the authorized Admin execution path and decide whether the
  catalog-only probe addition is needed.
- After publication, the exact actorless catalog and learner-state comparison must pass
  before any actors are created; full K2-08 acceptance remains a separate later gate.
