# First Real Learning Loop — Frozen Architecture and Acceptance Plan

Status: **PLANNING FROZEN — implementation has not started**  
Baseline: `302e132` (`TASK-007` accepted)  
Scope: one disposable, real-authenticated, PostgreSQL-backed `vi -> en` learner loop.

This plan is the executable acceptance boundary for the checkpoint. It does not
authorize product redesign, a contract change, a schema migration, or direct
construction of learner-derived state.

## 1. Purpose

Prove that the already accepted LINGUA OS components form one coherent learning
loop for the same learner, language profile, and concept:

```text
Supabase Auth session
  -> FastAPI actor
  -> profile bootstrap and persisted time zone
  -> active vi -> en language profile
  -> explicit Save/Learn
  -> one Memory lineage, naturally due
  -> server-generated Today plan
  -> Review Live explicit answer
  -> atomic Memory + event + competence transition
  -> exact idempotent replay after a lost response
  -> read-only Brain projection of the same PostgreSQL state
```

The checkpoint proves integration, not a new product feature. Passing it does
not mark a new domain capability complete; it establishes that accepted
capabilities connect without fake state or duplicated authority.

## 2. Existing accepted architecture relied upon

- Supabase Auth establishes the external identity. FastAPI validates the JWT
  against the configured Supabase JWKS and derives the actor from `sub`.
- `GET /v1/me` is the only application-identity bootstrap boundary. It creates
  only `public.users` and `learner_profiles` when required.
- PostgreSQL is the source of persisted learner truth.
- `PUT /v1/library/concepts/{conceptId}` is the sole MVP Save/Learn activation
  boundary. Its accepted transaction creates the immutable first-save intent,
  canonical save event/projection, and ensures the Memory lineage.
- Memory owns FSRS. There is exactly one `review_items` row per learner and
  concept and exactly one `fsrs_states` row per review item.
- Competence is a separate projection with recognition, listening, and
  production dimensions; it is not a scheduler.
- A newly saved concept is initialized with `due_at = activated_at`. No direct
  due-state mutation is necessary or permitted.
- `GET /v1/today` owns recommendation and persists the first plan for the
  learner-local date. An existing daily plan is reused, so Save/Learn must occur
  before the first Today read in this test.
- `POST /v1/review/{reviewItemId}/answer` owns the atomic review transition and
  returns server-authoritative Memory and competence snapshots.
- Review Live owns only presentation, explicit input capture, durable pending
  answer receipt, retry, and reconciliation. It calculates no FSRS or competence.
- Brain GET operations are read-only projections over PostgreSQL and may return
  synthetic zero-evidence state without persisting it.
- OpenAPI is the transport authority. No checkpoint-specific field or endpoint
  will be added.

## 3. Environment prerequisites and architecture decision (Question A)

### Chosen narrow environment

Use all of the following in a dedicated disposable integration environment:

1. one real Supabase development project providing Auth and its PostgreSQL;
2. local FastAPI configured for that project's database and Supabase JWKS;
3. local Next.js using the same project's public Supabase settings;
4. a test-only same-origin reverse proxy in front of Next.js and FastAPI;
5. Playwright driving a real browser through that proxy;
6. direct read-only PostgreSQL probes for table-level acceptance evidence.

This is narrower and more truthful than the existing Docker-only database test
bootstrap. The latter emulates `auth.users` and `auth.uid()` for database tests,
but cannot prove a real Supabase session crossing the FastAPI actor boundary.

The reverse proxy is required because the current application has neither a
Next.js API rewrite nor FastAPI CORS middleware. Direct browser traffic from a
local Next origin to a different FastAPI origin would be blocked. The checkpoint
proxy will expose `/api/*` on the browser origin and strip `/api` when forwarding
to FastAPI. `NEXT_PUBLIC_API_BASE_URL=/api` keeps browser calls same-origin. This
is test infrastructure, not product behavior or a production ingress decision.

### Required environment variables

The orchestrator must require, without printing values:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (test controller only; never browser-exposed)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL=/api`
- `REVIEW_CURSOR_SECRET`

Preflight must compare the public/backend Supabase URL identities without logging
credentials, require a non-production environment allowlisted for destructive
test-user cleanup, and fail before any mutation if configuration is absent or
points at an unapproved project.

Current reconnaissance found none of these variables configured in this shell.
Provisioning a dedicated Supabase project and injecting secrets are external
prerequisites; the repository must not contain their values.

## 4. Deterministic fixture strategy (Questions B and C)

### Authenticated users

The test controller will create two confirmed, disposable Supabase Auth users
through the Auth Admin API using a backend-only service-role key:

- Actor A runs the complete learning loop.
- Actor B proves narrow ownership isolation.

Email addresses include a cryptographically random run identifier; passwords
exist only in process memory. Actor A signs in through the real `/auth` UI. Actor
B may be initialized in a second browser context or by an authenticated HTTP
controller using a real user token. Cleanup deletes both Auth users through the
normal Auth Admin API in `finally`; the existing foreign keys cascade their
application state. The harness must never log tokens, passwords, service-role
keys, or full connection strings.

No current repository fixture provisions a real Supabase Auth user. The Admin
provisioner is therefore required test tooling, not a product auth endpoint.

### Minimal catalog fixture

Add one idempotent SQL seed for a single published English lexical concept, with
fixed UUIDs and all required provenance:

- one allowed synthetic/internal license;
- one data source;
- one approved source record with deterministic SHA-256 content hash and quality
  metadata;
- one English `word` concept;
- one English lexeme with part of speech `noun`;
- one word sense with a deterministic English definition and Vietnamese
  translation.

Suggested stable concept ID:
`7f110000-0000-4000-8000-000000000004`.

Use a unique searchable lemma such as `frll-anchor` so dictionary discovery is
deterministic and cannot collide with larger development seeds. The seed uses
`ON CONFLICT DO NOTHING`, passes provenance/publication gates, and creates no
content item because Reader content is not required by this loop.

The seed must create **no** rows in learner-owned or learner-derived tables,
including `users`, `learner_profiles`, `user_languages`,
`user_saved_concepts`, `concept_save_intents`, `user_concept_states`,
`user_skill_states`, `user_language_projection_heads`, `learning_events`,
`review_items`, `fsrs_states`, `review_events`, or Today tables.

This is seed data, not a migration. A fixture test must prove idempotence,
provenance completeness, publication eligibility, and absence of learner state.

## 5. Actor and language-profile setup

For Actor A:

1. Create the disposable confirmed Auth user through the test controller.
2. Sign in through `/auth` using the real Supabase browser client.
3. Call `GET /v1/me`; capture `data.user.id` and the strong `ETag`.
4. Assert the returned user ID equals the Supabase Auth subject and exactly one
   corresponding `public.users` and `learner_profiles` row exists.
5. If the profile time zone is absent, call `PATCH /v1/me` with the captured
   `If-Match` and `{ "timeZone": "Asia/Ho_Chi_Minh" }`.
6. Call `GET /v1/me/languages`. In a fresh actor it must be empty.
7. Call `POST /v1/me/languages` with a fresh actor-scoped idempotency key and:

   ```json
   {
     "targetLanguageCode": "en",
     "nativeLanguageCode": "vi",
     "goal": "communication",
     "dailyMinutes": 15
   }
   ```

8. Capture the returned active language-profile ID and use it unchanged for
   Save/Learn resolution, Today, Review queue, and Brain reads.
9. Starting Level is intentionally optional. The primary path omits it and
   asserts that absence does not block readiness or the loop.

Actor B is bootstrapped separately with the same valid time zone and an active
`vi -> en` profile only when FRLL-13 runs. No identifier, token, idempotency key,
or pending-answer receipt may cross actors.

## 6. Exact end-to-end scenario

1. Start from a migrated, dedicated test database with only reference data and
   the minimal catalog fixture; no Actor A or Actor B exists.
2. Provision and sign in Actor A through real Supabase Auth.
3. Bootstrap Actor A, persist `Asia/Ho_Chi_Minh`, and create the active profile.
4. Discover `frll-anchor` through `GET /v1/dictionary/search` and open its
   concept detail if the UI path does so. Assert that these reads create no
   learner evidence or Memory state.
5. Explicitly choose Save/Learn through the live Dictionary UI, producing
   `PUT /v1/library/concepts/{conceptId}`.
6. Verify one immutable save intent, one saved membership, one save learning
   event, zero competence evidence, and exactly one naturally due Memory lineage.
7. Repeat the same PUT and prove that lineage, intent, event, and projections
   are not reset or duplicated.
8. Open Today only after Save/Learn. Call `GET /v1/today` once for a fixed date
   interpreted in the persisted time zone. Assert its Review activity targets
   the exact saved concept's review item.
9. Enter Review Live and load `GET /v1/review/queue` for the same profile. Reveal
   the answer; assert reveal alone creates no evidence.
10. Choose the explicit rating `good`. The UI sends one logical answer with a
    UUID idempotency key and a deterministic positive `responseTimeMs`.
11. For the primary answer proof, allow the 200 response and compare its Memory
    and production-competence snapshots with committed PostgreSQL rows.
12. Run a separate fresh Actor A2 (or a second concept-isolated fresh run) for
    the lost-response proof so the primary proof remains easy to diagnose.
13. In the lost-response run, let FastAPI commit the first answer, discard its
    response at the browser boundary, reload/re-enter Review, and retry the exact
    saved receipt. Prove exact replay and no second transition.
14. Query Brain for Actor A, the same language profile, and the same concept.
    Compare the projection with the accepted Review response and database rows;
    prove the GET itself performs no writes.
15. Bootstrap Actor B and perform the narrow isolation assertions.
16. Delete disposable Auth users through Supabase Admin and assert cascaded
    learner cleanup; leave only the idempotent catalog fixture.

Using a distinct disposable actor for each independently retryable test case is
the repeatability boundary. Derived state is never manually rewritten between
steps.

## 7. Authoritative API call sequence

| Step | Method and path | Required transport detail | Purpose |
|---|---|---|---|
| 1 | `GET /v1/me` | Supabase bearer token | Bootstrap public identity/profile and obtain ETag |
| 2 | `PATCH /v1/me` | bearer + strong `If-Match` | Persist `Asia/Ho_Chi_Minh` |
| 3 | `GET /v1/me/languages` | bearer | Confirm fresh language-profile state |
| 4 | `POST /v1/me/languages` | bearer + `Idempotency-Key` | Create active `vi -> en` profile |
| 5 | `GET /v1/dictionary/search?query=frll-anchor&languageCode=en` | bearer | Discover the seeded catalog concept |
| 6 | `GET /v1/concepts/{conceptId}` | bearer | Optional live detail read; must not create evidence |
| 7 | `PUT /v1/library/concepts/{conceptId}` | bearer; PUT is intrinsically idempotent | Explicit Save/Learn activation |
| 8 | repeat step 7 | identical actor and target | Prove save idempotence |
| 9 | `GET /v1/today?languageProfileId={id}&date={fixedLocalDate}` | bearer; no `timeZone` query | Persist/retrieve the server-owned plan |
| 10 | `GET /v1/review/queue?languageProfileId={id}` | bearer; opaque cursor only if paginating | Load the real due item |
| 11 | `POST /v1/review/{reviewItemId}/answer` | bearer + stable `Idempotency-Key`; `{rating,responseTimeMs}` | Execute the authoritative atomic transition |
| 12 | repeat step 11 | same actor, key, and byte-equivalent logical payload | Exact replay after ambiguity |
| 13 | `GET /v1/review/queue?languageProfileId={id}` | bearer | Reconcile queue after recovery |
| 14 | `GET /v1/brain/concepts/{conceptId}` | bearer, same profile context resolved by server | Read the resulting projection |
| 15 | optional `GET /v1/brain/concepts?languageProfileId={id}` and `/v1/brain/summary?languageProfileId={id}` | bearer | Cross-check list/aggregate without writes |

No endpoint or request field outside frozen OpenAPI is permitted. The harness
must fail as a contract blocker rather than modifying OpenAPI if runtime behavior
does not match this sequence.

## 8. Expected PostgreSQL state after each mutation (Questions D and E)

All assertions are scoped by Actor A and the stable concept ID. Capture a
read-only snapshot before and after each operation so counts and versions prove
causality rather than merely final existence.

### After `GET /v1/me`

- `auth.users`: one real Supabase-owned row for the JWT subject.
- `public.users`: exactly one row with the same UUID.
- `learner_profiles`: exactly one owned row.
- No `user_languages`, save, Memory, evidence, Review, or Today row yet.

### After profile patch and language-profile creation

- `learner_profiles.time_zone = 'Asia/Ho_Chi_Minh'`.
- Exactly one active `user_languages` row for Actor A, native `vi`, target `en`,
  goal `communication`, and `daily_minutes = 15`.
- No learner concept, Memory, evidence, Review event, or Today row.

### After first Save/Learn

- `user_saved_concepts`: count 1 for `(user_id, concept_id)`.
- `concept_save_intents`: count 1 for `(user_id, concept_id)`; retain its ID and
  `created_at` for the repeated-save comparison.
- `review_items`: count 1 for `(user_id, concept_id)`, same language profile,
  `status = 'active'`, `created_from = 'learner_saved'`.
- `fsrs_states`: count 1 for that review item, `state = 'new'`,
  `state_version = 1`, `last_review_at IS NULL`, and `due_at` equal to the
  activation time recorded by the accepted transaction. Difficulty and
  stability are nullable for the new-state shape.
- `learning_events`: exactly one canonical
  `learning.concept.saved.v1` derivation whose `source_type =
  'concept_save_intent'`, `source_event_id` equals the captured save-intent ID,
  and `ingestion_sequence = 1` for the profile.
- `user_concept_states`: exactly one row with `status = 'learning'`,
  `has_learning_intent = true`, `has_projectable_evidence = false`, mastery
  nullable, aggregate confidence zero, all three dimension scores at the
  zero-evidence prior (`0.5`), all dimension confidence/count/masses zero.
- `user_skill_states`: no evidence mass/count from Save/Learn; if rows are
  materialized, every dimension remains at score `0.5`, confidence `0`, count
  `0`, and zero masses.
- `review_events`: count 0.

The due eligibility proof is `fsrs_states.due_at <=` the Today generation
`as_of`; no test SQL updates `due_at`.

### After repeated Save/Learn

All prior counts, IDs, timestamps, `state_version`, FSRS fields, ingestion
sequence, competence values, and masses are byte/value unchanged. Only the HTTP
response metadata may be newly generated.

### After first `GET /v1/today`

- `today_plans`: exactly one row for Actor A/profile/fixed local date with
  `time_zone = 'Asia/Ho_Chi_Minh'`, `engine_version =
  'today-heuristic-v1'`, and its persisted `as_of`.
- `today_plan_activities`: one Review activity selected for the proof target,
  with a reason code containing `FSRS_DUE`; its target and snapshots are
  server-created.
- `today_activity_review_items`: contains the exact captured `review_items.id`.
- No `review_events` row and no new competence/learning evidence from displaying
  Today.

### After one accepted Review answer

- `review_events`: count increases from 0 to exactly 1. The row contains the
  captured idempotency key, SHA-256 `request_fingerprint`, `rating = 'good'`,
  response time, parameter-set lineage, and populated
  `result_memory_snapshot`, `result_competence_snapshot`,
  `result_remaining_due_count`, and `result_feedback`.
- `fsrs_states`: the same single row remains; `state_version` increases exactly
  `1 -> 2`, `last_review_at` becomes non-null, and its persisted transition
  fields match `review_events.result_memory_snapshot` and the API response. Do
  not hard-code FSRS output values in the harness.
- `learning_events`: total concept-related count becomes exactly 2: one save and
  one `learning.review.completed.v1`. The review derivation has `source_type =
  'review_event'`, `source_event_id` equal to the Review event ID, and profile
  `ingestion_sequence = 2`.
- `user_concept_states`: remains a single row; `state_version` increases exactly
  once, `has_projectable_evidence = true`, and production evidence count becomes
  1. Production score/confidence/masses match the stored Review result;
  recognition and listening evidence count/masses remain 0.
- `user_skill_states`: production evidence count becomes 1 and its score,
  confidence, and masses match the accepted projection. Recognition/listening
  remain zero-evidence.
- The Review response `data` matches the stored result snapshots; no client
  calculation is used as expected truth.

## 9. Exact idempotency and replay proof

Capture a database digest after the first committed Review response containing:

- review-item ID and FSRS `state_version` plus all state fields;
- Review-event ID, key, fingerprint, and four stored result fields;
- count and IDs of all concept-scoped `learning_events`;
- concept projection version, dimension counts, confidence, masses, and scores;
- production skill projection version/count/confidence/masses/score;
- queue count for the same profile.

Repeat `POST /v1/review/{reviewItemId}/answer` with the same Actor A token,
`Idempotency-Key`, rating, and response time. Assert:

1. HTTP 200 and response `data` deeply equals the first response `data`;
2. response-level request metadata may differ and is not part of replay truth;
3. every database digest field and row count is unchanged;
4. `fsrs_states.state_version` remains 2;
5. Review-event count remains 1;
6. the review learning-event count remains 1;
7. competence evidence count/mass/version remain unchanged;
8. the queue reflects the authoritative post-answer schedule, not an optimistic
   frontend removal.

As a bounded negative assertion, reuse the same key with a changed rating or
response time and require the frozen idempotency-reuse error with no database
change. A different logical answer would require a new key and is outside this
single-answer scenario.

## 10. Deterministic lost-response and reload proof (Question G)

Use Playwright route interception for the answer endpoint:

1. Review Live writes its pending receipt before dispatch. Read only test-visible
   browser storage metadata necessary to assert the receipt contains the review
   item ID, rating, UUID key, and response time and is actor/profile scoped.
2. The interceptor calls the upstream route with `route.fetch()` so the real
   FastAPI request commits. Capture the upstream status and response `data` in
   the test controller, not in application state.
3. After upstream 200, run the PostgreSQL probe and prove the one transition is
   committed.
4. Abort the browser-facing route instead of fulfilling it. The UI must observe
   an ambiguous network outcome and retain the receipt.
5. Reload the browser or navigate away and re-enter `/review` as the same actor
   and profile.
6. Assert the recovery UI appears. Trigger its explicit retry.
7. Capture the retry and assert identical review-item path, identical
   `Idempotency-Key`, and identical logical request body.
8. Allow the retry to reach FastAPI normally. Assert returned `data` deeply
   equals the hidden first response `data`.
9. Re-run the database digest and assert no field, count, mass, or version changed
   after retry.
10. Assert the UI clears the receipt only after authoritative success and
    refetches/reconciles `GET /v1/review/queue`.

This proves commit, effective response loss, re-entry, same-operation retry, and
no duplicate transition without relying on a flaky physical network outage.

## 11. Brain projection proof

Before the Brain GET, capture a digest of all learner-owned tables. Call
`GET /v1/brain/concepts/{conceptId}` as Actor A and assert:

- the returned concept ID is the deterministic fixture ID;
- its single Memory snapshot matches the current `fsrs_states` row and the
  authoritative Review result;
- `evidence.reviewCount = 1` and exposure count is zero;
- production score, confidence, and evidence count match
  `user_concept_states` and the Review result;
- recognition and listening remain at score `0.5`, confidence `0`, and evidence
  count `0`;
- mastery/status/confidence equal the persisted accepted projection semantics,
  including nullable mastery where applicable;
- no second scheduler or independently constructed competence state exists.

After the Brain GET (and optional list/summary GETs), the database digest must be
identical. This is the proof that Brain projects PostgreSQL truth and does not
write on reads.

## 12. Narrow actor-isolation proof

With Actor B's real Supabase session and separate active profile:

1. `GET /v1/review/queue` must not contain Actor A's review item.
2. `GET /v1/brain/concepts/{conceptId}` may expose the public catalog concept but
   must return synthetic zero learner state: `status = unseen`, `memory = null`,
   `reviewCount = 0`, and each competence dimension score `0.5`, confidence `0`,
   evidence count `0`.
3. Actor B attempts to answer Actor A's review-item ID and receives the frozen
   not-found semantics; no ownership existence is leaked.
4. Database digests for both actors are unchanged by the forbidden mutation.
5. Actor B has no `review_items`, `fsrs_states`, `review_events`,
   `learning_events`, or materialized learner concept projection for the fixture
   merely because Actor A learned it or Actor B read Brain.

This is sufficient for the checkpoint and does not expand into a broad RLS or
multi-tenant penetration project.

## 13. Zero-fake-evidence proof

Take learner-state digests at these UI/API boundaries before any explicit answer:

- auth/profile page load;
- dictionary result rendering;
- concept detail rendering;
- Today display;
- Review card display;
- answer reveal;
- navigation away/back;
- Brain display.

For each boundary, assert no new `review_events` or evidence-bearing
`learning_events`, no competence count/mass/version change, and no FSRS
transition. Save/Learn is allowed to create its canonical activation event and
Memory lineage, but contributes zero competence mass. Only the explicit Review
rating may create the review evidence transition.

Audio has no real URL in the minimal Review fixture, so the E2E must not invent
one. Preserve the already accepted TASK-007 regression that proves explicit
audio playback, when supplied, does not answer or create evidence. The final gate
must run that existing test alongside the real-loop E2E.

## 14. Automated checkpoint architecture (Question F)

Use one primary browser E2E as the cross-layer owner, supported by narrow tools:

```text
PowerShell orchestrator
  ├─ preflight/secret-safe environment validation
  ├─ migrations + deterministic catalog seed
  ├─ Supabase Admin disposable-user provisioner
  ├─ FastAPI + Next.js + same-origin test proxy
  ├─ Playwright First Real Learning Loop spec
  │    ├─ real Auth UI and live product screens
  │    ├─ real HTTP endpoints
  │    ├─ deterministic lost-response interception
  │    └─ read-only PostgreSQL probe snapshots
  └─ finally: stop processes + delete Auth users + cleanup verification
```

Do not duplicate the whole loop in backend, database, and frontend suites.

- The Playwright spec owns the end-to-end identity and causal chain.
- A Python PostgreSQL probe owns exact table assertions and emits only
  non-secret IDs, counts, versions, booleans, and hashes as JSON.
- A database fixture test owns seed idempotence/provenance/no-derived-state.
- Existing backend tests continue to own algorithm edge cases, concurrency,
  RLS, replay, and rollback detail.
- Existing Vitest tests continue to own Review Live component races and UI
  behavior; the E2E proves connection to real services.

Likely implementation files:

- `database/seeds/first_real_learning_loop.sql`
- `tests/backend/database/test_first_real_learning_loop_fixture.py`
- `tests/acceptance/first-real-learning-loop.spec.ts`
- `tests/acceptance/playwright.frll.config.ts`
- `tests/acceptance/support/same-origin-proxy.ts`
- `tests/acceptance/support/supabase-users.ts`
- `tests/acceptance/support/postgres-probe.py`
- `scripts/verify-first-real-learning-loop.ps1`
- root `package.json` and `pnpm-lock.yaml` for `@playwright/test` and
  `test:frll`
- `.env.example` only if names for test-only, non-secret configuration must be
  documented

Expected zero-diff areas: `contracts/**`, `services/**`, all migration files, and
`apps/web/src/**`. Any need to touch one of them is a new REQUIRED gap and stops
implementation for architecture review.

## 15. Acceptance tests FRLL-01 through FRLL-16

| ID | Automated proof |
|---|---|
| FRLL-01 | A real Supabase browser session reaches FastAPI; JWT subject equals `GET /v1/me` and `public.users.id`. |
| FRLL-02 | One actor/profile/concept ID chain is captured and reused across bootstrap, Save, Today, Review, and Brain. |
| FRLL-03 | Seed inspection and pre-Save digest prove no learner-derived row was directly seeded. |
| FRLL-04 | Minimal fixed-ID concept is searchable, published, licensed, attributed, and seed-idempotent. |
| FRLL-05 | Pre/post Save digest proves activation occurs only after the live PUT. |
| FRLL-06 | Save and repeated Save leave exactly one review item, one FSRS row, one intent, and one save event without reset. |
| FRLL-07 | The first Today plan is generated after Save and maps its Review activity to the actual due review item. |
| FRLL-08 | Review Live sends an explicit rating through the frozen answer API; no test direct-update performs the transition. |
| FRLL-09 | One answer causes exactly one FSRS version transition, Review event, review learning event, competence application, and stored response snapshot. |
| FRLL-10 | Same actor/key/payload replay returns the same `data` and leaves the full database digest unchanged. |
| FRLL-11 | Intercepted committed response loss, reload/re-entry, stored-receipt retry, exact replay, receipt clearing, and queue reconciliation all pass. |
| FRLL-12 | Brain detail equals the same PostgreSQL Memory/competence/evidence state and Brain GET causes zero writes. |
| FRLL-13 | Actor B cannot see/answer Actor A's review state and receives only zero learner projection for the public concept. |
| FRLL-14 | Rendering, reveal, audio regression, navigation, Today display, and Brain display create zero evidence. |
| FRLL-15 | Generated OpenAPI types remain fresh; the E2E uses only frozen paths/DTOs and contract checks pass with zero contract diff. |
| FRLL-16 | Two consecutive clean runs with new disposable actors pass; cleanup uses Auth deletion/cascades, not manual derived-state rewrites. |

## 16. REQUIRED gaps

### REQUIRED-ENV-01 — no configured real integration environment

1. **Problem:** the current shell has none of the required Supabase/PostgreSQL or
   frontend public variables. The repository contains examples but no real
   credentials or local Supabase stack.
2. **Violated invariant:** FRLL-01 and FRLL-16 cannot be truthfully demonstrated.
3. **Narrowest correction:** provision/approve one disposable Supabase dev
   project and inject secrets through the execution environment.
4. **Likely files:** no source file is required; optionally document non-secret
   test variable names in `.env.example`.
5. **Contract/migration:** neither is required.

### REQUIRED-ORIGIN-01 — browser cannot currently reach local API same-origin

1. **Problem:** current FastAPI has no CORS middleware and Next has no API rewrite.
2. **Violated invariant:** FRLL-01, FRLL-05, FRLL-07, FRLL-08, and FRLL-12 cannot
   run through a real browser boundary as currently launched.
3. **Narrowest correction:** add a test-only same-origin reverse proxy under
   `tests/acceptance/support` and set `/api` as the test API base.
4. **Likely files:** proxy support, Playwright config, and orchestrator only.
5. **Contract/migration:** neither is required. Production ingress/CORS remains a
   separate deployment decision.

### REQUIRED-HARNESS-01 — no executable browser acceptance harness

1. **Problem:** the repository has no Playwright dependency/config, real Auth
   provisioner, PostgreSQL state probe, or cross-process orchestrator.
2. **Violated invariant:** FRLL-01 through FRLL-16 lack one repeatable executable
   owner even though component/integration tests exist.
3. **Narrowest correction:** add the bounded acceptance tooling listed in
   Section 14 and a `test:frll` script.
4. **Likely files:** `tests/acceptance/**`, `scripts/verify-first-real-learning-loop.ps1`,
   `package.json`, and `pnpm-lock.yaml`.
5. **Contract/migration:** neither is required.

### REQUIRED-FIXTURE-01 — existing catalog seeds are broader than the checkpoint

1. **Problem:** current Reader/Dictionary seeds contain many concepts and content
   records; no isolated one-concept acceptance fixture exists.
2. **Violated invariant:** FRLL-03, FRLL-04, and FRLL-16 would depend on broad or
   unknown catalog state.
3. **Narrowest correction:** add the one-concept, fixed-ID, provenance-complete,
   idempotent seed from Section 4 plus its database fixture test.
4. **Likely files:** `database/seeds/first_real_learning_loop.sql` and
   `tests/backend/database/test_first_real_learning_loop_fixture.py`.
5. **Contract/migration:** neither is required; this is static test catalog data.

No REQUIRED domain, OpenAPI, backend algorithm, or persistent-schema gap was
found. If any listed harness correction proves insufficient, implementation must
stop and escalate rather than silently cross those boundaries.

## 17. OPTIONAL observations

- A production same-origin ingress or explicit CORS policy will eventually need
  a deployment decision; the acceptance proxy intentionally does not decide it.
- The orchestrator can retain redacted process logs and database digests as CI
  artifacts for diagnosis, but artifact retention is not required to prove the
  loop.
- A reusable Supabase test-project lease mechanism would improve parallel CI,
  but one serialized disposable environment is adequate now.
- Starting Level may be covered by a later alternate-path test. It is correctly
  optional for this checkpoint.
- Reader and Brain UI are not required. Dictionary is the accepted live discovery
  and Save path; Brain is proved through its API projection.

## 18. Implementation phases

### Phase A — Environment and deterministic fixture

- **Likely files:** catalog seed, fixture test, Playwright dependency/config,
  preflight portion of orchestrator.
- **Tests:** fixture twice on a migrated empty database; provenance/publication
  checks; environment allowlist and secret-redaction tests where practical.
- **Invariants:** FRLL-03, FRLL-04, FRLL-15, FRLL-16.
- **Stop condition:** fixture is idempotent and contains no learner state; missing
  or unsafe environment fails before creating a user.

### Phase B — Real Auth, bootstrap, profile, and Save path

- **Likely files:** Supabase user provisioner, proxy, orchestrator, first E2E
  scenario steps.
- **Tests:** real UI sign-in; subject/bootstrap equality; persisted time zone;
  active `vi -> en` profile; dictionary discovery; explicit Save and repeated
  Save database snapshots.
- **Invariants:** FRLL-01, FRLL-02, FRLL-05, FRLL-06, FRLL-14.
- **Stop condition:** one real actor owns one profile and one unchanged Memory
  lineage; all passive actions are evidence-free.

### Phase C — Memory and Today verification

- **Likely files:** E2E steps and PostgreSQL probe queries only.
- **Tests:** due-at-activation proof; first Today generation after Save; exact
  `today_activity_review_items` mapping and no frontend-created target.
- **Invariants:** FRLL-06, FRLL-07.
- **Stop condition:** the server plan contains the real due review item and no
  Review evidence exists yet.

### Phase D — Review transaction and PostgreSQL evidence

- **Likely files:** E2E steps and probe snapshot/diff logic only.
- **Tests:** explicit `good` answer; one FSRS version change; one Review event;
  one review learning event; one production competence application; stored
  response snapshots matched to HTTP response.
- **Invariants:** FRLL-08, FRLL-09, FRLL-14.
- **Stop condition:** every atomic-result assertion passes without hard-coded
  algorithm outputs or direct table mutation.

### Phase E — Replay and lost-response recovery

- **Likely files:** Playwright route controller and recovery scenario.
- **Tests:** direct exact replay; changed-payload negative case; committed 200
  hidden from browser; reload/re-entry; same receipt retry; queue reconciliation.
- **Invariants:** FRLL-10, FRLL-11.
- **Stop condition:** all post-retry database digests equal the first-commit
  digest and the pending receipt clears only after authoritative success.

### Phase F — Brain projection and actor isolation

- **Likely files:** Brain/assertion and Actor B E2E steps plus probe queries.
- **Tests:** projection equality/no-write; B zero-state read; B not-found answer;
  no cross-actor derived rows.
- **Invariants:** FRLL-12, FRLL-13, FRLL-14.
- **Stop condition:** Brain reflects A exactly, mutates nothing, and B remains
  isolated.

### Phase G — Full checkpoint, cleanup, and repeatability

- **Likely files:** final orchestrator composition and package script.
- **Tests:** two clean sequential runs; cleanup after both success and injected
  failure; full repository quality gates.
- **Invariants:** FRLL-15, FRLL-16 and every earlier invariant.
- **Stop condition:** `pnpm test:frll` passes twice against real Supabase
  PostgreSQL, disposable users are absent afterward, all repository gates pass,
  and protected-area diffs are zero.

Each phase lands only after its stop condition. A failure involving transaction,
actor identity, idempotency, or cross-layer state is diagnosed before proceeding;
tests are not weakened to accommodate it.

## 19. Recommended model allocation

- **Plan freeze and final architecture adjudication:** GPT-5.6 Sol DEEP. Use
  GPT-6 Astra HIGH instead only if Sol performed the primary implementation.
- **Phases A and G routine deterministic tooling:** Gemini 3.8 Flash HIGH.
- **Phases B, C, D, and F straightforward harness integration:** Gemini 3.8
  Flash HIGH, bounded to test/seed/tooling files.
- **Phase E or any hard failure involving transactions, actor races,
  idempotency, replay, lost-response recovery, or cross-layer disagreement:**
  GPT-6 Astra MEDIUM first; raise to HIGH only when evidence shows MEDIUM is
  insufficient.
- **Independent review:** a model different from the primary implementer, with
  standards and plan-compliance reviews separated.

Astra is not recommended for routine fixture, configuration, or documentation
edits.

## 20. Quality gates

### Contract and static gates

```powershell
pnpm contracts:check-generated
python -m pytest tests/backend/contracts/test_openapi_v1.py -q
pnpm backend:format:check
pnpm backend:lint
pnpm backend:typecheck
```

### Database and backend gates

```powershell
python database/migrate.py up
python -m pytest tests/backend/database/test_first_real_learning_loop_fixture.py -q
pnpm backend:test
```

The fixture test and final acceptance checkpoint must use PostgreSQL. SQLite or
an in-memory substitute is not acceptable. Existing broad backend tests may use
the repository's PostgreSQL 17 Docker runner; the FRLL checkpoint itself uses
the dedicated Supabase PostgreSQL selected in Section 3.

### Frontend and build gates

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build-storybook
pnpm build
```

The accepted frontend baseline is 466/466 tests across 35 files. It must not
decrease. The current uncommitted `apps/web/tsconfig.tsbuildinfo` cache is outside
this milestone and must not be staged, restored, or committed.

### New real-loop gate

```powershell
pnpm test:frll
pnpm test:frll
```

Both sequential invocations must pass with new actors, identical catalog fixture
semantics, and successful cleanup. Also verify:

```powershell
git diff 302e132 -- contracts services database/migrations apps/web/src
```

Expected result: zero. The new deterministic file under `database/seeds` is the
only planned database-area addition.

Current planning reconnaissance already observed:

- `pnpm contracts:check-generated`: PASS;
- `python -m pytest tests/backend/contracts/test_openapi_v1.py -q`: 33/33 PASS.

These are planning evidence, not substitutes for the implementation gates.

## 21. Final acceptance checklist

- [ ] Dedicated, allowlisted, non-production Supabase/PostgreSQL environment is
      configured without secret disclosure.
- [ ] Real Auth user A signs in through the browser and reaches FastAPI as the
      same UUID.
- [ ] One persisted active `vi -> en` profile with valid IANA time zone is reused
      through the whole chain.
- [ ] Minimal fixed-ID catalog fixture is provenance-complete and idempotent.
- [ ] No learner-derived state is directly seeded.
- [ ] Dictionary reads and passive UI actions produce zero evidence.
- [ ] Explicit Save/Learn creates one immutable intent, save event, learner
      projection, review item, and FSRS state.
- [ ] Repeated Save does not reset or duplicate lineage or projection.
- [ ] The concept is naturally due without a direct `due_at` update.
- [ ] The first Today plan is generated after Save and targets the exact Review
      item with `FSRS_DUE`.
- [ ] Review Live sends one explicit answer with one stable key and payload.
- [ ] PostgreSQL proves exactly one FSRS transition, Review event, canonical
      review learning event, production competence update, and result snapshot.
- [ ] Same-key/same-payload replay returns equal authoritative `data` and causes
      zero second transition.
- [ ] Committed-but-lost response survives reload/re-entry and retries the same
      receipt before reconciling the queue.
- [ ] Brain returns the same Memory/competence/evidence state and writes nothing.
- [ ] Actor B cannot observe or mutate Actor A learner state.
- [ ] Both clean repeatability runs pass and Auth-user deletion cascades learner
      cleanup without manual derived-state rewriting.
- [ ] Generated contracts, backend checks/tests, frontend tests/typecheck/lint,
      Storybook, production build, and PostgreSQL acceptance gate all pass.
- [ ] No contract, service, migration, or product frontend source diff exists.
- [ ] Independent plan-compliance and code-quality reviews find no Critical or
      Required defect.

Implementation may begin only after REQUIRED-ENV-01 is externally satisfied and
the bounded corrections REQUIRED-ORIGIN-01, REQUIRED-HARNESS-01, and
REQUIRED-FIXTURE-01 are accepted as test infrastructure scope.

## 22. Explicit out of scope (Question H)

- New product features or redesign of existing screens.
- Full Library UI, Progress UI, Brain UI, or Reader live integration.
- Production content/corpus import or reliance on broad seed packs.
- Starting Level as a mandatory gate or a new placement algorithm.
- Today or Review frontend algorithms; frontend FSRS, due, mastery, competence,
  placement, or recommendation calculations.
- Additional schedulers for recognition, listening, or production.
- AI Tutor, speech/pronunciation scoring, forced alignment, Chinese, or Japanese.
- Today activity-completion semantics beyond what Review already proves.
- Production deployment topology, CORS policy, observability, load testing,
  penetration testing, disaster recovery, or generalized multi-tenant audit.
- New endpoint, DTO, error code, enum, schema table/column, or migration.
- Direct seeding, repair, deletion, or rewriting of learner-derived state.
- GAP-02 or any unrelated roadmap task.

## Frozen architecture verdict

The accepted domain and product components are sufficient for one truthful real
learning loop. Save/Learn naturally creates the one due Memory lineage; Today,
Review, competence, replay, and Brain already share PostgreSQL authority. Four
REQUIRED items remain before execution: a real disposable Supabase environment,
a test-only same-origin bridge, an executable browser/probe harness, and a
minimal deterministic catalog seed. None requires OpenAPI, service business
logic, persistent schema, migration, or product frontend changes.

