# LINGUA OS — Preview-Only Knowledge Importer V1

Status: **implemented as research tooling; no apply mode; no database access**

## Purpose

`knowledge/preview_import.py` turns candidate packs plus audit artifacts into a deterministic, inspectable import plan. It cannot write PostgreSQL/Supabase and intentionally contains no `apply` subcommand.

This is the safety boundary between research artifacts and a future production importer.

## Inputs

Required:

- one or more `--pack` candidate JSON files;
- `--level-audit <audit.json>` using `knowledge-level-audit-115.v1` or the current `knowledge-level-audit-115.v2`;
- `--grammar-audit knowledge/grammar_audit_8.v1.json`.

Optional:

- `--catalog-snapshot <json>`: a read-only exported snapshot with schema `knowledge-catalog-snapshot.v1`;
- `--output <json>`: write the preview report to a local file.

There is no database URL argument and no network operation.

## Output

Schema: `knowledge-import-preview.v1`.

For each concept:

- `WOULD_INSERT` when no canonical key exists in the supplied snapshot;
- `WOULD_NOOP_EXISTING` when stable identity matches;
- `BLOCK_COLLISION` when the same key has a conflicting type/form/POS.

The report also emits source-pack hashes, exact level/grammar audit schema IDs, level-disposition counts, separate blocker/warning lists, a deterministic `planSha256`, and `applySupported: false` **always**.

A clean future report may set `productionCandidateEligible: true`, but this V1 tool still cannot apply anything.

## V2 blocker versus warning policy

The first audit pass treated every level mismatch as a blocker. The current V2 audit distinguishes difficulty risk from conservative sequencing.

**Blockers** include earlier-than-reference placement, material source disagreement, canonical identity/POS mismatches, unresolved phrase/skill evidence, grammar records that are not production-approved, catalog identity collisions, A0 stretch decisions awaiting review, and production lexical authority that is not `LINGUA_VERIFIED`.

**Warnings** include LINGUA teaching an item later than a reference and a proposed band that gained independent secondary-source support even though the first reference differed.

Teaching later is conservative, so it should not block a future import by itself. Teaching earlier may increase learner difficulty and therefore remains review-gated.

Audit V2 can provide explicit group severity (`blocker`, `warning`, `info`, `delegated`). Explicit V2 severity wins over the legacy disposition fallback, so review policy lives in inspectable data rather than hidden control flow.

## Fail-closed structural checks

Preview fails immediately for:

- duplicate canonical keys across packs;
- invalid concept type/key prefix;
- missing or blank `canonicalForm`;
- unsupported curriculum bands (only internal `LINGUA_A0/A1/A2/B1` are accepted by this V1 pack contract);
- word concepts without a non-empty POS;
- non-word concepts that incorrectly carry a POS;
- non-candidate pack/review state;
- non-first-party example rights in these first-party packs;
- blank English or Vietnamese example text;
- forbidden learner-state fields anywhere in the candidate pack;
- unknown/self/cyclic prerequisite edges;
- incomplete or extra level-audit records;
- incomplete or extra grammar-audit records;
- malformed/duplicate catalog snapshot identities;
- malformed V2 severity values.

Review disagreements instead produce a deterministic plan with `status: BLOCKED_REVIEW`, allowing a reviewer to inspect exactly what would happen without weakening the gate.

## Current 115-concept expectation

With an empty catalog snapshot, all 115 current candidate concepts remain structurally previewable as `WOULD_INSERT`, but the plan must remain `BLOCKED_REVIEW` because:

- the official CEFR-J 1.6 artifact is not yet independently downloaded and hash-verified by LINGUA;
- the lexical review queue still includes `far`, `booking`, `cash`, `left`, `right`, `environment`, and `need`;
- 17 phrase concepts still need phrase/function evidence;
- 8 skill concepts still need can-do/function review;
- all 8 grammar concepts have evidence reviews but intentionally remain `productionApproved: false` until human curriculum sign-off.

That is intentional. **Previewability is not import approval.**

## `far` identity handling

The source pack currently contains `word:far:adjective`, but the V2 audit found that its intended example/sense is adverbial and proposes `word:far:adverb` at A2.

The preview importer does not silently rewrite canonical identities. The audit marks the current concept `IDENTITY_MODEL_REVIEW_REQUIRED`, which blocks production until the source pack and every coverage/reference artifact are migrated together. This avoids an orphaned key and prevents a level mismatch from being hidden by normalization.

## Tests

`knowledge/tests/test_preview_import.py` now covers no-apply behavior, unverified-authority blocking, synthetic candidate-ready behavior while `applySupported=false`, duplicate/prerequisite errors, nested learner-state-field rejection, catalog identity collision/no-op, blocker dispositions, later-than-reference warning semantics, V2 explicit severity, blank canonical forms, invalid curriculum bands, word/non-word POS contracts, bilingual examples, grammar production-approval gating, and CLI rejection of `--apply`.

An isolated Python stdlib unit run of the exact current importer/test pair in the assistant workspace completed **18/18 PASS**. This is not a substitute for the repository's full validation suite after checkout/merge.

## Future apply task

A future bounded task may implement transactional apply only after:

1. CEFR-J 1.6 source snapshot is independently pinned by LINGUA;
2. the V2 lexical review queue is resolved;
3. source-pack identity correction for `far` is complete and all coverage keys are consistent;
4. grammar/phrase/skill review is explicitly approved;
5. current master schema/catalog anchors are re-audited after parallel sessions merge;
6. preview against staging's read-only catalog snapshot shows an acceptable diff;
7. an independent reviewer approves the exact plan hash.

Do **not** add apply behavior to `preview_import.py`. Build a separate, narrowly reviewed transactional importer boundary later.
