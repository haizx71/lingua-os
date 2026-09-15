# Knowledge Source Research — 2026-09-16

This file records source/license research for the LINGUA OS English-for-Vietnamese A0–B1 knowledge catalog. It is a research artifact, not legal advice and not an approval to ingest data. Re-check upstream terms at ingestion time.

## Decision legend

- `PRIMARY_CANDIDATE`: suitable for the first production pipeline, subject to record-level QA and required attribution.
- `REFERENCE_ONLY`: useful for curriculum/research validation, but do not copy/import its protected data into production.
- `CANDIDATE_QUARANTINE`: potentially useful later; requires additional license/quality review before production use.
- `REJECT_MVP`: intentionally excluded from the first production knowledge pack.

## Source matrix

| Source | Main value | Rights / access finding | Decision | LINGUA OS use |
|---|---|---|---|---|
| Council of Europe CEFR + Companion Volume | Communicative can-do framework | Official reference; CEFR is language-independent and not a ready-made word list | REFERENCE_ONLY | Frame levels/can-do outcomes; never claim a word is officially CEFR-certified by the Council of Europe |
| CEFR-J Wordlist 1.6 | English vocabulary level prior | Tono Laboratory/TUFS states research and commercial use is free with proper acknowledgement | PRIMARY_CANDIDATE | Primary A1–B1 level prior; record exact release and citation |
| CEFR-J Grammar Profile | Grammar item level prior | CEFR-J/Open Language Profiles permits research/commercial use with citation; repository copy is older and partly Japanese | PRIMARY_CANDIDATE | Candidate grammar curriculum, manually normalized/reviewed |
| NGSL | General-English usefulness/frequency | Project describes lists as free to use, including commercially; exact per-list Creative Commons terms must be captured at ingestion | PRIMARY_CANDIDATE | Usefulness/frequency evidence; never treat as CEFR level authority |
| Open English WordNet 2025 | Senses, definitions, semantic relations | CC BY 4.0 | PRIMARY_CANDIDATE | Filter to selected curriculum; human-edit learner-safe teaching layer; retain attribution |
| PanLex | Cross-lingual lexical equivalence | PanLex snapshots/Lite/Swadesh data are CC0 1.0 | PRIMARY_CANDIDATE | Vietnamese translation candidates/cross-checks only; human sense review required |
| CMU Pronouncing Dictionary | US-English pronunciation forms | Princeton/CMU terms permit use/copy/modify/distribute without fee subject to notices; acknowledgement expected | CANDIDATE_QUARANTINE | Future pronunciation source after a first-class pronunciation schema/contract exists |
| Mozilla Common Voice | Speech/audio research | Dataset is CC0, but current Mozilla Data Collective terms forbid identity attempts and state datasets must not be re-hosted/re-shared | CANDIDATE_QUARANTINE | ASR/listening research only until learner-facing redistribution is explicitly cleared |
| English Profile / EVP / EGP | Sense/grammar level validation | Valuable searchable reference; no bulk-reuse license established for this project | REFERENCE_ONLY | Human cross-check of ambiguous level/sense decisions; no scraping or dataset copy |
| EFLLex / CEFRLex English | CEFR-level lexical frequency distributions | CC BY-NC-SA 4.0 | REFERENCE_ONLY | Research comparison only; unsuitable as production commercial data source |
| ICNALE | Asian/Vietnamese learner evidence | Terms prohibit reproduction/redistribution; Vietnamese WEP data exists in 2026 | REFERENCE_ONLY | Use published aggregate findings and online research insights; never ship learner texts |
| EFCAMDAT | Large learner corpus/error analysis | Current Cambridge licence limits access to academic private study/non-commercial research and tightly controls derivatives | REFERENCE_ONLY | Research literature only; no production corpus import |
| Wiktionary via Wiktextract/Kaikki | Forms, glosses, translations, pronunciation | Parser code MIT; extracted Wiktionary content remains under Wiktionary content licences (CC BY-SA/GFDL) | CANDIDATE_QUARANTINE | Later enrichment only after share-alike/provenance design; never treat parser licence as data licence |
| Tatoeba | Example/translation candidates | Default sentences CC BY 2.0; some originals CC0; translations are derivative and have additional constraints; audio licensing varies | CANDIDATE_QUARANTINE | Per-record licensed candidate examples only, not first production source |
| UniMorph English | Inflectional morphology | English resource is share-alike licensed | CANDIDATE_QUARANTINE | Later form validation; first pack should use deterministic/manual forms |
| ConceptNet | Broad semantic/common-sense graph | CC BY-SA 4.0 data | REJECT_MVP | Too broad/noisy for authoritative prerequisite graph; optional offline candidate generation later |
| SyntagNet | Sense-aware collocations | CC BY-NC-SA 4.0 | REJECT_MVP | Non-commercial restriction; do not import into production catalog |
| LanguageTool | Grammar/style checking engine | Core is LGPL 2.1+ | CANDIDATE_QUARANTINE | Optional Admin QA tool, not curriculum authority and not MVP runtime dependency |
| wordfreq | Frequency estimates | library Apache-2.0; bundled data CC BY-SA 4.0 with complex upstream attribution | REJECT_MVP | Do not export/copy into our DB for V1; NGSL path is cleaner |
| Leipzig Corpora Collection | Frequency/co-occurrence/example research | website query data has non-commercial limits; downloadable text corpora are stated CC BY; source material is web-derived | CANDIDATE_QUARANTINE | Possible offline aggregate co-occurrence statistics after source-specific legal review; not first learner-facing sentence source |
| Universal Dependencies English-EWT | Syntax annotation/research | annotations CC BY-SA; underlying texts have mixed provenance/rights | REFERENCE_ONLY | Learn feature definitions and parser evaluation; do not republish sentences |
| Project Gutenberg | Public-domain literature | Rights vary by jurisdiction/title and prose is often stylistically old for A0–B1 | REJECT_MVP | Not needed for first modern learner pack |

## High-confidence findings

### CEFR should not become a fake word certificate

The Council of Europe describes CEFR through communicative proficiency descriptors and explicitly expects contextual adaptation. CEFR-J, English Profile and other language-specific resources map English material onto that framework. Therefore store a mapping as sourced pedagogical evidence, not as an assertion that the Council of Europe officially assigned that lexical item.

Official CEFR descriptor portal:
https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors

### CEFR-J is unusually well matched to our first pack

Official CEFR-J announced Wordlist 1.6 on 2020-03-24. The Open Language Profiles mirror documents that CEFR-J vocabulary/grammar datasets may be used for research and commercial purposes without charge when properly cited.

Official project/resources:
https://www.cefr-j.org/

Open Language Profiles mirror / terms:
https://github.com/openlanguageprofiles/olp-en-cefrj

Important limitation: CEFR-J was developed in a Japanese EFL context. Treat it as a strong level prior, not universal learner truth. Vietnamese learner evidence and the user's own observed performance must override population priors.

### EFLLex is scientifically useful but unsuitable for our production dataset

EFLLex has 15,280 lemma/POS entries with normalized frequency distributions across A1–C1 learning materials, but the download is CC BY-NC-SA 4.0. It is useful for research cross-checks, not for a potentially commercial production catalog.

https://cental.uclouvain.be/cefrlex/efllex/

### PanLex is the cleanest open bilingual candidate found so far

PanLex releases its database snapshots, PanLex Lite and Swadesh lists under CC0 1.0. Vietnamese (`vie-000`) is represented. PanLex aggregates lexical equivalence from many sources, so candidate quality still needs sense-aware review even though the PanLex release itself is CC0.

https://panlex.org/license

### Common Voice licence is permissive but distribution terms matter

Current Common Voice terms make datasets available under CC0, but Mozilla Data Collective also asks/requires that datasets not be re-hosted/re-shared and forbids attempts to identify speakers. This makes Common Voice attractive for model/evaluation research, but not an automatic source of learner-facing audio assets that we host ourselves.

https://commonvoice.mozilla.org/terms

### Learner corpora are evidence, not content sources

ICNALE now includes a Vietnamese WEP cohort (438 participants in the March 2026 table across A2–B2+), but its terms prohibit reproducing or redistributing part or all of the data. EFCAMDAT's current licence is restricted to academic private study/non-commercial research and tightly controlled derivatives. Their value for LINGUA OS is aggregate SLA/error research, not production learner content.

ICNALE:
https://language.sakura.ne.jp/icnale/

EFCAMDAT:
https://ef-lab.mml.cam.ac.uk/EFCAMDAT.html

## Vietnamese learner priorities supported by research

The catalog should include stronger early coverage and better examples for areas repeatedly reported in Vietnamese EFL research, while keeping these as population priors only:

- final consonants and multi-consonant codas;
- English /θ/ and /ð/;
- word stress;
- selected vowel contrasts;
- verb tense/aspect;
- articles;
- prepositions;
- plurals and agreement;
- verb–noun/adjective–noun collocations.

No learner should be marked weak in these areas merely because their L1 is Vietnamese. The Language Brain's actual evidence is authoritative.

## Learning-science implications

### Vocabulary breadth and coverage

Nation's work supports high lexical coverage for comfortable comprehension and highlights the importance of high-frequency vocabulary. Use this to drive content-fit and curriculum coverage, not to turn an arbitrary coverage percentage into a mastery rule.

### Four strands

Nation's four-strands framework argues for roughly balanced meaning-focused input, meaning-focused output, language-focused learning and fluency development. The knowledge catalog should therefore support phrases, grammar and productive prompts rather than being optimized only for flashcard recognition. This research does not change the current Today algorithm in this task.

### Spacing/retrieval

Meta-analytic evidence supports distributed practice for vocabulary learning. LINGUA OS already delegates scheduling to the accepted FSRS memory engine; knowledge ingestion must not implement a second scheduler.

### Corrective feedback

Meta-analytic evidence supports corrective feedback. Future activity design can attach targeted explanations/contrast notes to concepts, but such metadata must not be treated as evidence that the learner has mastered the concept.

### Formulaic language

Recent SLA research continues to support formulaic sequences as important learning units. This supports keeping `phrase` as a first-class concept type and prioritizing useful phrasal verbs/collocations/discourse frames rather than teaching vocabulary only as isolated words.

## Repository-specific architecture findings

The current repo already models much of the needed data, but four gaps must be respected rather than hacked around:

1. Dictionary/Brain choose a single best framework mapping. Avoid ambiguous multiple level rows.
2. Word-sense level distinctions from external profiles cannot map cleanly to the current one-concept/one-FSRS-lineage structure. V1 must use a small curated sense bundle per lemma/POS.
3. Grammar and skill concepts lack a first-class explanation projection because definitions currently flow through lexical senses. Do not create fake lexemes to bypass this.
4. Pronunciation is present in the architecture spec but not as an implemented learner-facing schema/API entity. Keep pronunciation research separate until a bounded task is approved.

## Research backlog

Before any large import, still verify:

- exact NGSL per-list licence text/version and attribution wording;
- official CEFR-J Wordlist 1.6 file checksum and stable download path;
- best safe subset/matching strategy from CEFR-J to Open English WordNet;
- PanLex source-quality filtering strategy for English–Vietnamese candidate translations;
- whether first-party Vietnamese definitions should be authored manually or generated as drafts and human-reviewed;
- deterministic form generation rules for the first A0–B1 pack;
- minimum concept count needed for the first 16 real micro-articles;
- content-fit thresholds using real self-use data rather than invented constants.
