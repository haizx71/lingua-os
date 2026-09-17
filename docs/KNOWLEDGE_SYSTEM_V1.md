# LINGUA OS — Knowledge System V1

Status: research/design candidate only  
Branch: `chatgpt/knowledge-system-v1-2026-09-15`  
Base: `561bbc27e10b4d44637d5c14a6ce00d3514522ea`  
Scope: English for Vietnamese learners, approximately A0–B1

## 1. Purpose

The Knowledge System is the curated language-data layer that supplies concepts, meanings, forms, examples, level evidence and prerequisite structure to the already accepted learner loop. It must improve what LINGUA OS can teach without changing the frozen learner semantics.

It is intentionally separate from learner state:

- catalog knowledge says what a concept is and how it can be taught;
- learner evidence says what a specific learner has encountered or demonstrated;
- FSRS says when an activated concept should be reviewed;
- competence says how strong recognition/listening/production evidence is;
- explicit Save/Learn remains the only memory-activation boundary.

No catalog import may create learner state, review items, FSRS state, competence evidence or Save/Learn intent.

## 2. Existing schema fit

The current PostgreSQL model is already sufficient for a useful first catalog slice:

- `concepts`: stable knowledge identity; types `word`, `phrase`, `grammar`, `skill`.
- `lexemes`: canonical lemma/POS for lexical concepts.
- `lexeme_forms`: inflected and alternate surface forms.
- `word_senses`: English definitions and Vietnamese translated definitions.
- `concept_relations`: `synonym`, `antonym`, `prerequisite`, `family`, `related`.
- `framework_mappings`: proficiency-level mapping with confidence and provenance.
- `topics` / `concept_topics`: thematic organization.
- `sentences`, `sentence_translations`, `sentence_concepts`: examples and exact occurrence spans.
- `licenses`, `data_sources`, `source_records`: provenance, rights, transforms and review state.

V1 should therefore prefer data population and validation over a new migration.

## 3. Important current limitations

### 3.1 Sense granularity

External resources such as English Vocabulary Profile show that CEFR difficulty is often sense-specific. The current runtime, however, has one primary FSRS lineage per learner/concept and the current lexeme uniqueness model makes same-lemma/same-POS concepts awkward to split by sense.

For V1, define a lexical concept as one pedagogical `lemma + part-of-speech` teaching unit with a deliberately small core sense bundle. Do not claim sense-specific mastery. Advanced or materially different senses should remain out of the A0–B1 production pack until a later accepted design addresses sense identity.

### 3.2 Level mapping selection

Current Dictionary/Brain read models select one `framework_mappings` row by highest confidence and then UUID. Therefore V1 MUST write exactly one primary CEFR/CEFR-J mapping per concept. Conflicting level evidence belongs in provenance metadata and review notes, not as equally authoritative rows that create UUID-dependent behavior.

### 3.3 Grammar/skill explanations

`word_senses` attaches through `lexemes`, so the existing Brain definition projection naturally serves word/phrase concepts but not grammar/skill concepts. Do not create fake lexemes for grammar or skill concepts merely to make a UI definition appear. V1 may still use grammar/skill concepts for mapping, prerequisites and examples; a future bounded contract/schema task can add first-class explanatory content if real self-use proves it necessary.

### 3.4 Pronunciation data

The architecture specification mentions pronunciation, but the implemented core schema/API does not currently expose a canonical pronunciation entity. Do not silently overload unrelated metadata. Keep pronunciation sources in the source registry and defer persistence to a bounded future task.

### 3.5 Bilingual lexical meaning

PanLex supplies lexical equivalence, while `word_senses.translated_definition` is a translated definition field. These are not semantically identical. For the first production pack, Vietnamese explanations/translated definitions should be first-party reviewed text. PanLex may provide candidate evidence, not an automatic final definition.

## 4. Knowledge layers

### Layer A — curriculum authority

Purpose: decide which teaching units are useful at A0/A1/A2/B1 and in what approximate order.

Primary evidence:

1. CEFR / CEFR Companion Volume for communicative can-do framing, not word-level certification.
2. CEFR-J Wordlist 1.6 for a commercially usable vocabulary-level prior with required citation.
3. CEFR-J Grammar Profile for a grammar-level prior, again as evidence rather than absolute truth.
4. NGSL as a general-English usefulness/frequency signal, not a CEFR authority.
5. English Profile only as a human validation reference because bulk reuse rights are not established for this project.

### Layer B — lexical meaning

Primary production candidate: Open English WordNet, CC BY 4.0, filtered to the selected A0–B1 curriculum. Definitions and semantic relations must retain attribution/provenance and receive pedagogical review; WordNet is a lexical database, not a learner dictionary.

Vietnamese support:

- first-party concise Vietnamese definitions/explanations are preferred for V1;
- PanLex (CC0) can supply translation candidates and cross-checks;
- candidates must be reviewed because lexical equivalence is context/sense dependent.

### Layer C — forms

Use the existing `lexeme_forms` model. Populate only forms that improve lookup or teaching. Start with first-party/deterministic regular morphology plus reviewed irregular forms. UniMorph can be evaluated later but is share-alike licensed and should not be copied casually into the production catalog.

### Layer D — phrase/formulaic knowledge

Phrases are first-class `phrase` concepts, not annotations on single words. Include high-value:

- fixed expressions;
- phrasal verbs;
- common verb–noun and adjective–noun collocations;
- discourse frames and functional chunks.

Do not import a large collocation dump merely because it exists. Several useful datasets are non-commercial/share-alike. First-party reviewed phrase sets are legally and pedagogically safer for the initial pack.

### Layer E — examples/content

Production examples should be first-party original initially. This avoids hidden copyright contamination and lets us control level, Vietnamese translation, target density and exact UTF-16 spans.

Tatoeba, Common Voice, Leipzig corpora and other corpora are useful research/candidate sources but have different redistribution constraints. No corpus sentence becomes learner-facing without a per-source rights decision.

### Layer F — Vietnamese L1 adaptation

Population-level Vietnamese learner research can influence ranking and authoring priorities, never individual mastery. High-value areas repeatedly reported in Vietnamese EFL studies include:

- English final consonants and consonant clusters;
- /θ/ and /ð/ substitutions;
- word stress and selected vowel contrasts;
- tense/aspect;
- articles;
- prepositions;
- plural/agreement;
- verb–noun and adjective–noun collocations.

Represent this only as a small pedagogical prior/review tag. Actual learner evidence must override population assumptions.

## 5. Pedagogical design rules

### 5.1 Core curriculum, not dictionary dump

A learner-facing catalog should start compact and reviewed. A very large dictionary is useful for lookup, but it is not automatically a good curriculum. Build a reviewed A0–B1 core first, then expand based on real reading/lookup demand.

### 5.2 Meaning and form are distinct

Do not equate surface word frequency with concept mastery. Keep lemma/POS, forms, sense text, phrase units and grammar units explicit.

### 5.3 Receptive and productive ability differ

Catalog metadata may identify intended teaching role, but learner authority remains the existing recognition/listening/production competence projections. A phrase can be easy to recognize and difficult to produce; the catalog must not collapse those outcomes into a single mastery claim.

### 5.4 Coverage is a content-fit signal

Vocabulary coverage research supports high known-word coverage for comfortable comprehension, but LINGUA OS should use coverage as a recommendation signal rather than a mastery threshold. Reader difficulty should consider known/learning coverage, target-new density, curriculum level, sentence/syntax complexity, topic/goal and learner evidence.

### 5.5 Four-strand compatibility

The catalog should be usable by meaning-focused input, meaning-focused output, language-focused learning and fluency work. V1 does not change Today scheduling, but knowledge records should not be designed as flashcards only.

## 6. Concept identity rules for V1

Recommended stable keys:

- word: `word:<normalized-lemma>:<normalized-pos>`
- phrase: `phrase:<normalized-expression>`
- grammar: `grammar:<stable-grammar-code>`
- skill: `skill:<stable-skill-code>`

Rules:

- canonical keys are stable identifiers, not display strings;
- case and punctuation normalization must be deterministic and versioned;
- never reuse a key for a different semantic unit;
- imports are idempotent by upstream source identity + transform version;
- source hashes are retained;
- no automatic destructive merge of homographs/polysemes;
- no concept becomes production-eligible before provenance and pedagogical review pass.

## 7. Source-record policy

Prefer one source record for each upstream record or narrowly traceable transformed unit. `source_records.metadata` may contain evidence such as:

- upstream row/key;
- upstream release/version;
- transform version;
- original level signal(s);
- level-selection rationale;
- frequency/usefulness band;
- Vietnamese-L1 pedagogical priority;
- manual-review actor/date/version;
- candidate-vs-authoritative flags.

Do not use metadata to hide new product authority that should become a real schema field. If runtime begins depending on a metadata property, stop and propose a bounded schema/contract decision.

## 8. Proposed A0–B1 selection pipeline

1. Build candidate lemma/POS rows from CEFR-J 1.6, restricted to A1–B1 plus a small first-party Pre-A1/A0 bootstrap set.
2. Add NGSL usefulness signal where licensing/provenance is verified.
3. Match selected lexical units to Open English WordNet senses conservatively.
4. Draft concise learner-safe English definitions and Vietnamese explanations; use PanLex only as translation evidence.
5. Add high-value first-party phrases/collocations and grammar concepts.
6. Add deterministic/reviewed forms.
7. Author original example sentences at the target level and map exact UTF-16 spans.
8. Build prerequisite edges only where pedagogically defensible; no generated dense graph.
9. Validate provenance, license, duplicate identity, offsets, graph cycles, level ambiguity and publication readiness.
10. Preview import; human review; only then write catalog data.

## 9. Content-fit heuristic candidate

No ML model is needed for the first version. A future bounded recommender may expose reason codes derived from:

- learner-known coverage;
- learner-learning coverage;
- unknown target density;
- selected concept levels;
- sentence length and deterministic syntactic complexity;
- topic/goal fit;
- recent exposure/review state;
- small Vietnamese-L1 difficulty prior.

This must remain separate from competence and FSRS calculations.

## 10. Non-goals for V1

- no AI-generated catalog accepted without human review;
- no automatic scraping of commercial learner dictionaries;
- no bulk import of English Profile;
- no direct import of restricted/non-commercial learner corpora;
- no pronunciation schema change;
- no sense-specific FSRS redesign;
- no Today algorithm rewrite;
- no new learner-state writes;
- no cloud deployment from this branch.

## 11. Acceptance gates before a production import

A pack is importable only when all are true:

- every record has traceable source/version/license;
- commercial-use constraints are satisfied for the intended deployment;
- CEFR labels are represented as evidence, not official Council-of-Europe certification;
- every imported concept has one deterministic primary level mapping at most;
- no duplicate canonical identities;
- no prerequisite cycle;
- all sentence spans are valid UTF-16 offsets;
- examples/translations have explicit rights and review state;
- import is deterministic/idempotent and previewable;
- import does not touch learner-state/FSRS/competence tables;
- existing backend/contracts/frontend remain unchanged unless a separate task explicitly approves a change.
