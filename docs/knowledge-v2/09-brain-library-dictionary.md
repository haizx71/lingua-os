# LINGUA OS Knowledge System V2 — Brain, Library, and Dictionary Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/brain/`, `library/`, `dictionary/`, `contracts/`

---

## 1. Executive Summary & Cross-Surface Synergy

The Brain, Library, and Dictionary form the exploratory and organizational surfaces of LINGUA OS. They allow learners to visualize cognitive mastery, manage personalized study materials, and perform deep lexical lookups:

```
+---------------------------------------------------------------------------------------+
| 1. LANGUAGE BRAIN: Interactive cognitive map of the learner's mind                    |
|    - Shows total known, learning, at-risk, and mastered concepts                      |
|    - Visualizes competence breakdown across Recognition, Listening, and Production    |
+---------------------------------------------------------------------------------------+
| 2. LEARNER LIBRARY: Personal knowledge repository & sentence miner                   |
|    - Houses saved concepts, mined sentences, and reading bookmarks                    |
|    - GAP-01 Activation: Saving a concept initiates the single primary FSRS lineage    |
+---------------------------------------------------------------------------------------+
| 3. BILINGUAL DICTIONARY: Fast, morphologically normalized lexical search              |
|    - Single-lemma resolution, sense breakdown, bilingual definitions, audio           |
|    - One-click "Save to Library" intent trigger                                       |
+---------------------------------------------------------------------------------------+
```

---

## 2. Language Brain Projection Engine

### 2.1 Brain Summary Aggregate Projection
The Language Brain summary endpoint (`GET /v1/brain/summary`) provides real-time counts across the learner's vocabulary and grammar inventory:

```sql
SELECT
    COUNT(*) FILTER (WHERE effective_status = 'mastered') AS mastered_count,
    COUNT(*) FILTER (WHERE effective_status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE effective_status = 'learning') AS learning_count,
    COUNT(*) FILTER (WHERE effective_status = 'at_risk') AS at_risk_count,
    AVG(competence_score) AS average_competence,
    AVG(rec_alpha / (rec_alpha + rec_beta)) AS average_recognition,
    AVG(lis_alpha / (lis_alpha + lis_beta)) AS average_listening,
    AVG(prod_alpha / (prod_alpha + prod_beta)) AS average_production
FROM public.v_learner_concept_retrievability
WHERE user_id = :authenticated_user_id;
```

### 2.2 Concept Deep-Dive Inspection Endpoint
The detail endpoint (`GET /v1/brain/concepts/{id}`) hydrates canonical definitions, phonetic transcriptions, grammar formulas (if grammar), and learner cognitive parameters:

```json
{
  "concept_id": "7a3e9c12-8812-4f10-9b41-e123456789ab",
  "canonical_key": "word:bank:noun:finance",
  "concept_type": "word",
  "lemma": "bank",
  "part_of_speech": "noun",
  "cefr_level": "A1",
  "definition_en": "An organization where people and businesses can invest or borrow money",
  "definition_vi": "Ngân hàng",
  "phonetics": {
    "us": { "ipa": "/bæŋk/", "audio_uri": "https://cdn.linguaos.com/audio/en_us/bank.mp3" },
    "uk": { "ipa": "/bæŋk/", "audio_uri": "https://cdn.linguaos.com/audio/en_gb/bank.mp3" }
  },
  "learner_state": {
    "status": "active",
    "competence_score": 0.88,
    "dimensions": {
      "recognition": 0.95,
      "listening": 0.88,
      "production": 0.81
    },
    "fsrs": {
      "stability_days": 24.5,
      "difficulty": 4.2,
      "retrievability": 0.94,
      "due_at": "2026-10-05T10:00:00Z",
      "lapses": 0,
      "reps": 6
    }
  },
  "related_concepts": [
    { "relation": "collocates_with", "canonical_key": "word:account:noun", "status": "mastered" },
    { "relation": "collocates_with", "canonical_key": "word:deposit:verb", "status": "learning" }
  ]
}
```

---

## 3. Learner Library & GAP-01 Activation Semantics

### 3.1 The GAP-01 Activation Contract (`FACT`)
- In V1, saving a concept in the Library (`POST /v1/library/saved-concepts`) records the bookmark and triggers the GAP-01 activation workflow:
  1. Record bookmark in `user_saved_concepts`.
  2. Insert an append-only row into `concept_save_intents`.
  3. Ensure a `review_items` row exists with `lineage_type = 'primary'`.
  4. Ensure an `fsrs_states` row exists initialized to `'New'`.
  5. Ensure a `user_concept_states` row exists initialized to `'learning'`.

### 3.2 Unsaving Semantics (Non-Destructive Memory Rule)
> **Unsaving a concept removes the bookmark, NOT the learner's memory lineage.**
> When a user calls `DELETE /v1/library/saved-concepts/{id}`, the record in `user_saved_concepts` is deleted. However, `review_items`, `fsrs_states`, and `user_concept_states` remain intact. This prevents accidental loss of calibrated FSRS memory state simply because a user unpinned an item.

---

## 4. Bilingual Dictionary Search Architecture

### 4.1 Single-Lemma Search Resolution Pipeline
When a user searches the dictionary (`GET /v1/dictionary/search?q=banks`):

```
                       User Search Query: "banks"
                                  |
                                  v
+-------------------------------------------------------------------+
| 1. NORMALIZATION: Lowercase, strip punctuation, trim whitespace    |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 2. MORPHOLOGICAL LOOKUP: Query lexeme_forms for inflected forms    |
|    - Match: "banks" -> form_type: "plural", lexeme: "bank"        |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 3. SINGLE LEMMA RESOLUTION: Query lexemes + word_senses for "bank" |
|    - Exactly 1 lemma row returned                                 |
|    - Groups all senses: Sense 1 (finance, A1), Sense 2 (river, B1)|
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 4. LEARNER STATE ENRICHMENT: Join concept_senses + learner states  |
|    - Attaches independent status badges for each sense            |
+-------------------------------------------------------------------+
```

### 4.2 Optimized Search Query
```sql
SELECT
    l.id AS lexeme_id,
    l.lemma,
    l.part_of_speech,
    ws.id AS sense_id,
    ws.sense_order,
    ws.definition_en,
    ws.definition_vi,
    ws.cefr_level,
    ws.ipa_us,
    c.id AS concept_id,
    c.canonical_key,
    COALESCE(ucs.status, 'unseen') AS learner_status,
    (usc.id IS NOT NULL) AS is_saved
FROM public.lexemes l
JOIN public.word_senses ws ON ws.lexeme_id = l.id
LEFT JOIN public.concept_senses cs ON cs.word_sense_id = ws.id AND cs.is_primary = TRUE
LEFT JOIN public.concepts c ON c.id = cs.concept_id
LEFT JOIN public.user_concept_states ucs
    ON ucs.concept_id = c.id AND ucs.user_id = :authenticated_user_id
LEFT JOIN public.user_saved_concepts usc
    ON usc.concept_id = c.id AND usc.user_id = :authenticated_user_id
WHERE l.normalized_form = :normalized_query
   OR l.id IN (
       SELECT lexeme_id FROM public.lexeme_forms WHERE normalized_form = :normalized_query
   )
ORDER BY ws.sense_order ASC;
```
