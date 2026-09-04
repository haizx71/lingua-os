# TASK-006A — Review API Adapter v1 Review

Date: 2026-08-23  
Result: PASS, with one non-blocking contract limitation recorded below.

## Specification compliance

- PASS: Exactly `GET /v1/review/queue` and
  `POST /v1/review/{reviewItemId}/answer` are registered. `/health` remains outside product
  OpenAPI; no other product endpoint was added.
- PASS: Supabase bearer verification produces `AuthenticatedActor`; no request DTO accepts
  `userId` or any private FSRS state.
- PASS: Queue is actor/language-profile scoped and ordered only by `(due_at, review_item_id)`.
  The signed cursor preserves a fixed `asOf` boundary and contains no offset or Today ranking.
- PASS: Answer mapping is route -> Review application adapter -> accepted Memory Engine. FSRS
  calculation remains solely in the scheduler/domain boundary.
- PASS: Competence is read, unchanged, from the three persisted `user_skill_states` projections.
  Missing dimensions fail safe; no rating formula, placeholder, or duplicate score is created.
- PASS: `remainingDueCount` is counted after the transition in the same PostgreSQL transaction for
  the answered item's language profile at `reviewed_at`.

## Idempotency and transaction review

- PASS: Migration `0003_review_idempotency_result_v1` adds a private exact post-transition snapshot.
  Existing rows may remain null because the new non-null CHECK is `NOT VALID`; every newly inserted
  event must have a snapshot. Snapshot shape is constrained and never exposed publicly.
- PASS: A -> v2, B -> v3, replay A returns A's exact snapshot/event and leaves the persisted lineage
  at v3. Replay performs no scheduler transition.
- PASS: Pre-adapter legacy rows without a snapshot have an immutable-history reconstruction path.
  Public HTTP-created events always use the exact snapshot path.
- PASS: Same actor/key races on different lineages translate the idempotency unique constraint into
  `IdempotencyConflict`; raw `UniqueViolation` and constraint details cannot cross the API boundary.
- PASS: Same-lineage row locking, state-version protection, event/state/item atomicity, and one
  primary learner/concept lineage remain intact.

## Security and privacy review

- PASS: JWT verification fixes allowed algorithms to RS256/ES256 and validates signature, issuer,
  audience, expiration, subject UUID, and authenticated role. JWKS cache lifetime is ten minutes.
- PASS: Review SQL values are parameterized. The only SQL string composition selects one of two
  internal constant keyset clauses; no request text is interpolated.
- PASS: Cursor payloads are HMAC-SHA256 authenticated and canonical-base64url checked. A cursor is
  rebound to an actor-owned language profile before data access.
- PASS: Error envelopes use catalog codes and generic messages. Client responses and server log
  messages omit SQL, constraint names, FSRS parameters, token values, response text, and exception
  messages.
- PASS: Cross-user answer is existence-hiding `NOT_FOUND`; cross-user queue profile returns an empty
  page. Non-learner queue credentials remain within the queue operation's documented 401 behavior.

## OpenAPI and architecture review

- PASS: Success queue/answer bodies and a validation error body validate against the authoritative
  TASK-004 schemas, including UUID/date-time formats, required nullable `nextCursor`, strict extra
  field rejection, and no private scheduler fields.
- PASS: Generated FastAPI operations match the authoritative operation IDs, response status sets,
  parameter names, required answer fields, and `bearerAuth` security boundary.
- PASS: DTOs, Review application projections, relational read store, Memory Engine, and HTTP routes
  are separate modules. Components/frontend remain untouched.
- PASS: Review v1 uses the server-owned `self_recall` presentation mode for all queue items. The
  existing five presentation/evidence modes continue to share one scheduler in Memory Engine tests.

## Migration and code-quality review

- PASS: Migration is forward/backward versioned, search-path bounded, reproducible from empty,
  idempotently re-applicable, and rollback/re-apply tested.
- PASS: No new query index was added: the queue uses the existing actor/due/review-item index and is
  bounded to 100 items. There is no speculative optimization.
- PASS: Ruff format/lint and strict mypy are clean. Runtime/development dependency locks include
  pinned `PyJWT[crypto]==2.13.0` and match the verified environment exactly.

## Regression evidence

- Backend suite: 105 / 105 PASS.
- Review/OpenAPI focused suite: 15 / 15 PASS.
- Empty migration/rollback/re-apply check: PASS.
- `pip check`: PASS; development lock has zero missing/extra/version-mismatched packages.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: 282 / 282 across 26 / 26 files PASS.
- `pnpm build-storybook`: PASS with the pre-existing non-failing sourcemap/directive/eval/chunk
  warnings.
- `pnpm build`: PASS; all 14 static routes generated.

## Contract limitation to settle before non-lexical Review expansion

`ConceptSummary.partOfSpeech` is required by OpenAPI, while the accepted relational concept model
also permits `grammar` and `skill` concepts that need not have a lexeme/part of speech. TASK-006A
does not invent a fake POS: incomplete/non-lexical due projections fail safe. This does not block the
current lexical Review v1 or TASK-007's accepted screen, but the contract should make the field
optional or introduce a typed non-lexical summary before grammar/skill concepts enter Review.

## Final boundary result

No frontend, Today, Reader, placement, AI, speech, or additional product API work was performed.
TASK-007 was not started and remains blocked pending explicit authorization.
