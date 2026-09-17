# Knowledge Import Normalization V1

Status: design-only / preview-first  
Branch: `chatgpt/knowledge-system-v1-2026-09-15`  
Production import: **NOT authorized**

## 1. Why this normalization layer exists

LINGUA OS must not map an upstream vocabulary row directly into `concepts`/`lexemes`. The sources we inspected already show cases that require deliberate normalization:

- the same surface form appears under different parts of speech and sometimes different levels;
- a single headword cell may contain orthographic alternatives separated by `/`;
- multi-word expressions appear next to single words;
- source POS labels include special categories such as `be-verb`, `modal auxiliary`, `infinitive-to`, `number`, etc.;
- source level/topic columns are evidence, not runtime truth;
- an upstream lexical record may map to several WordNet senses;
- Vietnamese translation candidates may not be equivalent to a learner-safe translated definition.

The importer therefore has two explicit boundaries:

`RAW SOURCE ROW -> NORMALIZED CANDIDATE -> REVIEWED CATALOG RECORD`

Only the last boundary is eligible for database apply.

## 2. Raw-source preservation

Every source artifact used by an importer MUST be pinned before parsing:

- source registry ID;
- upstream release/version;
- canonical download URL;
- retrieval timestamp;
- file byte length;
- SHA-256 checksum;
- licence/rights snapshot identifier;
- transform/parser version.

For each raw row preserve enough information to reproduce the transformation:

- 1-based row number or upstream record ID;
- exact unmodified field values;
- source file checksum;
- parser version;
- warnings generated during parsing.

Never destructively “clean” the only copy of the source row.

## 3. CEFR-J row normalization

The inspected CEFR-J mirror has columns roughly equivalent to:

- `headword`
- `pos`
- `CEFR`
- `CoreInventory 1`
- `CoreInventory 2`
- `Threshold`

The production importer must use the authoritative current release artifact, but the existing 1.5 mirror is sufficient to define normalization behavior and tests.

### 3.1 Headword handling

Do not assume one headword cell = one final concept.

Cases:

#### Simple single word

Example shape: `ability`, POS `noun`.

Candidate:

- concept type `word`;
- canonical form `ability`;
- normalized form from deterministic Unicode/case/whitespace normalization;
- POS normalized through the controlled POS map.

#### Multi-word lexical expression

Example shape: `according to`, `air conditioning`, `all right`.

Candidate:

- concept type `phrase`;
- retain internal spaces after whitespace normalization;
- do not split into independent word concepts merely for importing the phrase.

Component words may already exist separately, but no learner-state relation is inferred.

#### Slash-separated alternatives

Observed shapes include alternatives such as spelling variants or abbreviations.

Rules:

1. Slash presence always creates a normalization warning.
2. Parser may emit a *variant group candidate*, but never silently persist the raw slash string as a canonical key.
3. Automatic apply is forbidden until review resolves:
   - preferred canonical display form;
   - alternate forms;
   - whether alternatives are truly same lexical unit/POS/sense;
   - whether one item must become separate concepts.
4. Preserve every original form in source evidence.

This prevents a record such as `analyze/analyse` from becoming one strange lemma containing `/`, while also avoiding an unsafe blanket split for abbreviations or genuinely ambiguous expressions.

### 3.2 Word vs phrase classifier

Default candidate classifier:

- one lexical token after variant resolution -> `word`;
- two or more lexical tokens -> `phrase`;
- grammar-profile records -> `grammar`;
- manually curated communicative/phonological abilities -> `skill`.

Hyphenation alone does not automatically make an item a phrase. The classifier emits `classificationReason` and `needsReview` when tokenization is ambiguous.

## 4. Controlled POS normalization

Current PostgreSQL accepts free-text `part_of_speech`, but learner-facing APIs expose this field. V1 therefore normalizes source-specific labels into a compact internal vocabulary instead of leaking arbitrary upstream spelling.

Proposed importer vocabulary:

- `noun`
- `verb`
- `adjective`
- `adverb`
- `pronoun`
- `determiner`
- `preposition`
- `conjunction`
- `interjection`
- `numeral`
- `modal`
- `particle`

Initial CEFR-J mapping candidate:

| Source POS | Normalized POS | Additional evidence |
|---|---|---|
| noun | noun | none |
| verb | verb | none |
| adjective | adjective | none |
| adverb | adverb | none |
| pronoun | pronoun | none |
| determiner | determiner | none |
| preposition | preposition | none |
| conjunction | conjunction | none |
| interjection | interjection | none |
| number | numeral | source POS retained |
| be-verb | verb | subtype `be` |
| have-verb | verb | subtype `have` |
| do-verb | verb | subtype `do` |
| modal auxiliary | modal | source POS retained |
| infinitive-to | particle | subtype `infinitive-to` |

Any unseen POS fails closed into an ambiguity report. Do not coerce unknown labels to `other` and continue.

This table is an importer policy, not a public API enum. If later product behavior depends on finer POS distinctions, that requires a bounded decision rather than hidden metadata authority.

## 5. Canonical-key normalization

Canonical keys are durable product identities and must not depend on row number or mutable display text.

Candidate format:

- word: `word:<normalized-form>:<normalized-pos>`
- phrase: `phrase:<normalized-expression>`
- grammar: `grammar:<stable-code>`
- skill: `skill:<stable-code>`

Normalization for lexical forms:

1. Unicode normalize to NFC.
2. Trim leading/trailing Unicode whitespace.
3. Collapse internal whitespace runs to a single ASCII space.
4. Case-fold for the key-normalized form while preserving display form separately.
5. Preserve apostrophes/hyphens when lexically meaningful.
6. Do not remove diacritics.
7. Reject empty values, control characters and unreviewed slash-variant groups.

Collision behavior:

- exact same candidate identity + same source payload -> replay/no-op;
- exact identity + compatible new source evidence -> attach candidate evidence in preview, no automatic semantic merge;
- exact identity + conflicting POS/meaning/level structure -> blocking conflict;
- two different upstream records mapping to the same canonical key never delete/overwrite one another automatically.

## 6. Level evidence normalization

### 6.1 CEFR-J input

Normalize source labels only when they match the accepted level vocabulary for the source release. Unknown labels fail closed.

V1 import target for learner-facing mapping is a single primary level per concept because current Dictionary/Brain projections select one mapping row by confidence then UUID.

Candidate record therefore separates:

- `primaryLevel`: the one proposed runtime mapping;
- `levelEvidence[]`: all reviewed supporting/conflicting source observations.

A source observation contains:

- framework/source name;
- source release;
- raw level label;
- normalized level;
- confidence;
- rationale/reviewer status;
- source record reference.

No Council-of-Europe “official word level” claim is generated.

### 6.2 Pre-A1/A0 bootstrap

CEFR-J vocabulary begins at A1. LINGUA OS may need a very small pre-A1/A0 bootstrap set for absolute beginners. Those units must be first-party curated and explicitly labelled as LINGUA curriculum scaffolding, not misrepresented as CEFR-J rows.

## 7. Topic evidence normalization

Columns such as CEFR-J Core Inventory / Threshold are useful topic evidence, but they are not automatically LINGUA topic IDs.

Pipeline:

1. retain raw source topic strings;
2. normalize whitespace/case only for comparison;
3. map through an explicit reviewed topic crosswalk;
4. unknown topic strings become review warnings;
5. importer never creates a new runtime topic silently;
6. a topic mapping carries source provenance.

No topic signal affects learner competence.

## 8. Open English WordNet matching

CEFR-J lemma/POS candidates can be matched to Open English WordNet only after identity normalization.

Matching tiers:

### Tier 0 — no match

Keep the curriculum candidate. A WordNet match is useful but not mandatory. Do not fabricate a definition.

### Tier 1 — one plausible sense

Create a definition candidate with OEWN synset/source identity. Human review still required before learner-facing approval.

### Tier 2 — several plausible senses

Emit all plausible sense candidates plus an ambiguity report. A reviewer selects a deliberately small pedagogical core-sense bundle.

### Tier 3 — incompatible/obscure senses only

Reject automatic enrichment; author a first-party explanation or postpone the concept.

Never merge all WordNet senses into one beginner concept merely because lemma/POS matches.

## 9. Vietnamese candidate normalization

PanLex or another approved bilingual source may propose English↔Vietnamese equivalents, but final learner support is a reviewed pedagogical explanation.

Candidate fields distinguish:

- bilingual equivalent candidate;
- translated definition draft;
- first-party reviewed Vietnamese explanation.

Only the final reviewed field may populate learner-facing `translated_definition` in V1.

Machine-generated Vietnamese drafts, if ever used during authoring, must be marked as generated and cannot be auto-approved.

## 10. Forms normalization

Initial pack should avoid importing a large external morphology database.

Allowed sources:

- deterministic regular morphology rules with transform version;
- manually reviewed irregular forms;
- variants explicitly resolved from approved source rows.

Each form records:

- surface form;
- normalized form;
- form type;
- derivation source (`rule`, `source-variant`, `manual`);
- source/transform reference.

Do not create a new concept for a regular inflection unless it is independently pedagogical under an accepted design.

## 11. Phrase/collocation normalization

A candidate phrase requires:

- exact canonical expression;
- pedagogical meaning/use;
- evidence that it is useful enough for the current A0–B1 content;
- reviewed examples;
- source rights/provenance.

Do not import thousands of phrasal verbs from an unverified generated repository simply because the repository licence says MIT. Generated-language data must still have an auditable upstream chain.

## 12. Example normalization

V1 learner-facing examples are first-party original by default.

Normalized example candidate includes:

- English text;
- NFC-normalized text;
- Vietnamese translation;
- intended level band;
- source/right identity;
- target concept occurrences;
- each occurrence's exact UTF-16 `[startOffset,endOffset)`;
- review state.

Validation MUST recompute offsets from the exact persisted English string, including surrogate pairs. The target substring must correspond to the declared form/phrase unless the occurrence is explicitly grammar/skill evidence.

## 13. Relation normalization

Allowed runtime relation types remain exactly the implemented set:

- `synonym`
- `antonym`
- `prerequisite`
- `family`
- `related`

External relation taxonomies must map through an explicit crosswalk. Unknown relation types are not silently downgraded to `related`.

`prerequisite` requires human pedagogical review and global cycle validation. WordNet hypernymy is **not** automatically a prerequisite.

No relation transfers Save/Learn, FSRS, competence, status or exposure.

## 14. Candidate lifecycle

Normalized candidates have a non-runtime review lifecycle:

- `parsed`
- `needs_review`
- `approved`
- `rejected`

Only `approved` records from `PRIMARY_CANDIDATE` or explicitly first-party sources can enter apply mode.

`REFERENCE_ONLY`, `CANDIDATE_QUARANTINE` and `REJECT_MVP` can appear in evidence/research reports but are rejected by the production apply validator.

## 15. Preview contract

Before database apply, importer outputs a deterministic manifest with:

- source fingerprints;
- total raw rows;
- parse success/failure counts;
- candidate counts by type/level/POS;
- variant groups requiring review;
- unknown POS/topic/level values;
- identity collisions;
- missing definitions;
- missing Vietnamese review;
- ambiguous WordNet matches;
- relation-cycle errors;
- invalid UTF-16 spans;
- planned inserts;
- planned compatible evidence additions;
- planned conflicts/no-ops;
- learner-state tables expected to remain untouched.

Preview must be serializable and stable for identical inputs. Human review is performed against this artifact, not against hidden importer logs.

## 16. Apply contract

Apply mode is a future implementation task and must:

- require an exact reviewed preview fingerprint;
- abort if source artifacts changed after preview;
- run in one transaction per approved pack;
- preserve existing acceptance anchor records;
- never delete unknown catalog records automatically;
- be idempotent on exact replay;
- fail closed on rights/identity/level/review ambiguity;
- write only approved catalog/content-provenance tables;
- prove zero learner-state mutation before commit.

No Supabase apply is authorized by this document.

## 17. Tests derived from observed CEFR-J shapes

A future parser test set should include at minimum:

- ordinary noun: one word, one POS, one level;
- same spelling under two POS rows;
- same spelling with distinct levels by POS;
- multi-word preposition/expression;
- slash spelling variant pair;
- slash abbreviation/casing variants;
- `be-verb`, `have-verb`, `do-verb`;
- `modal auxiliary`;
- `infinitive-to`;
- `number`;
- one/two topic columns;
- unknown POS;
- unknown level;
- duplicate source row;
- canonical-key collision;
- multiple OEWN senses;
- no OEWN sense;
- Vietnamese candidate with multiple translations;
- invalid UTF-16 span;
- prerequisite cycle.

These tests should use tiny synthetic fixtures derived from structural shapes, not copied source rows, unless the source licence/provenance is pinned in the test artifact.
