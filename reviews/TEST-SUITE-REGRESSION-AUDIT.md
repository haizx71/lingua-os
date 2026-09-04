# Test suite regression audit before TASK-006

Date: 2026-08-22  
Scope: frontend test-suite regression only; TASK-006 not started

## Executive result

- Verified pre-TASK-005 baseline: **324 tests / 26 files**.
- Immediate post-TASK-005 state: **270 tests / 26 files**.
- Exact cause: two files were overwritten wholesale:
  - `contracts.test.ts`: 47 -> 22
  - `challenger.adversarial.test.ts`: 35 -> 6
- Arithmetic: `(47 + 35) - (22 + 6) = 54` fewer tests.
- Semantic audit of the 82 replaced tests:
  - 11 were renamed/merged into contract-authoritative tests.
  - 42 were intentionally obsolete provisional DTO/backend-algorithm tests.
  - 29 had meaningful coverage that was accidentally lost.
  - TASK-005 added 17 genuinely new contract/view-model tests.
- The 54-test drop is therefore exactly: `42 obsolete + 29 lost - 17 new = 54`.
- This audit restored all 29 lost coverage areas through 12 consolidated test cases plus strengthened
  assertions in four existing tests.
- Final expected inventory after restoration: **282 tests / 26 files**. The remaining difference
  from 324 is exactly the 42 intentionally obsolete tests: `324 - 42 = 282`.

## Per-file comparison

| Test file | Baseline | Post TASK-005 | Final audit |
|---|---:|---:|---:|
| navigation.test.tsx | 4 | 4 | 4 |
| e2e/f04-navigation-shell.test.tsx | 6 | 6 | 6 |
| e2e/f05-today-dashboard.test.tsx | 5 | 5 | 5 |
| e2e/tier4-real-world.test.tsx | 5 | 5 | 5 |
| e2e/f10-library-dictionary.test.tsx | 5 | 5 | 5 |
| e2e/tier3-combinations.test.tsx | 12 | 12 | 12 |
| e2e/f09-progress-level.test.tsx | 5 | 5 | 5 |
| components.test.tsx | 32 | 32 | 32 |
| motion.test.tsx | 15 | 15 | 15 |
| integration.test.tsx | 10 | 10 | 10 |
| challenger.motion-reduced.adversarial.test.tsx | 19 | 19 | 19 |
| e2e/tier5-adversarial-hardening.test.tsx | 20 | 20 | 20 |
| e2e/f06-smart-review.test.tsx | 5 | 5 | 5 |
| e2e/f08-language-brain.test.tsx | 5 | 5 | 5 |
| e2e/f12-ui-state-matrix.test.tsx | 5 | 5 | 5 |
| **contracts.test.ts** | **47** | **22** | **32** |
| e2e/f11-settings-profile.test.tsx | 5 | 5 | 5 |
| e2e/tier2-boundary-states.test.tsx | 12 | 12 | 12 |
| e2e/f02-ui-primitives.test.tsx | 6 | 6 | 6 |
| e2e/f07-interactive-reader.test.tsx | 5 | 5 | 5 |
| **challenger.adversarial.test.ts** | **35** | **6** | **8** |
| e2e/tier2-boundary-inputs.test.tsx | 10 | 10 | 10 |
| e2e/f03-storybook-a11y.test.tsx | 6 | 6 | 6 |
| e2e/f01-contracts-enums.test.ts | 6 | 6 | 6 |
| tokens.test.ts | 25 | 25 | 25 |
| tokens.adversarial.test.ts | 14 | 14 | 14 |
| **Total** | **324** | **270** | **282** |

The other 24 files retained their test counts. Several names/assertions were reconciled, but no test
definition disappeared from motion, reduced-motion, token, accessibility, component, navigation,
or page suites.

## Renamed or merged baseline tests (11)

| Baseline test | Authoritative replacement |
|---|---|
| `contains exactly the 8 concept statuses matching contracts/enums.json` | `has exactly eight ConceptStatus values and never due` plus adversarial rejection of `due` |
| `creates and serializes LinguaApiError correctly` | safe prototype/catalog behavior retained; obsolete client-created server envelope removed |
| `contains valid user and language profile fixtures` | generated DTO assignability plus profile adapter test |
| `contains Today plan with 4 activities and explainable reasons` | Today DTO/adapter ordering and reason-preservation tests |
| `contains reader content items with tokenized concepts and Vietnamese translations` | content DTO to Reader view-model adapter test |
| `retrieves progress analytics overview and history` | authoritative Progress overview DTO/adapter; nonexistent history endpoint portion removed |
| `simulates server error injection with specific ApiErrorCode` | catalog-valid mock injection/recovery test |
| `protects ReviewQueue from caller mutations` | response/data clone test, now strengthened with nested concept/memory mutation |
| `dynamically resumes healthy operations after clearing error injection` | deterministic error recovery test |
| `preserves prototype chain and duck typing under serialization / cross-context simulation` | strict `LinguaApiError` prototype guard; unsafe duck typing deliberately rejected |
| `strictly validates isConceptStatus against all 9 statuses and rejects garbage` | exact eight statuses, runtime guard matrix and explicit `due` rejection |

## Intentionally obsolete tests not restored (42)

Every removed test below enforced a provisional transport shape, frontend-owned backend behavior, or
an endpoint absent from the authoritative API. They must not be restored verbatim.

### From contracts.test.ts (22)

1. `contains content quality statuses and validates guard` — ingestion quality is internal and must
   not leak into learner DTOs; the registry itself remains covered by `f01-contracts-enums`.
2. `contains concepts across CEFR levels A1-C2 with bilingual data` — large fixture breadth is not a
   contract requirement; TASK-005 uses minimal deterministic fixtures.
3. `contains review items with distinct exercise modes and valid FSRS states` — presentation mode
   remains covered, but raw FSRS fields are private.
4. `retrieves and updates user profile and settings in-memory` — settings are local/deferred and no
   settings persistence API exists.
5. `manages language profiles: list, create, update` — stateful browser mutation was replaced by
   operation-shaped static transport; endpoint types remain covered.
6. `completes Today plan activity and updates minutes & health score` — backend owns plan state and
   memory-health changes.
7. `submits review answer with rating "again" and adjusts queue` — frontend must not schedule or
   mutate mastery/FSRS.
8. `submits review answer with rating "good" and advances queue` — same backend-ownership reason.
9. `searches dictionary across English terms and Vietnamese definitions` — backend query behavior,
   not frontend mock logic.
10. `analyzes reader text and computes known word ratio` — known-ratio analysis is server-owned.
11. `saves mined sentence to library` — the old assertion persisted unsupported `userNotes`.
12. `retrieves brain summary, paginated concepts, and graph` — graph API is absent; relational
    summary/list/detail and cursors are tested instead.
13. `executes full adaptive diagnostic assessment flow from start to result` — placement/adaptive
    scoring belongs to backend TASK-016.
14. `applies "again" rating: sets relearning, increments lapses, and marks concept weak` — raw FSRS.
15. `applies "hard" rating: advances reps and transitions status to learning` — raw FSRS.
16. `applies "good" rating: increments stability and transitions status to familiar` — raw FSRS.
17. `applies "easy" rating: transitions status to mastered` — frontend mastery calculation.
18. `exhausts all 4 review items sequentially until queue is completely empty` — stateful scheduler
    mock behavior; UI progression remains covered separately.
19. `throws NOT_FOUND when submitting an answer for a non-existent review item ID` — server
    validation behavior, not a static frontend mock algorithm.
20. `handles search queries with varied casing, whitespace, and substrings` — backend search logic.
21. `filters brain concepts by status and searches by Vietnamese meaning` — old graph/search mock;
    UI filters retain their component/integration coverage.
22. `resets state completely to pristine fixture copies without cross-test leakage` — old mutable
    domain stores were removed; only transport control reset is now tested.

### From challenger.adversarial.test.ts (20)

1. `rejects unknown concept ID with 404 NOT_FOUND` — backend entity validation.
2. `rejects unknown content ID with 404 NOT_FOUND` — backend entity validation.
3. `rejects unknown language profile ID on update with 404 NOT_FOUND` — backend ownership/entity validation.
4. `rejects unknown activity ID on completion with 404 NOT_FOUND` — backend state validation.
5. `rejects unknown review item ID on answer submission with 404 NOT_FOUND` — backend queue validation.
6. `rejects assessment answer on non-existent session ID with 404 NOT_FOUND` — backend assessment validation.
7. `rejects empty languageCode with 422 VALIDATION_ERROR` — backend request validation.
8. `rejects empty text in reader text analysis with 422 VALIDATION_ERROR` — backend request validation.
9. `rejects empty sentenceId in saveSentence with 422 VALIDATION_ERROR` — backend request validation.
10. `safely handles adversarial strings in dictionary search without regex injection or crash` —
    the browser no longer implements dictionary search.
11. `handles extreme reader passages (5,000 words) smoothly without crash` — server analysis/performance behavior.
12. `handles 10 parallel distinct review submissions without queue index corruption` — backend scheduler concurrency.
13. `handles concurrent double-submission of the EXACT SAME review item idempotently / cleanly rejects 2nd call` — backend idempotency/state transition.
14. `idempotently handles 10 concurrent completions of the same today activity` — backend Today mutation.
15. `handles rapid concurrent language profile creations cleanly` — backend persistence/concurrency.
16. `fully resets all mutated stores back to pristine fixture dataset on resetState()` — old mutable stores no longer exist.
17. `verifies FSRS rating transitions across all 4 ratings (again, hard, good, easy)` — frontend FSRS is prohibited.
18. `updates specific skill signal dimensions based on exercise mode` — server owns competence evidence projection.
19. `prevents callers from mutating internal brain graph nodes` — graph payload/API removed.
20. `strictly validates isContentQualityStatus` — internal ingestion enum has no learner-facing runtime guard.

## Accidentally lost coverage and restoration (29 old cases)

At 270 tests these semantics were missing or too weak. They are now restored in consolidated tests;
no meaningful lost item remains open.

### Lost contracts coverage (17 old cases)

- Runtime guards: `validates concept status type guard`, `contains all 4 learning activity types and
  validates guard`, `contains 4-tier FSRS review ratings and validates guard`, `contains all 5
  exercise presentation modes`, `contains explainable reason codes`, `contains CEFR and confidence
  levels`.
- Label completeness: `maps human-readable Vietnamese labels for all statuses and ratings`.
- Error integrity: `maps OpenAPI standard error codes to HTTP status codes matching
  contracts/errors.json`, `provides friendly Vietnamese error messages for all error codes`,
  `validates isApiErrorCode guard`, `identifies LinguaApiError using isLinguaApiError guard`.
- Transport behavior: `simulates configurable network latency`, `simulates empty dataset returns
  across all endpoints` (restored only for the five authoritative cursor collections).
- Clone/isolation: `protects UserProfile from caller mutations`, `protects ConceptDetail from caller
  mutations`, `protects TodayPlan from caller mutations`, `maintains complete isolation between
  distinct MockApiClient instances`.

### Lost challenger coverage (12 old cases)

- `correctly simulates all 9 API error codes with exact HTTP status codes` and `falls back to
  standard Vietnamese messages when custom message is omitted` — reconciled to all 11 current codes
  and safe local messages.
- `gracefully clamps negative latency values to 0 without throwing or breaking` and `simulates
  controlled latency under parallel requests`.
- `prevents callers from mutating internal state by mutating returned profile` and `prevents callers
  from mutating internal state by mutating returned review items`.
- Runtime guard fuzzing: `strictly validates isLearningActivityType`, `strictly validates
  isReviewRating`, `strictly validates isExerciseMode`, `strictly validates isReasonCode`, `strictly
  validates isCEFRLevel and isConfidenceLevel`, `strictly validates isApiErrorCode against all 9
  codes and rejects arbitrary strings`.

### New/restored audit tests

Twelve test definitions were added across the same two files:

- exhaustive authoritative runtime enum guards
- Vietnamese label completeness
- all-code HTTP/local error catalog mapping
- strict `LinguaApiError` prototype/guard behavior
- all 29 OpenAPI operations present on the mock boundary
- empty envelopes for all five cursor collections
- multi-resource and cross-client deep-clone isolation
- Today order/reason preservation without recommendation sorting/scoring
- no placement answer keys/calculation in frontend source
- identical static assessment projections for different answers
- negative/positive/parallel latency behavior
- transport control reset without shared state leakage

Four existing tests were strengthened without increasing count:

- review answers now cover all four ratings and prove Today remains unchanged
- error injection now covers all 11 API codes and authoritative statuses
- persistence classification now asserts the exact ten-key object
- review queue cloning now mutates nested concept/memory data and refetches

## Critical coverage preservation

- GSAP motion: 15 tests unchanged.
- Prefers-reduced-motion: 19 dedicated adversarial tests unchanged, plus motion/token coverage.
- Design-token adversarial: 14 tests unchanged; base token suite remains 25 tests.
- Accessibility: component primitives (32), Storybook/a11y (6), UI primitives (6), and Tier-5
  non-color/touch-target coverage remain.
- Ownership: no `userId` transport methods/fields; library idempotency and ownership-free response
  checks remain.
- ConceptStatus/enums: exact eight values, runtime guards/labels, and explicit no-`due` checks.
- No frontend FSRS: raw fields absent; all four ratings return the same static server memory and
  competence projection.
- No frontend placement: no answer key/scoring source and different options return the same static
  assessment DTO.
- No frontend Today recommendation logic: adapter preserves server order/reason; review activity
  does not mutate Today in either the authoritative mock or legacy UI scenario harness.
- API/mock conformance: generated freshness, DTO assignability, 29 methods, UUID/RFC 3339,
  provenance, cursor envelopes and deep cloning.
- Error mapping: all 11 machine codes/statuses plus safe local copy; attacker/server messages ignored.
- Persistence gaps: all ten classifications checked exactly.

## Verification

- `pnpm typecheck` — PASS; generated OpenAPI freshness plus all workspace TypeScript checks.
- `pnpm lint` — PASS; zero ESLint warnings/errors under `--max-warnings=0`.
- `pnpm test` — PASS; **282 / 282 tests across 26 / 26 files**.
- `pnpm build-storybook` — PASS; existing dependency/sourcemap/chunk warnings remain non-failing.
- `pnpm build` — PASS; all 14 static Next.js routes generated.

One pre-existing controlled-input React warning remains in `components.test.tsx`; it is unrelated to
the regression audit and does not change any gate result.

Final audit finding: **no meaningful accidentally lost regression coverage remains open**. The final
42-test difference from the historical baseline is fully accounted for by the explicitly listed
obsolete provisional/backend-behavior tests.
