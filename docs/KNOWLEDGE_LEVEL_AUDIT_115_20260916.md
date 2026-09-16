# LINGUA OS — Level Audit of 115 Knowledge Concepts — 2026-09-16

Status: **coverage-corrected second-source review complete; not production level approval**

Current machine-readable audit: `knowledge/level_audit_115.v3.json`.

Historical artifacts:

- `level_audit_115.v1.json`: first pass against public CEFR-J v1.5 mirror;
- `level_audit_115.v2.json`: added Oxford cross-checks and blocker/warning semantics;
- `level_audit_115.v3.json`: current audit; fixes exact source-pack coverage and delegates grammar/phrase/skill evidence to type-specific audits.

## Scope

Exactly 115 first-party candidate concepts:

- 82 words;
- 17 phrases;
- 8 grammar concepts;
- 8 communicative skills.

The intended production lexical prior remains official **CEFR-J Wordlist 1.6**. Public release metadata is recorded, but LINGUA has not independently downloaded and hashed the binary in this environment. Production lexical authority therefore remains `OBSERVED_EXTERNAL_ONLY`.

## V3 coverage correction

During exact pack/audit comparison, V1/V2 were found to contain an audit-only key `phrase:because-simple-reason` while the actual starter inventory contains `phrase:what-time`.

V3 fixes that defect instead of silently editing the historical evidence files. This matters because the preview importer is deliberately fail-closed: the old audit and the actual 115-concept packs should not be allowed to appear compatible when their identities differ.

V3 also delegates:

- grammar → `knowledge/grammar_audit_8.v1.json`;
- phrases → `knowledge/phrase_audit_17.v1.json`;
- skills → `knowledge/skill_audit_8.v1.json`.

Word-level evidence is no longer allowed to masquerade as phrase, grammar or skill evidence.

## V3 disposition totals

All 115 concepts have exactly one top-level disposition:

- 20 `A0_INTERNAL_SCAFFOLD`;
- 1 `A0_STRETCH_REVIEW`;
- 29 `AGREES_WITH_V1_5_REFERENCE`;
- 8 `GRAMMAR_AUDIT_REQUIRED`;
- 2 `EARLY_PLACEMENT_CONFIRMED_BY_SECOND_SOURCE`;
- 4 `SUPPORTED_BY_SECONDARY_LEVEL_SOURCE`;
- 1 `SOURCE_DISAGREEMENT_HUMAN_REVIEW`;
- 1 `IDENTITY_MODEL_REVIEW_REQUIRED`;
- 24 `LINGUA_LATER_THAN_V1_5_REFERENCE`;
- 17 `PHRASE_AUDIT_REQUIRED`;
- 8 `SKILL_AUDIT_REQUIRED`.

Total: **115**.

## Main lexical findings

### Strongly supported corrections/cross-checks

- `menu` A1: Oxford evidence supports the current LINGUA A1 proposal despite CEFR-J v1.5 A2.
- `community` B1: Oxford supports the current B1 proposal despite CEFR-J v1.5 B2.
- `left` noun A1 and `right` noun A1: Oxford 3000 supports the current directional noun proposals, so these are no longer unresolved blockers.

### Real early-placement blockers

- `booking` noun: LINGUA A2 is earlier than both CEFR-J v1.5 and Oxford evidence. It should move later, be replaced in A2 microcontent, or receive an explicit human rationale.
- `cash` noun: LINGUA A1 is earlier than both cross-checks around A2. Keep only with an explicit survival-language rationale, otherwise move to A2.
- `need` verb: external evidence is not uniform, but ordinary use is still A1+ in the independent cross-check. LINGUA may expose it in A0 survival language while keeping that decision explicitly internal.

### Source disagreement

`environment` noun: CEFR-J v1.5 and Oxford differ materially. Current LINGUA B1 sits between them. V3 preserves the disagreement for human review instead of choosing whichever source is convenient.

### Identity bug: `far`

The support pack currently defines `word:far:adjective` at A2 with example `The airport is far from here.` The intended distance use is adverbial. Both learner-dictionary analysis and the CEFR-J POS split show why the adjective comparison was misleading.

Proposed atomic correction:

`word:far:adverb` / `partOfSpeech = adverb` / `LINGUA_A2`

The source pack has intentionally **not** been silently rewritten. The current identity remains blocked until the support pack plus every coverage/reference key can be changed together.

## Earlier versus later policy

The preview policy now distinguishes curriculum risk:

- teaching **earlier** than credible evidence can increase difficulty and is review-gated;
- teaching **later** is conservative and emits a warning rather than an automatic blocker.

This prevents benign conservative sequencing from being treated like an unsafe early-placement decision.

## Type-specific review status

### Grammar

All 8 concepts now have CEFR-J plus independent British Council evidence. None is production-approved automatically. Important scope findings include A0 as internal scaffold, A1 present-simple core, A2 consolidated past/comparative bundles, and B1 narrow first-conditional/defining-relative-clause bundles.

### Phrases

All 17 actual phrase keys now have a dedicated audit. Oxford Phrase List, British Council learner materials and CEFR clarification descriptors provide evidence for many of them. The audit distinguishes direct support, conservative later placement, internal A0 survival scaffolds and one unresolved collocation (`make-a-plan`).

### Communicative skills

All 8 skills now have can-do/task evidence. The main structural concern is `ask-basic-directions`: A1 is appropriate for a simple location question such as `Where is ...?`, while route-direction interaction is more clearly A2. The skill should therefore be narrowed or split before production approval.

## Current prioritized review queue

1. Atomically fix `far` concept identity/POS plus coverage references.
2. Resolve `booking` A2 versus later evidence.
3. Resolve `cash` A1 versus A2 evidence.
4. Make a human curriculum decision for `environment` source disagreement.
5. Decide how `need` functions in A0 survival exposure versus normal learn-level sequencing.
6. Narrow/split `ask-basic-directions` into A1 location question versus A2 route-direction interaction.
7. Decide exact treatment of `make-a-plan` after collocation review.
8. Human-sign off grammar/phrase/skill audit records rather than turning evidence into automatic approval.

## Production decision

**BLOCKED_ON_CEFRJ_1_6_LINGUA_SNAPSHOT_AND_REVIEW_QUEUE**

Production approval still requires a LINGUA-owned CEFR-J 1.6 snapshot/hash, deterministic rerun of the lexical audit, resolution of the blocker queue, exact type-audit coverage, preview against a read-only catalog snapshot, and independent review of the exact preview plan hash.

No audit result may mutate FSRS, competence, Save/Learn intent, exposure, Today completion or any learner state.
