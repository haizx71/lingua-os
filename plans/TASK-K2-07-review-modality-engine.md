# TASK-K2-07 — Multi-Modal Review Modality Engine

Status: IMPLEMENTATION IN PROGRESS  
Owner: CODEX single-writer lane  
Predecessor: K2-06 SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE: PASS  
Schema: NONE  
Branch: `feat/k2-07-modality-engine`

## Objective

Select a deterministic Review exercise from the weakest observed competence dimension while
preserving the existing single learner/concept FSRS lineage and atomic Memory + competence write.
Queue reads remain read-only. Prompt material must come from canonical catalog records; no
examples, translations, or audio are fabricated.

## Selection rules

- Dimensions with `evidence_count > 0` are observed and rank by ascending score. Zero-evidence
  dimensions are unknown, not weak. Ties use the stable order recognition, listening, production.
- Recognition uses cloze only when an aligned target span exists in a published canonical example.
- Listening uses only an available HTTPS phonetic audio URI.
- Production uses typing only when a Vietnamese translated definition is available.
- If a ranked dimension lacks eligible material, skip it and try the next observed dimension.
  Fall back to `self_recall` when no observed dimension has usable material.
- The selected mode is included in the answer payload and existing idempotency fingerprint. Older
  clients omit it and retain the `self_recall` default.
- The selector does not calculate FSRS schedules or alter competence. It only chooses prompt
  presentation; the existing atomic transaction updates one FSRS state and the corresponding
  competence dimension.

## Canonical material and API

- Example source: `sentences`, `sentence_concepts`, and `sentence_translations`, restricted to
  published content passing the Reader publication gate.
- Typing clue: `word_senses.translated_definition` with Vietnamese translation language.
- Listening source: `phonetic_transcriptions.audio_uri`, accepted only as HTTPS.
- Use the existing queue `exerciseMode` and `prompt` envelope. Add optional
  `exerciseMode` to `ReviewAnswerRequest` to preserve mode in event fingerprint and exact retries.
- Frontend renders the selected prompt and captures a typing/cloze response; it never computes FSRS
  or client-side competence values. Pending local receipts remain actor-scoped and replay-safe.

## Acceptance

- Unit tests cover deterministic choice, ties, unsupported/missing material, and self-recall
  fallback.
- PostgreSQL/API tests prove canonical material projection, one-mode dimension routing, atomic
  rollback, replay/conflict, no duplicate FSRS lineage, concurrent answer locking, and queue
  read-only behavior.
- Contract generation remains fresh; frontend tests cover modality rendering, answer receipt
  persistence/backward compatibility, keyboard controls, and actor-epoch isolation.
- Existing FRLL Phase D/R1 and Review/Memory regression suites remain green.
- No migration. Hosted staging acceptance will use only an authorized disposable actor after source
  review and CI pass; learner isolation and complete cleanup are mandatory.
