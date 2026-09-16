# LINGUA OS — Preview-Only Knowledge Importer V1

Status: **implemented as research tooling; no apply mode; no database access**

## Purpose

`knowledge/preview_import.py` turns candidate packs plus audit artifacts into a deterministic, inspectable import plan. It cannot write PostgreSQL/Supabase and intentionally contains no `apply` subcommand.

This is the safety boundary between research artifacts and a future production importer.

## Inputs

Required:

- one or more `--pack` candidate JSON files;
- `--level-audit knowledge/level_audit_115.v1.json`;
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

The report also emits source-pack hashes, level-disposition counts, review blockers, a deterministic `planSha256`, and `applySupported: false` **always**.

A clean future report may set `productionCandidateEligible: true`, but even then this V1 tool still cannot apply anything.

## Fail-closed structural checks

Preview fails immediately for:

- duplicate canonical keys across packs;
- invalid concept type/key prefix;
- non-candidate pack/review state;
- non-first-party example rights in these first-party packs;
- forbidden learner-state fields;
- unknown/self/cyclic prerequisite edges;
- incomplete or extra level-audit records;
- incomplete or extra grammar-audit records;
- malformed/duplicate catalog snapshot identities.

Review disagreements are different: they produce a valid plan with `status: BLOCKED_REVIEW` rather than destroying the preview.

## Current 115-concept expectation

With an empty catalog snapshot, all 115 candidate concepts can be represented as `WOULD_INSERT`, but the plan must remain `BLOCKED_REVIEW` because:

- the official CEFR-J 1.6 artifact is not yet LINGUA-hash-verified;
- lexical level mismatches remain unresolved;
- phrase/function review remains unresolved;
- all 8 grammar concepts remain review candidates;
- skill/can-do review remains unresolved.

That is intentional. Previewability is not import approval.

## Tests

`knowledge/tests/test_preview_import.py` covers no-apply behavior, unverified authority blocking, clean synthetic candidate-ready behavior while still `applySupported=false`, duplicate keys, unknown prerequisites, learner-state-field rejection, identity collision, no-op identity, blocking level disposition, and CLI rejection of `--apply`.

The implementation was exercised with Python stdlib `unittest`; no external dependency is required.

## Future apply task

A future bounded task may implement transactional apply only after:

1. CEFR-J 1.6 source snapshot is independently pinned;
2. 115-level/grammar/phrase/skill review resolves blockers;
3. current master schema/catalog anchors are re-audited after parallel sessions merge;
4. preview against staging shows an acceptable diff;
5. an independent reviewer approves the exact plan.

Do not add apply behavior to this script. Build a separately reviewed importer boundary instead.
