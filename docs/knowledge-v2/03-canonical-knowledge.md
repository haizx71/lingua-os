# LINGUA OS Knowledge System V2 — Canonical Knowledge Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/catalog/`, `database/migrations/`, `knowledge/`

---

## 1. Executive Summary & Purpose

The Canonical Knowledge Tier models immutable, universal linguistic and pedagogical facts. It establishes an authoritative catalog of concepts, lexical items, semantic senses, grammatical patterns, phonetic assets, and curricular metadata.

No learner data, personal identifiers, or cognitive progress metrics ever enter this tier. It serves as the single source of truth for:
1. Ingesting, vetting, and indexing educational language datasets.
2. Resolving dictionary queries, lemmatization, and morphological token spans in the Reader.
3. Supplying structured definitions, syntax formulas, and audio pronunciations to the Brain and Review UI.

---

## 2. Polysemy Architecture: Comparative Evaluation

### 2.1 The Architectural Trade-Off
In natural language, polysemy is pervasive: words with the exact same lemma and part of speech frequently possess multiple distinct meanings.
For example:
- *bank* (noun, finance): An institution where money is kept and borrowed.
- *bank* (noun, geography): The land alongside a body of water.

In V1, `lexemes` has `concept_id` as a foreign key and enforces `UNIQUE NULLS NOT DISTINCT (language_code, normalized_form, part_of_speech)`. This forces all senses of *bank* into a single `concept_id`. Because learner mastery and FSRS memory attach to `concept_id`, a learner cannot master the A1 finance sense without the system falsely marking the B1 geography sense as mastered.

To solve this, two architectural options were evaluated:

### 2.2 Deep Comparison: Option A vs. Option B

| System Dimension | Option A: Shared Lexeme $\to$ Multiple Word Senses $\to$ Learner-Addressable Concept/Sense | Option B: Multiple Concept-Specific Lexemes (with `sense_disambiguator`) |
| :--- | :--- | :--- |
| **1. Dictionary Search** | **Cleanest & Fastest**: Querying "bank" matches exactly 1 row in `lexemes`, instantly pulling all related `word_senses` ordered by frequency. | **Fragmented**: Returns multiple rows in `lexemes` with duplicate lemmas; requires grouping queries and post-processing. |
| **2. Review Scheduling** | **Precise Pedagogical Targeting**: Review cards target the specific sense definition and context sentence (e.g., A1 finance). | **Functional**, but review cards are pegged to artificial duplicate lexeme IDs. |
| **3. Learner Knowledge & Brain** | **Accurate Mastery**: Learner state shows: Sense 1 (finance) = `mastered`, Sense 2 (geography) = `unseen`. | Functional, but learner competence is fragmented across duplicate lexemes. |
| **4. Canonical Deduplication** | **100% Normalized**: Exactly 1 lemma row per `(language_code, normalized_form, part_of_speech)`. | **Severely Denormalized**: Duplicates lemma, part of speech, and root metadata across multiple rows. |
| **5. Morphology & Forms** | **Single Source of Truth**: Inflected forms (`banks`, `banking`, `banked` in `lexeme_forms`) attach once to the single `lexeme_id`. | **Massive Redundancy**: Every sense-specific lexeme must duplicate identical inflection tables. |
| **6. Provenance & Attribution** | **Precise**: Lemma etymology attaches to `lexemes`; individual definitions attach to `word_senses`. | Conflated across artificial lexeme duplicates. |
| **7. Catalog Ingestion / Imports** | **Standard Lexicography**: Directly maps standard dictionary feeds (Wiktionary, WordNet, Cambridge): Lemma $\to$ [Senses]. | **High Friction**: Importers must fabricate arbitrary disambiguator strings for every sense. |

### 2.3 Selected Architecture: Option A via `concept_senses` Bridge
Knowledge System V2 selects **Option A**.
- `lexemes` retains its strict linguistic uniqueness constraint: `UNIQUE NULLS NOT DISTINCT (language_code, normalized_form, part_of_speech)`.
- `word_senses` stores distinct definitions, CEFR levels, and bilingual explanations.
- An additive bridge table `concept_senses` connects a pedagogical `concept_id` to its specific `word_sense_id`.
- For backwards-compatibility with V1 queries, `lexemes.concept_id` is preserved as a legacy pointer to the primary concept, while all new V2 sense-level scheduling and mastery resolve via `concept_senses`.

```
+---------------------------------------------------------------------------------------+
| DEDUPLICATED LEMMA: "bank" (Part of Speech: noun, id: aaa-111)                        |
| Forms: "banks" (plural), id: fff-001                                                  |
+---------------------------------------------------------------------------------------+
        |
        +---> WORD SENSE 1 (id: sss-101, CEFR: A1)
        |     - def_en: "Financial institution for investing or borrowing money"
        |     - def_vi: "Ngân hàng"
        |     ^
        |     | linked via concept_senses
        |     v
        |     CONCEPT 1 (canonical_key: "word:bank:noun:finance", id: ccc-001)
        |     -> Learner State: Mastered, FSRS Stability: 45 days
        |
        +---> WORD SENSE 2 (id: sss-102, CEFR: B1)
              - def_en: "The land alongside a river or lake"
              - def_vi: "Bờ sông, bờ hồ"
              ^
              | linked via concept_senses
              v
              CONCEPT 2 (canonical_key: "word:bank:noun:geography", id: ccc-002)
              -> Learner State: Unseen, FSRS Stability: None
```

---

## 3. First-Class Grammar Specifications

### 3.1 Problem Solved
In V1, grammar concepts are mere rows in `concepts` with `concept_type = 'grammar'`. They have no rows in `lexemes` and no rows in `word_senses`. The Brain concept detail API (`/v1/brain/concepts/{id}`) joins on `lexemes` and returns null/empty definitions for grammar items.

### 3.2 V2 Structured Grammar Specification Entity
Every grammar concept is backed by a row in `grammar_specifications`:

```sql
CREATE TABLE public.grammar_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    pattern_formula TEXT NOT NULL,                -- e.g. "S + have/has + V3/ed"
    syntactic_category TEXT NOT NULL,             -- e.g. "tense_aspect", "passive", "clause", "modality"
    pragmatic_function TEXT NOT NULL,             -- e.g. "Actions completed with present relevance"
    vietnamese_explanation TEXT NOT NULL,         -- High-clarity contrastive L1 notes
    vietnamese_common_traps TEXT,                 -- Frequent L1 transfer errors
    structural_slots JSONB NOT NULL DEFAULT '[]', -- Slot breakdown
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_grammar_specs_category ON public.grammar_specifications(syntactic_category);
```

---

## 4. Multi-Modal Phonetics and Pronunciation

Pronunciation assets are canonical and shared across all learners.

### 4.1 Schema Definition
```sql
CREATE TABLE public.phonetic_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id UUID NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
    accent_variant TEXT NOT NULL CHECK (accent_variant IN ('en_US', 'en_GB', 'en_AU')),
    ipa TEXT NOT NULL,
    audio_uri TEXT,
    duration_ms INTEGER,
    audio_source TEXT CHECK (audio_source IN ('human_studio', 'high_quality_neural_tts')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_phonetic_lexeme_accent UNIQUE (lexeme_id, accent_variant)
);

CREATE INDEX ix_phonetic_lookup ON public.phonetic_transcriptions(lexeme_id, accent_variant);
```

---

## 5. Phrases, Compositionality, and Variable Slots

### 5.1 Fixed vs. Semi-Fixed Phrases
1. **Fixed Idioms/Phrases** (e.g., *by and large*, *at the end of the day*):
   - Stored with `concept_type = 'phrase'`.
   - Exact surface string matching.
2. **Semi-Fixed Variable Slot Patterns** (e.g., *make up one's mind*, *take something for granted*):
   - Modeled with pattern slots in `phrase_specifications`:

```sql
CREATE TABLE public.phrase_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    base_pattern TEXT NOT NULL,                   -- "make up {possessive_pronoun} mind"
    headword_concept_id UUID REFERENCES public.concepts(id), -- "make"
    slot_template JSONB NOT NULL DEFAULT '[]',    -- [{"slot": "possessive_pronoun", "allowed": ["my", "your", "his", "her", "their", "our"]}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

---

## 6. Pedagogical Metadata & Curriculum Taxonomy

### 6.1 CEFR Framework Mapping
Every canonical concept maps to one or more CEFR framework standards (`CEFR-Global`, `GSE`, `Cambridge`, `Oxford3000`):

```sql
CREATE TABLE public.framework_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    framework_code TEXT NOT NULL CHECK (framework_code IN ('cefr', 'gse', 'oxford_3000', 'cambridge_english')),
    level_code TEXT NOT NULL CHECK (level_code IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_framework_mappings_concept_framework UNIQUE (concept_id, framework_code)
);

CREATE INDEX ix_framework_mappings_level ON public.framework_mappings(framework_code, level_code);
```

---

## 7. Canonical Ingestion & Integrity Validation

All canonical data imports must pass strict validation before staging or publishing:
1. **Hash Verification**: Candidate SHA256 matches catalog release manifest.
2. **License Check**: Every imported concept references a valid row in `licenses`.
3. **IPA Validation**: IPA strings conform to Unicode International Phonetic Alphabet standards.
4. **Bilingual Completeness**: Both English and Vietnamese definitions must be non-empty and non-trivial ($> 5$ characters).
5. **Morphological Deduplication**: Zero duplicate rows in `lexemes` for identical `(language_code, normalized_form, part_of_speech)`.
