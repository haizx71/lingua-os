# Knowledge Source Research — 2026-09-16

Status: research artifact; no dataset import approved.  
Scope: English for Vietnamese learners, approximately Pre-A1/A0–B1.  
Rule: re-check upstream terms, exact release, checksum and attribution at ingestion time. This document is not legal advice.

## Decision classes

- `PRIMARY_CANDIDATE`: clean enough to design the first production pipeline around, subject to pinned release + record QA + attribution.
- `REFERENCE_ONLY`: may guide human curriculum/review decisions, but protected data must not be copied into the production catalog.
- `CANDIDATE_QUARANTINE`: useful but has share-alike, mixed provenance, redistribution, quality or schema questions that must be resolved first.
- `REJECT_MVP`: deliberately excluded from the first production knowledge pack.

## Cleanest first-production source stack

The smallest source stack with the best current rights/provenance fit is:

1. **CEFR-J Wordlist 1.6 / Grammar Profile** — curriculum/level evidence, with proper TUFS/Tono Lab acknowledgement.
2. **Open English WordNet 2025** — English senses, definitions and semantic relations under CC BY 4.0.
3. **PanLex** — English↔Vietnamese translation candidates under CC0; candidates still require sense-aware human review.
4. **LINGUA-authored material** — Vietnamese learner explanations, example sentences, translations, phrase/collocation teaching units and first real Reader micro-content.

Everything else should initially be treated as corroborating research or quarantined enrichment rather than silently mixed into one catalog.

## Source matrix

| Source | Value | Rights/access finding | Decision | Intended use |
|---|---|---|---|---|
| Council of Europe CEFR + Companion Volume | Communicative proficiency framework | Official reference; CEFR is language-independent and there is no official Council-of-Europe English word list | REFERENCE_ONLY | Can-do framing and proficiency terminology; never claim official word certification |
| CEFR-J Wordlist 1.6 | English lemma/POS level prior | Copyright Tono Laboratory/TUFS; documented as usable for research and commercial purposes with proper acknowledgement | PRIMARY_CANDIDATE | Primary A1–B1 level prior; pin exact 1.6 artifact/checksum |
| CEFR-J Grammar Profile | Grammar level prior | Same CEFR-J commercial-use-with-citation position; public OLP mirror is older/partially Japanese | PRIMARY_CANDIDATE | Manually normalize reviewed grammar units; preserve original IDs/version |
| CEFR-J x 28 | Can-do phrase methodology and multilingual/Vietnamese adaptation research | TUFS publicly describes English levelled phrase lists and 28-language resources including Vietnamese, but no production redistribution licence has been established for this project | REFERENCE_ONLY | Strong methodology reference; do not copy Vietnamese translations/phrase data without explicit rights confirmation |
| Open English WordNet 2025 | Senses, glosses, semantic relations | CC BY 4.0; current project also requires manual validation for contributions | PRIMARY_CANDIDATE | Candidate English meanings/relations filtered to curriculum; preserve attribution |
| PanLex | Cross-lingual equivalence | Database snapshots/Lite/Swadesh are CC0 1.0 | PRIMARY_CANDIDATE | Vietnamese translation candidates/cross-check; human sense review before learner-facing text |
| NGSL 1.2 and related NGSL lists | General-English usefulness/frequency | Official project permits commercial use, but lists such as NGSL-GR and NGSL-S are CC BY-SA 4.0 | CANDIDATE_QUARANTINE | Research/ranking signal first; do not copy rankings/list data into core catalog until share-alike handling is explicitly approved |
| KELLY English list | Frequency + CEFR prior | English KELLY distribution is CC BY-NC-SA 2.0 on the Leeds page | REFERENCE_ONLY | Independent research cross-check only; no commercial production import |
| English Vocabulary/Grammar Profile | Sense/grammar level validation | Valuable searchable reference; no bulk redistribution licence established here | REFERENCE_ONLY | Human cross-check of ambiguous level/sense decisions; no scraping/bulk copy |
| EFLLex / CEFRLex English | Frequency distributions by level | CC BY-NC-SA 4.0 | REFERENCE_ONLY | Research comparison only |
| Open Multilingual Wordnet / Vietnamese WordNet projects | Vietnamese lexical research | Per-resource licences vary; some Vietnamese mirrors explicitly inherit Wiktionary/other upstream rights | CANDIDATE_QUARANTINE | Research candidate only until exact upstream lineage is verified; PanLex is cleaner for V1 |
| CMU Pronouncing Dictionary | US-English pronunciation | Broad use/copy/modify/distribute permission subject to notices/acknowledgement | CANDIDATE_QUARANTINE | Future pronunciation data only after a first-class pronunciation schema/API exists |
| Mozilla Common Voice | Speech/ASR research | Dataset CC0, but current Mozilla Data Collective terms restrict identity attempts and re-host/re-share behavior | CANDIDATE_QUARANTINE | Model/evaluation research; not automatic learner-facing hosted audio |
| Wiktionary via Wiktextract/Kaikki | Forms/glosses/translations/pronunciation | Parser/software licence does not replace Wiktionary CC BY-SA/GFDL content obligations | CANDIDATE_QUARANTINE | Later enrichment only after share-alike/provenance design |
| Tatoeba | Sentence/translation candidates | Default sentences CC BY 2.0; some originals CC0; translation/audio rights vary per item | CANDIDATE_QUARANTINE | Per-record future candidate; first pack uses original LINGUA sentences |
| UniMorph English | Inflectional morphology | Share-alike dataset | CANDIDATE_QUARANTINE | Later validation; first pack uses deterministic/reviewed forms |
| Leipzig Corpora Collection | Frequency/co-occurrence research | Website query data has non-commercial limits; downloadable corpora are described as CC BY but originate from varied web material | CANDIDATE_QUARANTINE | Aggregate research after source-specific review; not first sentence source |
| UniversalCEFR and mixed CEFR corpora | Text-level difficulty research | Collection combines corpora with heterogeneous licences, many non-commercial | REFERENCE_ONLY | Research/evaluation only; do not train/import blindly from a wrapper dataset licence |
| ICNALE | Vietnamese/Asian learner-corpus evidence | Terms prohibit reproduction/redistribution; current project material includes Vietnamese learners | REFERENCE_ONLY | Aggregate SLA/error research only; never ship learner texts |
| EFCAMDAT | Large CEFR-aligned learner corpus | Current Cambridge agreement limits use to academic/private study/non-commercial research with derivative restrictions | REFERENCE_ONLY | Research literature only |
| Universal Dependencies English-EWT | Syntax/parsing research | Annotation licence is share-alike; underlying text provenance is mixed | REFERENCE_ONLY | Parser/feature evaluation; do not republish source sentences |
| LanguageTool | Grammar/style QA engine | Core LGPL 2.1+ | CANDIDATE_QUARANTINE | Optional Admin authoring QA; not curriculum authority or core runtime dependency |
| wordfreq | Frequency estimates | Code and bundled data have different licences; data includes CC BY-SA and multiple upstream sources; data snapshot is effectively sunset around 2021 | REJECT_MVP | Avoid exporting/copying data into V1 catalog; use cleaner evidence sources |
| ConceptNet | Broad semantic graph | CC BY-SA 4.0 | REJECT_MVP | Too broad/noisy for authoritative prerequisite graph |
| SyntagNet | Sense-aware collocations | CC BY-NC-SA 4.0 | REJECT_MVP | Non-commercial restriction |
| generated-english-phrasal-verbs (WithEnglishWeCan) | Large phrasal-verb list | Repository says MIT, but the root contains generated output without a sufficiently explicit upstream data provenance chain | CANDIDATE_QUARANTINE | Do not ingest merely because repository says MIT; verify generation sources first |
| Project Gutenberg | Literature | Public-domain status is title/jurisdiction sensitive and much prose is stylistically poor for A0–B1 modern learner content | REJECT_MVP | Not needed for first micro-content pack |

## Rights/provenance rules discovered during research

### 1. Repository licence is not data licence

A parser or application being MIT/Apache/GPL says nothing by itself about the licence of dictionary/corpus data that it packages or generates. Example: Wiktextract code does not erase Wiktionary share-alike obligations. Every production record needs a traceable data-source lineage.

### 2. Aggregator licence cannot launder upstream rights

A dataset wrapper may advertise a permissive licence while containing material sourced from British Council, commercial publishers, news corpora, Wiktionary or other sources with different terms. LINGUA OS must verify the upstream source chain, not trust the wrapper badge.

Importer rule: `wrapper licence + upstream lineage + transform rights + output obligation` must all pass before a source becomes `PRIMARY_CANDIDATE`.

### 3. Commercial permission does not mean “no obligations”

CC BY-SA permits commercial use but can impose attribution/share-alike conditions on adaptations. That is materially different from CC0 or CC BY. To keep the first catalog operationally simple, share-alike datasets remain quarantined until we deliberately define how resulting data is segregated, attributed and redistributed.

### 4. Research papers are evidence, not content

A paper being open access does not mean its stimuli, corpus or cited examples can be copied into the product. Extract conclusions and methodology; do not copy protected learning content unless separately licensed.

## Curriculum findings

### CEFR is a capability framework, not a word certificate

Use CEFR/CEFR-J mappings as sourced pedagogical evidence. Never display a claim equivalent to “the Council of Europe officially says this word is A2.” Language-specific resources make those mappings.

### CEFR-J is the best current level prior for V1

The project reports Wordlist 1.6 and a Grammar Profile. Open Language Profiles documents commercial/research use with citation for the CEFR-J vocabulary/grammar datasets. CEFR-J was designed for Japanese EFL conditions, so it remains a prior rather than universal truth.

### CEFR-J x 28 is especially interesting for Vietnamese methodology

TUFS extends the framework across 28 languages, explicitly including Vietnamese, and publishes examples of levelled vocabulary / Can-Do phrase resources. This is excellent evidence for how to build multilingual pedagogical resources, but it is **not** currently approved as a data source because redistribution rights for the Vietnamese phrase/vocabulary assets have not been established here.

## Vietnamese learner evidence

Population research supports giving extra authoring/review attention to several recurring areas:

- final consonants and consonant clusters;
- /θ/ and /ð/;
- word stress and selected vowel contrasts;
- prepositions;
- verb tense/aspect;
- articles;
- plural and subject–verb agreement;
- verb–noun, adjective–noun and other collocations.

Recent Vietnamese EFL collocation studies report persistent problems with word combinations and L1 transfer. A 2024 classroom study also reports frequent preposition and tense difficulties among its participants. These findings are **authoring priors only**. They must never create an individual learner weakness or competence state without actual learner evidence.

## Learning-science findings relevant to the catalog

### Contextual diversity

A 2026 systematic review/meta-analysis of 20 studies found a positive behavioral effect of contextual diversity on word learning (reported pooled Cohen's d about 0.44), while noting that only a small subset directly targeted L2 learning. Practical implication: prefer multiple genuinely different contexts for a concept over repeated near-duplicate sentences, but do not turn this into a hard mastery formula yet.

### Formulaic language

Current L2 work continues to support formulaic sequences as important productive units. This reinforces the existing first-class `phrase` concept type. Phrasal verbs, collocations and discourse frames should not be reduced to independent mastery of their component words.

### Receptive vs productive learning

Meta-analytic work shows task/instruction alignment matters: productive instruction better supports productive outcomes and receptive instruction better supports receptive outcomes. This supports LINGUA OS's existing separation of recognition/listening/production competence; the catalog must not collapse them into one mastery state.

### L1 + visual support and glosses

A 2025 meta-analysis found immediate vocabulary-learning advantages for combined L1 + picture conditions, and a 2024 second-round meta-analysis found useful effects of glossing, especially for beginners/recognition. This suggests future learner-facing concept details may benefit from concise Vietnamese support and carefully selected visuals. It does **not** justify adding an image schema/UI in this knowledge task while parallel UI work is active.

### Spacing

Spacing/retrieval evidence remains relevant, but LINGUA OS already delegates memory scheduling to its accepted FSRS implementation. The Knowledge System must never introduce a second scheduler.

## Open-source product/repository lessons

- **Learning With Texts / Lute / LinguaCafe:** useful pattern is keeping vocabulary connected to the exact reading context and letting reading history inform suggestions. LINGUA OS already has a stronger server-authoritative concept/exposure model; borrow the principle, not their “mark known” semantics.
- **LibreLingo:** useful pattern is structured, reviewable course content and validation before publishing. The main repository is archived, so it should not become a dependency.
- **Open Spaced Repetition / FSRS:** confirms the project is already on the correct scheduler family. Do not fork or reimplement it inside the Knowledge System.
- **Open English WordNet:** notably states that automatically generated contributions are not accepted without manual validation. This is aligned with our human-review gate for learner-facing language knowledge.
- **LinguaCafe:** its attribution section is a useful example of treating software/data licences separately. LINGUA OS should keep source-level attribution/provenance first-class rather than burying it in package metadata.

## Repository-specific guardrails for LINGUA OS

1. Dictionary/Brain currently choose one best framework mapping; V1 should write at most one primary proficiency mapping per concept.
2. Same-lemma/POS sense splitting does not fit cleanly with the current one-concept/one-FSRS-lineage architecture. Use a small curated core-sense bundle per lexical concept for V1.
3. Grammar/skill concepts currently lack the same lexical-definition projection as word/phrase concepts. Do not invent fake lexemes.
4. Pronunciation has no current first-class learner-facing schema/API. Keep pronunciation data out of persistence until a bounded task approves it.
5. `family`, `synonym`, `related` or `prerequisite` edges are knowledge relations only. **No relation may transfer mastery, competence, Save/Learn intent or FSRS state to another concept.**
6. Multiple examples should favor contextual diversity, but context diversity is a content-quality/recommendation signal, not competence evidence.

## Updated research backlog

Before implementing an importer:

- retrieve official CEFR-J Wordlist 1.6 from the authoritative source path and pin checksum/version;
- verify exact CEFR-J 1.6 attribution text from the artifact itself;
- define deterministic CEFR-J ↔ Open English WordNet matching with ambiguity reports;
- define PanLex English↔Vietnamese candidate filtering and manual approval workflow;
- decide whether all Vietnamese definitions are first-party authored or machine-drafted + mandatory human review;
- define regular/irregular `lexeme_forms` rules without importing share-alike morphology data;
- generate the missing-concept report from the first 16 original micro-articles before choosing catalog size;
- independently review every `PRIMARY_CANDIDATE` source and the no-learner-state importer boundary;
- only after that, build preview-only import and validate on disposable PostgreSQL before any Supabase staging write.
