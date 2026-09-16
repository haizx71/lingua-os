# LINGUA OS — Grammar Audit of 8 Starter Concepts — 2026-09-16

Status: **evidence review complete; no concept production-approved by this audit alone**

Primary prior: CEFR-J Grammar Profile `20180315` from `openlanguageprofiles/olp-en-cefrj`.

Independent cross-check: current British Council LearnEnglish grammar resources, used only as a second teaching-level signal. A lesson labelled A1-A2 or B1-B2 does **not** prove every sub-form sits at the lower bound.

## Audit method

A LINGUA grammar concept is a pedagogical bundle. CEFR-J Grammar Profile rows are much more granular: polarity, interrogation, person, morphology and construction subtype may have different levels. British Council lessons group related forms into broader learner-level sections. The audit therefore asks whether a proposed LINGUA band is pedagogically defensible and whether its scope is explicit; it does not manufacture an “official CEFR level” for a grammar bundle.

## Results

| LINGUA concept | Proposed band | Evidence | Disposition |
|---|---|---|---|
| `subject-pronouns-basic` | A0 | CEFR-J personal-pronoun/`be` patterns are A1-oriented; British Council marks personal pronouns as beginner grammar | A0 internal scaffold review |
| `be-basic` | A0 | CEFR-J present `be` rows around A1.1; British Council `to be` sits in A1-A2 grammar | A0 internal scaffold review |
| `present-simple-core` | A1 | CEFR-J core lexical-verb forms mostly A1.1/A1.2 with some later variants; British Council present simple is A1-A2 | supported with form variance |
| `there-is-are` | A1 | no clean matching CEFR-J row; British Council explicitly teaches `there is/are` in A1-A2 | supported by independent level source |
| `past-simple-core` | A2 | CEFR-J forms span A1.3-A2.1; British Council past simple appears in A1-A2 material | supported with form variance |
| `comparatives-core` | A2 | CEFR-J `-er` starts A1.3 and `more + ADJ/ADV` A2.2; British Council treats comparative adjectives as beginner/A1-A2 grammar | supported with form variance |
| `first-conditional-core` | B1 | CEFR-J has indirect `if` evidence but no clean first-conditional row; British Council directly teaches first conditional in B1-B2 | supported by independent level source |
| `relative-clauses-basic` | B1 | CEFR-J relative markers span A1-B2; British Council defining relative clauses are B1-B2 | supported with form variance |

## Source links used for the second pass

- British Council, Present simple: `https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple`
- British Council, Present simple `to be`: `https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple-be`
- British Council, Personal pronouns: `https://learnenglish.britishcouncil.org/grammar/english-grammar-reference/personal-pronouns`
- British Council, Using `there is` / `there are`: `https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/using-there-there-are`
- British Council, Past continuous and past simple: `https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/past-continuous-past-simple`
- British Council, Comparative and superlative adjectives: `https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/comparative-superlative-adjectives`
- British Council, Conditionals zero/first/second: `https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/conditionals-zero-first-second`
- British Council, Defining relative clauses: `https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/relative-clauses-defining-relative-clauses`

## Design decisions strengthened by the audit

1. Grammar concepts need an explicit **scope contract**. `relative-clauses-basic` cannot imply that every relative-clause form is B1.
2. A bundled concept may have one product band while preserving several source rows and level ranges.
3. A second source can resolve a missing direct CEFR-J row as evidence, but it still cannot auto-approve the concept for production.
4. LINGUA A0 remains a product bootstrap layer. A0 grammar may be introduced before external A1-oriented profiles only when the UI/data make that distinction explicit.
5. Encountering a sub-form earlier than the bundle does not make the whole bundle mastered or learned.
6. Grammar level evidence must never mutate FSRS, competence, Save/Learn intent, exposure, Today completion, or learner skill state.

## Recommended production decisions

- Keep `be-basic` and `subject-pronouns-basic` as A0 **product scaffolding**, while preserving the fact that external evidence is beginner/A1-oriented.
- Keep `present-simple-core` at A1, but constrain V1 to common routines/general-truth statements plus ordinary negatives/questions; do not claim every person/polarity combination is equally early.
- `there-is-are` now has a credible second-source basis for A1. It still needs human sign-off, not another guessed CEFR-J row.
- Keep `past-simple-core` and `comparatives-core` at A2 as consolidated productive bundles, while allowing earlier passive exposure to common forms.
- `first-conditional-core` has a direct B1-B2 teaching-level cross-check from British Council, so B1 is a defensible product proposal; retain CEFR-J's lack of a direct row as provenance information.
- Keep `relative-clauses-basic` at B1 only if V1 is limited to basic defining clauses (`who/that/which`) and excludes non-defining clauses, complex attachment and advanced omission patterns.

Machine-readable source: `knowledge/grammar_audit_8.v1.json`.
