# LINGUA OS — Level Audit of 115 Knowledge Concepts — 2026-09-16

Status: **provisional audit complete; not production level approval**

## Scope

This audit covers all 115 concepts in the current first-party candidate packs:

- 82 word concepts
- 17 phrase concepts
- 8 grammar concepts
- 8 communicative skill concepts

The lexical cross-check uses the public CEFR-J vocabulary profile **1.5 mirror** as a reproducible reference. The intended production prior remains the official **CEFR-J Wordlist 1.6**. The reported 1.6 checksum/row count is recorded as external evidence only until LINGUA independently downloads and hashes the official binary.

## Result

All 115 concepts received an explicit audit disposition. Nothing is silently treated as approved.

Word concepts (82):

- 29 agree with the v1.5 reference at the proposed A1/A2/B1 band.
- 24 are placed later by LINGUA than the v1.5 reference.
- 8 are earlier than the v1.5 reference and require review before production.
- 20 A0 words are normal internal bootstrap items whose nearest reference is A1.
- 1 A0 word (`need` as verb) is a stronger stretch: the v1.5 lexical row is A2, while a modal-auxiliary `need` row exists at A1. This must be reviewed rather than hidden by normalization.

Non-word concepts:

- 17 phrase concepts require phrase/function evidence; component-word levels are not substituted.
- 8 grammar concepts are delegated to `knowledge/grammar_audit_8.v1.json`.
- 8 skill concepts require can-do/function review; a vocabulary list cannot certify them.

## High-priority earlier-than-reference checks

The clearest `LINGUA earlier than reference` cases are:

- A1 proposal vs A2 reference: `menu`, `left` (noun), `right` (noun), `cash`.
- A2 proposal vs B2 reference: `far` as **adjective**. `far` as adverb is A2 in the reference, so POS identity matters.
- A2 proposal vs B1 reference: `booking`.
- B1 proposal vs B2 reference: `environment`, `community`.

These are review flags, not automatic errors. A curriculum may intentionally introduce an item earlier, but the rationale must be explicit.

## Later-than-reference is not automatically wrong

A large share of B1 pack words occur earlier in the reference, for example `goal`, `habit`, `reason`, `result`, `solution`, `opinion`, `advantage`, `manage`, and several support words. This means the B1 archetypes currently use many familiar lexical items to express more advanced communicative functions. That is pedagogically plausible and should not be “corrected” by moving every concept downward without considering intended use.

## Identity/normalization findings

The audit exposed several cases that a production importer must normalize explicitly:

- LINGUA `be:verb` vs CEFR-J source POS `be-verb`.
- LINGUA `have:verb` vs CEFR-J source POS `have-verb`.
- `doctor` appears in a bundled source headword such as `doctor/Dr./Dr`.
- `realize` appears in a spelling-variant source headword `realize/realise`.
- `far` must be matched by **part of speech**, because adjective and adverb levels differ.

Therefore source matching cannot be `lower(headword)` alone.

## Production decision

**BLOCKED_ON_CEFRJ_1_6_LINGUA_SNAPSHOT**

This audit must not rewrite `curriculumBand` automatically. Production approval requires:

1. LINGUA-owned download of the official CEFR-J 1.6 artifact;
2. locally computed SHA-256 and pinned source manifest;
3. rerun of the deterministic cross-checker on all lexical candidates;
4. human resolution of earlier/later/variant/POS conflicts;
5. separate phrase, skill, and grammar review.

Machine-readable source: `knowledge/level_audit_115.v1.json`.
