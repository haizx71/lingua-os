# TASK-K2-08 — Minimal First-Party Reader Pack

Status: **OWNER APPROVAL FOR STAGING-ONLY ACCEPTANCE RECORDED — PREVIEW ONLY; NO HOSTED WRITES OR PUBLICATION**
Base source: `5e44412d4afd3bc1a8939182f780b175ae71e9f8`
Scope: three first-party English Reader articles to unblock the K2-08 catalog gate.

## Goal and frozen boundaries

Create one novel control (`N`), one weak remediation candidate (`W`), and one forgotten
remediation candidate (`F`) using the existing Admin content path. Preserve the approved
Reader matcher, publication gate, learner state, Auth, and schema. The project owner has
approved the exact PR #38 article text, levels, and four metadata values for staging/hosted
acceptance only. Do not write hosted content until the metadata-applied hashes pass separate
independent review and root confirms the normal authorized Admin path. Do not create actors
until the exact actorless catalog gate passes.

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

- `knowledge/staging/k208-minimal-content-pack/content-pack.json` — owner-approved
  staging/hosted-acceptance candidate; exact approval is recorded in its manifest.
  publication_authorized remains false.
- `knowledge/staging/k208-minimal-content-pack/editorial-preview.md` — human-readable
  article packet and staging-only owner-approval record.
- `knowledge/staging/k208-minimal-content-pack/catalog-match-snapshot.json` — approved
  public-only snapshot with 99 forms across 94 concepts at the base SHA above; no Auth or
  learner data.
- `knowledge/preview_k208_content_pack.py` — local, database-free dry-run. It writes a
  deterministic sentence/match/UTF-16/metric report and never creates or publishes content.
- `knowledge/staging/k208-minimal-content-pack/preview-result.json` — current dry-run
  output. It identifies the packet, editorial-preview, and catalog snapshot hashes. Treat
  it as stale whenever an input hash changes; only the final passing run can support review.

## Current local candidate evidence

The owner-approved staging candidate now applies exactly the four PR #38 metadata values to all three DTOs. The immutable article/title/level/source-version/target projection SHA256 remains 175e6b6acb78e15986f94d0b7f8ab14bcc4ab47fca614c09987ac8563d7d9642.

The production-backed preview passes with zero violations against the approved public catalog snapshot:

| Item | Level | Tokens | Sentences | Minutes | Concepts | Annotations | Target matches |
|---|---:|---:|---:|---:|---|---:|---:|
| N | A1 | 790 | 72 | 5 | tea, in, on, room | 82 | 46 tea |
| W | A2 | 876 | 69 | 5 | coffee, in, on | 76 | 35 coffee |
| F | B1 | 859 | 74 | 5 | water, in, on | 76 | 49 water |

All 215 sentences have a match; all 234 UTF-16 spans are exact, on code-point boundaries, and non-overlapping. W and F targets occur only in their own items. The frozen current artifacts are:

- content pack: SHA256 5eb2d97d94f6288f6195c22cf9ae87d7e912ce09dc9b97e4eab626620fa4a679;
- editorial preview: SHA256 039503232d8a310a97d7de819fe544b785c070cd5dda767fc2595dc4690c41ed;
- approved public catalog snapshot: SHA256 ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07;
- preview result: SHA256 9b47705593bab7c942e1eefac28d51d368bd01cf1f96a9ab9035a77cf64de170.

The result binds those three input hashes, reports dry_run_pass true, publication_authorized false, owner_approval_scope staging_hosted_acceptance_only, and fresh_actor_baseline.proven false. N → W → F remains a static catalog-fit prediction only, not a live selector result or actor baseline.

Historical independent review: the reviewer reported PASS with no HIGH/BLOCKER content issue for the prior exact input set only: content pack b9530370b2626205bd872b48af51ebeb25547e24f41be46654da6f478019760b, editorial preview c830dca6ac73985ad97518ab88a58e310e590eb5735de5ad41527fcafbf03373, and snapshot ae28bd4b1e2fa0617f11ddc8a0bfd01a38e3bb2ed35d83a5a051abf7dc3e0d07. That disposition is retained as historical exact-input evidence; it does not review the metadata-applied hashes above. A separate review of the current hashes is pending. No hosted write, validation, publication, actor creation, or live selector run has occurred.

## Human approval gate

The project owner explicitly approved PR #38 on 2026-10-01. Approval covers the exact N/W/F article bodies, A1/A2/B1 placement, and these four metadata values for staging/hosted acceptance only:

- author_name: LINGUA OS Editorial (AI-assisted)
- source_name: LINGUA OS First-Party Reader
- attribution_text: LINGUA OS original first-party article. AI-assisted drafting, reviewed by the project owner for staging Reader use.
- rights_statement: Original AI-assisted first-party text; owner-approved use in LINGUA OS staging Reader. No external text was reused.

These values are now applied to each DTO. source_version remains k208-minimal-content-pack-v1; titles, levels, article bodies, and mapped targets are unchanged. This approval is restricted to staging/hosted acceptance and does not authorize public or production publication.

The historical independent review covers only the earlier frozen hash set listed above. The metadata-applied content-pack and editorial-preview hashes require a separate independent review before any hosted Admin create/validate/publish action. publication_authorized remains false until the exact current hashes have been reviewed and root confirms the normal authorized Admin execution gate.

AdminContentApplication.validate_content automatically marks a clean source record approved and its content item reviewed. It checks that rights and attribution fields are present, but does not establish that the owner authorized a different scope or that rights claims are true. Do not call it before the current exact-hash review and authorized Admin gate. No second owner approval is needed for the exact four values already approved; any deviation from them or any change to story text, title, level, source version, or target mapping requires renewed owner approval.

## Authorization and safe execution path

The existing HTTP boundary is POST /v1/admin/content, followed by the normal
POST /v1/admin/content/{contentId}/validate and /publish operations. Every route checks
a verified Supabase actor JWT and the server-side LINGUA_ADMIN_USER_IDS allowlist. The
existing /admin/content/new and content-detail UI use these routes.

No normal owner-authorized Admin execution path is currently established. The fixed local
database capability check did not match the staging pooler and strict TLS verification
settings, so it did not connect. Existing hosted workflow database access is read-only.
Do not copy or mint an owner JWT, use a service-role key as an Admin actor, change the
owner allowlist/grants/secrets, or call AdminContentApplication directly: its methods do
not enforce the HTTP actor/owner policy.

A read-only Codex IAB Admin GET returned an access-denied page (Bạn không có quyền thực hiện thao tác này.). No learner page was opened and no hosted write was attempted. This did not establish an authorized Admin session. Keep the execution gate closed until root confirms a normal owner-authorized Admin path. No credential entry or extraction is part of this plan.

## Actorless catalog gate before actor creation

The latest root-reported read-only Supabase evidence is migration head 0020 and zero
eligible published K2-08 English Reader items. The existing `_k208_catalog_preflight` checks aggregate eligibility counts and availability of the learner-retrievability view; it does
not prove that the exact pack forms the full N/W/F matrix. After authorized staging writes,
but before any actor is created, an existing read-only staging probe must prove all of the
following using catalog tables only:

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

Proceed only after a separate Max review accepts the exact metadata-applied hashes and
root confirms the normal authorized Admin execution path. The owner approval for the exact
PR #38 text and metadata is already recorded and staging-only:

1. Confirm the four already-approved metadata values and exact preview hashes. Do not
   change article text, title, level, source version, or mapped targets. Stop if any field
   differs from the owner-approved PR #38 packet.
2. Before the first hosted content write, take the existing retained learner-state
   snapshot in memory through the read-only probe. Record only table counts/hashes, never
   rows, actor UUIDs, or Auth data.
3. Submit each exact DTO once through the normal owner-authorized Admin HTTP route. Keep
   response content IDs in process memory only. Because create is not idempotent, after an
   ambiguous response first read back through the authorized Admin list/detail route; do
   not blindly repeat POST.
4. Confirm the matcher-produced sentences, concepts, counts, and offsets through the
   returned Admin projection. Make no manual concept deletions or offset edits.
5. Only after separate review of the current exact hashes and root confirmation of the
   authorized Admin path, invoke Admin validation under the staging-only owner approval.
   Stop on any issue; do not force a state transition. Do not claim publication authorized
   or any published status before all required gates pass.
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

- The exact metadata-applied pack/preview hashes above must receive a separate independent Max review; the historical review applies only to its listed prior inputs.
- Root must establish a normal owner-authorized Admin execution path. The current read-only Admin GET was denied; no credentials, allowlist changes, service-role bypass, or direct application calls are allowed.
- publication_authorized remains false; no hosted writes or publication have been made.
- After authorized staging publication, the exact actorless catalog and learner-state comparison must pass before any actors are created. Root reports the current eligible published catalog count is zero.
- The full K2-08 fresh-actor baseline/order and state-isolation proof remains a separate later gate after the actorless preflight; the local rank-order calculation is prediction only.
