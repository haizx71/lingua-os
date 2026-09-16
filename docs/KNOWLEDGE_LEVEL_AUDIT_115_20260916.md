# LINGUA OS — Level Audit of 115 Knowledge Concepts — 2026-09-16

Status: **second-source review complete; not production level approval**

Current machine-readable audit: `knowledge/level_audit_115.v2.json`.

`knowledge/level_audit_115.v1.json` remains an immutable first-pass artifact based primarily on the public CEFR-J v1.5 mirror. V2 adds independent cross-check evidence and a stricter blocker/warning policy rather than silently rewriting the first pass.

## Scope

The audit covers all 115 first-party candidate concepts:

- 82 word concepts;
- 17 phrase concepts;
- 8 grammar concepts;
- 8 communicative skill concepts.

The intended production lexical prior remains official **CEFR-J Wordlist 1.6**. Its public release metadata is recorded, but the binary is still not a LINGUA-owned verified snapshot in this environment. Therefore the overall production authority remains blocked.

## Important interpretation rule

CEFR describes proficiency/ability. Individual word or grammar labels from CEFR-J, Oxford or another learner resource are curriculum evidence, not a universal official truth and never learner-state authority.

For this reason V2 distinguishes:

- **blockers**: an item is earlier than multiple references, sources materially disagree, concept identity/POS is wrong, or evidence for phrases/skills is unresolved;
- **warnings**: LINGUA intentionally teaches an item later than a reference, or an independent source supports the proposed band even though the first source differed;
- **internal scaffolds**: A0/Pre-A1 items used as product bootstrap without claiming an external A0 lexical certification.

## V2 disposition totals

All 115 concepts still have exactly one level-audit disposition:

- 20 `A0_INTERNAL_SCAFFOLD`;
- 1 `A0_STRETCH_REVIEW`;
- 29 `AGREES_WITH_V1_5_REFERENCE`;
- 8 `GRAMMAR_AUDIT_REQUIRED`;
- 2 `EARLY_PLACEMENT_CONFIRMED_BY_SECOND_SOURCE`;
- 2 `EARLY_PLACEMENT_UNRESOLVED`;
- 2 `SUPPORTED_BY_SECONDARY_LEVEL_SOURCE`;
- 1 `SOURCE_DISAGREEMENT_HUMAN_REVIEW`;
- 1 `IDENTITY_MODEL_REVIEW_REQUIRED`;
- 24 `LINGUA_LATER_THAN_V1_5_REFERENCE`;
- 17 `PHRASE_REQUIRES_SEPARATE_EVIDENCE`;
- 8 `SKILL_REQUIRES_CAN_DO_REVIEW`.

## High-value findings from the independent lexical cross-check

### `menu` — A1 proposal now has independent support

CEFR-J v1.5 placed the matched noun at A2, while Oxford learner/topic material places `menu` in A1-oriented cooking/eating vocabulary. V2 therefore no longer treats LINGUA A1 as a hard early-placement error. It remains a warning until the production source snapshot is pinned.

### `community` — B1 proposal now has independent support

CEFR-J v1.5 placed the matched noun at B2; Oxford learner/topic material places `community` at B1 in the people/society domain. LINGUA B1 is therefore defensible as a product proposal.

### `environment` — sources disagree materially

CEFR-J v1.5 places the matched noun at B2, while Oxford learner/topic material for the environmental sense places it around A2. LINGUA currently proposes B1. Rather than selecting whichever source is convenient, V2 records `SOURCE_DISAGREEMENT_HUMAN_REVIEW` and preserves both signals.

### `cash` — A1 remains genuinely early

Both the CEFR-J v1.5 comparison and Oxford learner/topic evidence support approximately A2 for the basic money sense. LINGUA A1 is therefore an explicit early-teaching proposal and remains a blocker until a human records a survival-language rationale or moves it to A2.

### `booking` — strongest current lexical level concern

CEFR-J v1.5 places the noun around B1 and Oxford travel/holiday learner material places it later still. The current LINGUA A2 proposal is earlier than both. This is high priority: move it later, replace it in A2 microcontent, or explicitly justify early teaching.

### `need` — still an A0 stretch, but source evidence is not uniform

The CEFR-J v1.5 lexical comparison exposed an A2 row (with modal-auxiliary evidence around A1), while Oxford learner-list evidence treats the common verb at A1. LINGUA may keep `need` visible in A0 survival expressions, but A0 must remain an internal bootstrap decision rather than an external lexical-level claim.

## Identity bug discovered: `far`

The support pack currently defines:

- key: `word:far:adjective`;
- band: `LINGUA_A2`;
- example: `The airport is far from here.`

That example uses the intended distance sense in an adverbial/predicative pattern. The POS-specific cross-check explains the apparent level conflict: CEFR-J v1.5 has adverb `far` around A2 while adjective `far` is later; Oxford's adjective analysis is also not the intended identity for this example.

V2 therefore marks the current identity as `IDENTITY_MODEL_REVIEW_REQUIRED` and proposes:

`word:far:adverb` / `partOfSpeech = adverb` / `LINGUA_A2`

The source pack has **not** been silently rewritten in the audit. Production preview must remain blocked until the source pack and all coverage references are updated together, so no dangling canonical key can be introduced.

## Earlier/later policy correction

V1 treated both earlier-than-reference and later-than-reference items as import blockers. V2 corrects that policy:

- teaching **earlier** than credible evidence can increase learner difficulty and needs explicit review;
- teaching **later** is generally conservative and therefore produces a warning, not an automatic blocker.

This distinction is now implemented in the preview-only importer.

## Non-word concepts

Vocabulary evidence cannot certify phrases, grammar or communicative skills:

- 17 phrase concepts still require phrase/function evidence;
- 8 grammar concepts are delegated to `knowledge/grammar_audit_8.v1.json`, now with CEFR-J plus British Council cross-checks;
- 8 skills still require can-do/function review.

## Current prioritized review queue

1. Fix the `far` identity/POS mismatch before any level decision.
2. Resolve `booking` A2 versus later evidence.
3. Resolve `cash` A1 versus A2 evidence.
4. Resolve the exact directional identity/level of `left` and `right`.
5. Make an explicit human curriculum decision for `environment`, where reputable sources disagree.
6. Decide whether `need` remains A0 survival/bootstrap exposure while its normal learning band stays A1+.

## Production decision

**BLOCKED_ON_CEFRJ_1_6_LINGUA_SNAPSHOT_AND_REVIEW_QUEUE**

Production approval still requires:

1. a LINGUA-owned download of official CEFR-J 1.6;
2. locally computed SHA-256 plus pinned source manifest;
3. deterministic rerun of lexical cross-checking;
4. resolution of the V2 blocker queue, including the `far` canonical identity change;
5. phrase and skill evidence review;
6. grammar human sign-off;
7. preview against a read-only catalog snapshot;
8. independent review of the exact preview plan.

No audit result may mutate FSRS, competence, Save/Learn intent, exposure, Today completion or any learner state.
