# LINGUA OS — Grammar Audit of 8 Starter Concepts — 2026-09-16

Status: **review complete; no concept production-approved by this audit alone**

Reference: CEFR-J Grammar Profile `20180315` from `openlanguageprofiles/olp-en-cefrj`.

## Audit method

A LINGUA grammar concept is a pedagogical bundle. CEFR-J Grammar Profile rows are more granular: polarity, interrogation, person, morphology and construction subtype may have different levels. The audit asks whether the proposed band is defensible, not whether one row can be copied as an “official level”.

## Results

| LINGUA concept | Proposed band | Source evidence | Disposition |
|---|---|---|---|
| `subject-pronouns-basic` | A0 | personal-pronoun + `be` patterns begin around A1 | A0 internal scaffold review |
| `be-basic` | A0 | present `be` affirmative/negative/interrogative rows around A1.1 | A0 internal scaffold review |
| `present-simple-core` | A1 | lexical-verb present rows mostly A1.1/A1.2; some forms later | supported with form variance |
| `there-is-are` | A1 | no direct inspected profile row | no direct profile row |
| `past-simple-core` | A2 | forms span roughly A1.3–A2.1 | bundle spans levels |
| `comparatives-core` | A2 | `-er` A1.3, `more + ADJ/ADV` A2.2; superlatives also span A1–A2 | bundle spans levels |
| `first-conditional-core` | B1 | generic `if` clause A2.1; second conditional B1.2; no direct first-conditional row | indirect evidence only |
| `relative-clauses-basic` | B1 | `who` A1.3, `that` A1.1, `which` B2.2 | bundle spans A1–B2 |

## Design changes from the audit

1. Grammar concepts must retain **scope text**. `relative-clauses-basic` cannot imply every relative-clause form is B1.
2. A bundled concept may have one product band while retaining multiple source evidence rows.
3. Missing direct evidence (`there is/are`, first conditional) must remain visible instead of being filled by a guessed level.
4. LINGUA A0 is explicitly a product bootstrap layer. A0 grammar can be taught before a source’s A1 band without claiming CEFR-J certification.
5. Grammar level evidence must never mutate FSRS, competence, Save/Learn intent, or learner skill state.

## Recommended review decisions before production

- Keep `be-basic` and `subject-pronouns-basic` as A0 **product scaffolding**, but label their external evidence as A1-oriented.
- Keep `present-simple-core` at A1 only if its V1 scope is narrowed to high-frequency core forms rather than every negative/interrogative/person variant.
- Keep `past-simple-core` and `comparatives-core` at A2 as consolidated bundles while storing evidence that some subforms occur earlier.
- Do not approve `there-is-are` until a second authoritative/reference source or explicit human curriculum decision is recorded.
- Do not claim `first-conditional-core = B1` from CEFR-J Grammar Profile alone; the inspected profile supplies only indirect evidence.
- Narrow `relative-clauses-basic` to a reviewed core, for example common `who/that` use, before deciding whether `which` belongs in the same teaching concept.

Machine-readable source: `knowledge/grammar_audit_8.v1.json`.
