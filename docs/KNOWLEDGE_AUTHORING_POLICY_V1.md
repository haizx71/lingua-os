# Knowledge Authoring Policy V1

Status: research/design candidate; no runtime/schema change authorized.  
Applies to: first-party and reviewed imported English knowledge used by Vietnamese learners at approximately Pre-A1/A0–B1.

## 1. What a “good concept” means in LINGUA OS

A concept is not a flashcard row and not a mastery score. It is a stable pedagogical unit that other systems can reference.

A production-ready concept should have, where applicable:

1. **Identity** — stable canonical key, type and language.
2. **Form** — learner-facing lemma/expression, POS and useful surface forms.
3. **Core meaning** — concise learner-safe English meaning.
4. **Vietnamese support** — concise first-party reviewed explanation/translated definition; not a blind machine translation.
5. **Usage** — phrase/collocation or grammar role where relevant.
6. **Level evidence** — one primary curriculum mapping with source + confidence/rationale.
7. **Context** — multiple quality examples over time, preferably from genuinely different contexts.
8. **Relations** — sparse, reviewed prerequisite/family/synonym/antonym/related links.
9. **Provenance** — source release, record identity, hash/transform and attribution.
10. **Review state** — automatic candidate generation and human approval are distinguishable.

Not every concept type uses every field. Never create fake lexical rows merely to make a grammar/skill concept resemble a word.

## 2. Concept boundaries

### Word concepts

V1 pedagogical identity: roughly `lemma + part-of-speech + curated core sense bundle`.

Reason: external lexical profiles can be sense-specific, but the current LINGUA OS runtime has one FSRS lineage per concept and a lexeme uniqueness model that does not cleanly support multiple same-lemma/POS teaching concepts. A future accepted sense-identity task may refine this.

Rules:

- do not merge different POS merely because spelling is identical;
- do not teach obscure senses inside an A0–B1 core concept;
- do not claim the learner knows every dictionary sense after learning the concept;
- keep inflected forms as forms, not automatically separate concepts, unless they are pedagogically exceptional.

### Phrase concepts

Use a first-class phrase concept when the expression has conventional meaning/use that is pedagogically worth learning as a unit, for example:

- phrasal verbs;
- fixed/semi-fixed expressions;
- high-value collocations;
- discourse frames;
- functional chunks.

Knowing every component word does not imply knowing the phrase, and learning the phrase does not mark component words mastered.

### Grammar concepts

Grammar concepts are stable teaching/use distinctions, not every possible rule wording. Candidate progression should be checked against CEFR-J Grammar Profile and real content needs.

Examples of candidate families, to validate rather than treat as official CEFR assignments:

- basic `be` / subject pronouns / simple noun phrases;
- singular/plural, articles and basic determiners;
- present simple and basic questions/negation;
- `can`, imperatives and high-frequency modal functions;
- present continuous;
- past simple;
- countability and quantifiers;
- comparatives/superlatives;
- future plans/predictions;
- present perfect core uses;
- infinitive/gerund high-frequency patterns;
- common preposition patterns;
- first conditional and basic relative clauses;
- core B1 passive/reporting/complex-clause patterns only where real content requires them.

Do not add grammar concepts solely to inflate curriculum coverage.

### Skill concepts

A skill concept represents a teachable communicative/linguistic ability, not an inferred learner score. Examples may include request/clarification functions or future pronunciation/listening targets.

The existence of a skill concept does not create `user_skill_states`; learner skill state remains evidence-derived.

## 3. Vietnamese-first authoring

The product should help a Vietnamese learner without assuming every Vietnamese learner has the same weaknesses.

### Allowed population priors

Use research to increase review attention for areas such as:

- English final consonants/clusters;
- /θ/ and /ð/, stress and selected sound contrasts;
- articles and countability;
- tense/aspect;
- prepositions;
- plural/agreement;
- lexical collocations and synonym misuse.

### Forbidden inference

Never set a user weakness, competence value, FSRS state or Today priority merely because the learner's native language is Vietnamese.

### Vietnamese explanation style

Prefer:

- short natural Vietnamese;
- one core distinction at a time;
- contrast only when it prevents a likely misunderstanding;
- examples that sound contemporary and plausible;
- avoid dictionary-style circular definitions and excessive grammatical terminology at beginner levels.

## 4. Contextual diversity policy

Research supports seeing a word in varied contexts, but the L2-specific evidence base is still smaller than the overall literature. Therefore V1 uses contextual diversity as an authoring quality principle, not a numeric mastery formula.

For repeated examples of one concept:

- vary surrounding vocabulary and sentence intent;
- vary topic when natural;
- avoid mechanically paraphrasing one sentence five times;
- preserve meaning consistency for the target sense;
- include productive/function contexts for phrases when useful;
- prefer real Reader encounters as future context candidates, subject to content rights and quality.

Do not count context diversity as competence evidence by itself. An exposure remains an exposure.

## 5. Receptive vs productive knowledge

Knowledge content should support different activity demands because recognition and production are not interchangeable.

Authoring implication:

- **recognition support:** concise definition, Vietnamese cue, disambiguating example;
- **listening support:** audio/pronunciation only after an approved data model exists;
- **production support:** phrase frames, collocations, constrained recall/use examples;
- **grammar production:** examples contrasting correct use, but no automatic grammar competence update from simply reading them.

The existing recognition/listening/production projections remain authoritative.

## 6. Gloss and multimodal evidence

Meta-analytic evidence supports glossing and suggests benefits from combining L1 and visual support for vocabulary learning, especially immediate/beginner outcomes.

V1 action:

- keep Vietnamese support concise and accessible from Reader/Dictionary where current contracts permit;
- retain the possibility of reviewed visual references later;
- do not add image fields or UI during this isolated knowledge task;
- never use an automatically fetched image whose licence/provenance cannot be persisted and audited.

## 7. Relation graph policy

Relations are pedagogical navigation, not learner-state propagation.

### `prerequisite`

Use only when knowing/understanding A materially supports learning B. Avoid dense automatically inferred graphs.

### `family`

Represents morphological/lexical family relationships. It must never clone mastery between members.

### `synonym` / `antonym`

Use as semantic aids. Synonyms are rarely perfectly interchangeable; examples should preserve register/sense differences.

### `related`

Use sparingly for useful pedagogical association, not as a catch-all graph edge.

### Non-negotiable graph rule

No edge can create or copy:

- Save/Learn intent;
- review item;
- FSRS state;
- competence mass;
- learner status;
- Today completion;
- exposure event.

## 8. Level evidence policy

Because the current Dictionary/Brain projection selects one best framework mapping, V1 should persist at most one primary CEFR/CEFR-J mapping per concept.

A mapping means:

> “this source/review process estimates this pedagogical unit is appropriate around this curriculum level.”

It does **not** mean:

> “a learner at this CEFR level necessarily knows this concept” or “the Council of Europe officially certified this word.”

Conflicting level signals belong in provenance/review metadata until the runtime explicitly supports evidence fusion.

## 9. Frequency/usefulness policy

Frequency helps prioritize what is worth teaching, but frequency alone does not determine:

- conceptual difficulty;
- CEFR level;
- importance to a specific learner goal;
- productive usefulness;
- mastery.

For V1, frequency/ranking sources with share-alike or mixed-source obligations may be used as research evidence without copying their raw rank/value into the production database.

## 10. Example sentence policy

Initial learner-facing examples should be LINGUA-authored and reviewed.

A good example:

- is understandable at/near the intended learner level;
- makes the target meaning/use clear;
- avoids unnecessary unknown vocabulary;
- sounds natural in contemporary English;
- has an accurate, natural Vietnamese translation when translation is shown;
- has exact validated UTF-16 target spans;
- does not contain private data or copied protected prose;
- has provenance/rights recorded.

Examples from external corpora stay candidates until their exact record licence permits intended use.

## 11. Content coverage policy

Reader fit should eventually combine several server-side signals rather than one CEFR label:

- learner-known/learning concept coverage;
- density of genuinely new targets;
- concept level evidence;
- sentence/syntactic complexity;
- topic/goal relevance;
- contextual diversity/recent exposure;
- reading history and time budget.

No new recommendation algorithm is authorized here. This is a design target for a future bounded task after real self-use data exists.

## 12. Authoring quality gates

Before a concept/example pack can move from candidate to production-ready:

- source/rights lineage passes;
- canonical identities are deterministic and duplicate-free;
- primary level mapping is unambiguous;
- English meaning has human review;
- Vietnamese learner text has human review;
- phrase/grammar boundaries are pedagogically coherent;
- example spans are valid;
- prerequisite graph is acyclic;
- no relation implies learner-state propagation;
- no learner-state table changes during import;
- dry-run diff is human-readable and machine-readable;
- repeat import is idempotent.

## 13. First-pack strategy

Do **not** target an impressive dictionary size. Build enough reviewed knowledge to support the first 16 original micro-articles and actual self-learning.

Sequence:

1. author the first micro-content outlines;
2. extract required lexical/phrase/grammar concepts;
3. match candidates against CEFR-J + Open English WordNet;
4. draft/review Vietnamese support;
5. add examples/forms/relations only where useful;
6. run missing-concept report;
7. expand until the content pack can publish without weakening gates;
8. self-learn and record lookup/content gaps;
9. grow the catalog from demonstrated demand.

This avoids the classic failure mode of importing 100k dictionary entries before knowing what the product actually needs.
