# LINGUA OS — Vietnamese Learner Priors V1

Status: research-backed authoring/review guidance only.  
Scope: English knowledge/content design for Vietnamese learners; **never learner-state inference**.

## Core rule

Population research may tell the authoring pipeline where to look more carefully. It must never tell the Language Brain that a specific learner is weak, strong, known, due, mastered or ready.

A learner's actual evidence remains authoritative. Native language is context for content review, not a competence score.

## Evidence hierarchy

Use evidence in this order when deciding whether to add a Vietnamese-specific explanation or contrast:

1. the learner's own observed errors/evidence when such a product signal exists;
2. repeated problems found during owner self-use and later pilot data;
3. several reasonably relevant Vietnamese EFL studies;
4. cross-linguistic analysis that gives a plausible explanation;
5. author intuition only as a hypothesis requiring review.

Do not generalize a small university study into a universal property of Vietnamese learners.

## Grammar and written-language review priorities

A 2025 Vietnamese study of 57 first-year students explicitly tested tense, articles, prepositions, plural forms, subject-verb agreement and sentence structure; the abstract reports recurring difficulty particularly with verb tense and prepositions. This supports extra QA attention for these areas, not automatic remediation for every learner.

Reference:
- Le Thi Kim Duc, “Grammatical Challenges in Written English: A Study of Common Errors Among Vietnamese Learners”, TNU Journal of Science and Technology, DOI 10.34238/tnu-jst.10966.

A newer 2026 case study of 20 Vietnamese B2 IELTS learners also reports a structured analysis of grammatical, lexical and sentence-level errors. Its population and task are substantially more advanced and test-specific than LINGUA's A0–B1 owner-use target, so it should be treated as secondary triangulation rather than curriculum authority.

Authoring implications:

- **tense/aspect:** explain time/use distinctions in short functional terms; avoid long tense tables as the primary explanation;
- **prepositions:** prefer phrase/collocation examples (`on time`, `interested in`, etc.) when the combination matters more than an abstract rule;
- **articles/countability:** use concrete noun contrasts and natural examples; surface the distinction only when it prevents misunderstanding;
- **plural/agreement:** include examples where number is semantically visible rather than drilling endings in isolation;
- **sentence structure:** progress from transparent clauses toward connected discourse, without treating sentence length alone as level.

## Pronunciation review priorities

A 2022 Can Tho University study of 39 Vietnamese EFL learners found errors varied by consonant-cluster type; clusters containing voiceless plosives were especially difficult and three-consonant clusters were often simplified by deletion. A Vietnamese doctoral project on English consonant clusters likewise reports reduction, substitution and re-ordering patterns in final clusters.

References:
- Tran Thi Khanh Lam & Nguyen Thi Anh (2022), “Common mistakes in pronouncing English consonant clusters: A case study of Vietnamese learners”, CTU Journal of Innovation and Sustainable Development 14(3), 32–39, DOI 10.22144/ctu.jen.2022.040.
- Nguyen Dang Nguyet Huong, VNU-USSH doctoral research on pronunciation features of English consonant clusters in Vietnamese speakers of English.

Published research also documents difficulty with English /θ/ and /ð/ for Vietnamese adult learners, often through substitutions. This is a useful future pronunciation-content prior, but not enough reason to create a learner weakness flag.

Authoring implications for a later bounded pronunciation feature:

- prioritize intelligibility, consistent with the CEFR Companion Volume's phonological-competence direction;
- review final consonants and clusters in high-value words/phrases;
- include selected /θ/–/ð/ work when relevant;
- include word stress and prosody, not only isolated phonemes;
- model US/UK variants explicitly if pronunciation assets are introduced;
- never prescribe native-accent imitation as the product goal.

No pronunciation schema/API is authorized by this document.

## Collocation and formulaic-language review priorities

Vietnamese EFL research on collocation has repeatedly reported gaps in productive collocational knowledge, including common verb–noun and adjective–noun combinations. The exact studies often use university English majors, so the signal should guide content design rather than define every beginner's problem.

The broader SLA literature strengthens the product decision independently of Vietnamese-specific research: formulaic sequences are important for fluent processing and production, and intervention studies suggest learners benefit from explicit attention and repeated meaningful encounters.

Authoring implications:

- retain `phrase` as a first-class concept type;
- teach useful chunks such as `would like`, `on time`, `deal with`, `in my opinion` as units where pedagogically justified;
- do not infer knowledge of a phrase from knowledge of its component words;
- do not mark component words mastered when a phrase is learned;
- prefer phrase examples in communicative contexts rather than decontextualized lists.

## Vietnamese support text

Vietnamese explanation is a scaffold, not the curriculum itself.

Prefer:

- one short, natural Vietnamese explanation;
- meaning first, terminology second;
- a contrast only when it blocks a likely misunderstanding;
- examples whose English meaning is recoverable from context;
- explicit notes for false literal mappings only after review;
- contemporary neutral Vietnamese rather than dictionary prose.

Avoid:

- word-for-word Vietnamese translations presented as full definitions;
- automatically generated “common Vietnamese mistake” claims without evidence;
- implying that Vietnamese grammar lacks a concept and therefore the learner cannot understand it;
- dumping all possible senses into one beginner entry;
- teaching English through long Vietnamese metalinguistic explanations.

## Error-aware authoring taxonomy

For future content QA, an item may carry **authoring review tags** such as:

- `vi-review:article-countability`
- `vi-review:preposition-collocation`
- `vi-review:tense-aspect`
- `vi-review:number-agreement`
- `vi-review:word-order`
- `vi-review:formulaic-collocation`
- `vi-review:final-cluster`
- `vi-review:theta-eth`
- `vi-review:word-stress`

These tags describe why an author/reviewer should inspect the teaching material. They must not be copied into `user_concept_states`, competence calculations, FSRS scheduling or Today priority as if they were learner evidence.

## When a contrastive note is justified

Add a Vietnamese-specific contrast only if at least one condition is met:

- the concept has repeatedly caused a concrete misunderstanding in self-use/pilot data;
- a relevant research pattern is strong and the note is short enough to help rather than distract;
- the English distinction is difficult to infer from the normal gloss/example;
- the contrast is necessary for safe/accurate communication.

Otherwise use the normal English concept + concise Vietnamese support and let learner evidence decide what needs extra attention.

## Product implications without changing runtime semantics

This research supports richer catalog/content authoring but does **not** authorize:

- a fourth competence dimension called “Vietnamese difficulty”;
- L1-based mastery penalties;
- L1-based FSRS intervals;
- automatic Today scheduling because of ethnicity/nationality/native language;
- exposing research labels as deterministic diagnoses.

The safe near-term use is narrower: improve examples, glosses, phrase coverage, grammar contrasts and future pronunciation-review priorities while preserving the accepted learner model.
