# TASK-K2-07 — Multi-Modal Review Modality Engine

Status: SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE PENDING
Owner: CODEX single-writer lane  
Predecessor: K2-06 SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE: PASS  
Schema: NONE  
Branch: `feat/k2-07-modality-engine`

## Source promotion checkpoint — 2026-09-27

PR #19 merged into `master` at `ac02c349f8500975a843633556daf9d1bebc49e8`.
Final PR head `c97f3e0` passed Knowledge audit, Grammar/PostgreSQL,
Retrievability/PostgreSQL, Review frontend regression, and Vercel Preview.
Independent verify-fix review found the caller-supplied correctness HIGH issue
closed and no remaining HIGH/BLOCKER. The medium UTF-16 cloze-offset issue below
remains a separate follow-up. Render staging is live from the merge SHA with
`/health` 200; Supabase staging migration head remains `0019`. GitHub's Vercel
Production deployment status for the merge SHA is success. No K2-07 hosted
disposable-actor acceptance has run, so STAGING: PASS is not claimed.

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
- Caller-supplied `correct` is accepted only for `self_recall` (including omitted-mode legacy
  requests). Other explicit modes reject the field until a server-side grader or trusted adapter
  can provide objective correctness; rating fallback remains self-reported evidence at weight
  `1/2`.
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
  read-only behavior. An explicit non-self-recall request with caller-supplied `correct` must fail
  before any review, FSRS, event, or competence write; omitted-mode self-recall compatibility and
  rating-fallback weight `1/2` are covered at the API boundary.
- Contract generation remains fresh; frontend tests cover modality rendering, answer receipt
  persistence/backward compatibility, keyboard controls, and actor-epoch isolation.
- Existing FRLL Phase D/R1 and Review/Memory regression suites remain green.
- No migration. Hosted staging acceptance will use only an authorized disposable actor after source
  review and CI pass; learner isolation and complete cleanup are mandatory.

## Deferred follow-up

- **Medium:** Cloze target offsets can disagree between UTF-16 indexing and Python Unicode
  character indexing for supplementary-plane characters. Keep this as a separately scoped fix with
  a focused regression test; it is not part of the current HIGH correctness-trust-boundary patch.
