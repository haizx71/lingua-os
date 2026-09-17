# LINGUA OS — Preview-Only Knowledge Importer V1

Status: **implemented as research tooling; no apply mode; no database access**

## Purpose

`knowledge/preview_import.py` turns first-party candidate packs plus independent evidence audits into a deterministic, inspectable import plan. It cannot write PostgreSQL/Supabase and intentionally contains no `apply` command, database URL, service-role credential, migration path or network write.

This is the safety boundary between knowledge research and any future catalog importer.

## Current evidence contract

Current level audit: `knowledge/level_audit_115.v3.json`.

V3 delegates non-lexical evidence rather than pretending one word-list can certify every concept type:

- grammar: `knowledge/grammar_audit_8.v1.json`;
- phrases: `knowledge/phrase_audit_17.v1.json`;
- communicative skills: `knowledge/skill_audit_8.v1.json`.

For V3, phrase and skill audit inputs are mandatory whenever candidate packs contain those concept types. Their key sets must exactly equal the corresponding source-pack key sets.

Historical level audit V1/V2 remain readable for research comparison, but the current 115-pack workflow should use V3 because V1/V2 contained the audit-only key `phrase:because-simple-reason` instead of the real starter key `phrase:what-time`.

## CLI inputs

Required for the current 115-pack preview:

- one or more `--pack <candidate.json>`;
- `--level-audit knowledge/level_audit_115.v3.json`;
- `--grammar-audit knowledge/grammar_audit_8.v1.json`;
- `--phrase-audit knowledge/phrase_audit_17.v1.json`;
- `--skill-audit knowledge/skill_audit_8.v1.json`.

Optional:

- `--catalog-snapshot <json>`: read-only snapshot with schema `knowledge-catalog-snapshot.v1`;
- `--output <json>`: local preview report path.

There is no apply flag. Supplying `--apply` is rejected by `argparse`.

## Output

Schema: `knowledge-import-preview.v1`.

Per concept:

- `WOULD_INSERT`: canonical key absent from supplied snapshot;
- `WOULD_NOOP_EXISTING`: same stable key/type/form/POS identity already exists;
- `BLOCK_COLLISION`: same key exists with conflicting stable identity.

The report also records source-pack hashes, exact audit schema IDs, disposition counts, separate blockers/warnings, deterministic `planSha256`, and `applySupported: false` **always**.

A future clean plan may set `productionCandidateEligible: true`; this script still will not apply it.

## Review semantics

Top-level level-audit severity supports `blocker`, `warning`, `info`, and `delegated`.

- **blocker**: early placement, source disagreement, identity/POS issue, or another unresolved difficulty/identity risk;
- **warning**: conservative later placement or independent support where sources differ;
- **info**: non-blocking evidence state;
- **delegated**: the level audit deliberately hands authority to grammar/phrase/skill audit.

Type-specific audits then independently gate production. A grammar, phrase or skill record with `productionApproved != true` adds a review blocker even when its evidence supports the proposed curriculum band. Evidence sufficiency and human production approval are intentionally separate states.

This means “we found good evidence” never silently becomes “write to catalog”.

## Fail-closed structural checks

Preview fails immediately for:

- duplicate canonical keys across packs;
- level audit keys that do not exactly match all candidate keys;
- grammar/phrase/skill audit keys that do not exactly match their candidate type;
- missing V3 phrase/skill audit when those types exist;
- malformed audit schemas or duplicate audit records;
- invalid concept type/key prefix;
- missing or blank `canonicalForm`;
- unsupported curriculum band outside `LINGUA_A0/A1/A2/B1`;
- word without POS or non-word with a POS;
- non-candidate pack/review state;
- non-first-party example rights in these first-party packs;
- blank English/Vietnamese examples;
- forbidden learner-state fields anywhere in the pack;
- unknown/self/cyclic prerequisite edges;
- malformed catalog snapshot or duplicate catalog identities;
- unsupported explicit severity.

Review disagreements produce a valid deterministic `BLOCKED_REVIEW` plan rather than hiding the proposed diff.

## Current blocker shape

All 115 concepts should be structurally previewable once V3 and all three type audits are supplied, but production remains blocked because:

- CEFR-J 1.6 is still not a LINGUA-owned independently hash-verified binary snapshot;
- `far` has a canonical POS/identity mismatch awaiting atomic correction;
- `booking`, `cash`, `environment`, and `need` still need explicit curriculum decisions;
- `ask-basic-directions` needs scope narrowing/splitting between A1 location questions and A2 route-direction interaction;
- `make-a-plan` still needs exact collocation review;
- all grammar/phrase/skill records intentionally remain `productionApproved: false` until human sign-off.

`left` and `right` are no longer unresolved blockers: Oxford A1 evidence supports the current directional noun proposals.

## `far` identity handling

Current source pack: `word:far:adjective`, A2, example `The airport is far from here.`

Evidence review shows the intended distance use is adverbial. Proposed future atomic migration:

`word:far:adverb` / `partOfSpeech=adverb` / `LINGUA_A2`.

The preview importer never rewrites identities. Until the support pack and all coverage/audit references are changed together, the current identity remains blocked.

## Test status

The test suite now includes legacy behavior plus V3 cases for mandatory phrase/skill audit inputs, exact type-audit coverage, type-specific human approval gates, severity handling, structural concept validation, catalog collision/no-op, learner-state-field rejection and CLI rejection of `--apply`.

The earlier 18/18 isolated result applied to the preceding importer revision. After the V3 phrase/skill gate expansion, the updated GitHub tests still require an independent local/CI execution before any new pass count is claimed.

## Future apply boundary

Do **not** add apply behavior to `preview_import.py`.

A separate transactional importer may be designed only after:

1. CEFR-J 1.6 source snapshot is independently pinned and hashed by LINGUA;
2. V3 lexical blocker queue is resolved;
3. `far` identity migration is atomic across pack/coverage/audit artifacts;
4. grammar/phrase/skill records receive explicit human sign-off;
5. current master schema/catalog anchors are re-audited after parallel work merges;
6. preview against a read-only staging catalog snapshot shows the intended diff;
7. an independent reviewer approves the exact `planSha256`.

Even that future importer must remain catalog-only and must never create learner Save/Learn intent, FSRS state, competence, exposure, Today completion or other learner state.
