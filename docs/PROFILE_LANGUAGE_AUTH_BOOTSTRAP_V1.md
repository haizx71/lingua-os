# Profile / Language Profile / Auth Bootstrap v1

Status: **CONTRACT FROZEN / READY FOR MIGRATION-RUNTIME REVIEW — NO MIGRATION OR RUNTIME**

Task: `TASK-006E`

Date: 2026-09-01

Authority: `MASTER_PROJECT.md`, accepted ADRs, current OpenAPI, migrations `0001..0006`, current
Supabase JWT adapter, and accepted Today/Brain boundaries

## 1. Design outcome

The proposed v1 lifecycle is:

```text
verified Supabase JWT
        ↓
GET /v1/me — the only bootstrap-capable product operation
        ↓
public.users + learner_profiles (no language profile)
        ↓
PATCH /v1/me with a valid IANA timezone
        ↓
POST /v1/me/languages with vi → en, goal, and dailyMinutes
        ↓
active, owned Language Profile
        ↓
onboarding-ready learning loop
        ↓
Today (Starting Level may still be absent)
```

The bootstrap creates only the minimum LINGUA application identity. It does not create a language
profile, choose a goal, guess a study target, run placement, create learner evidence, or generate a
Today plan. No other GET operation acquires bootstrap side effects.

The domain design is approved. This turn freezes the narrow OpenAPI amendment and exact future
persistence shape. Migration `0007` and runtime remain separately gated and are not created here.

## 2. Actual current identity and profile architecture

### 2.1 Supabase Auth Identity

- Supabase owns credentials, sessions, provider identities, password state, refresh tokens, and the
  `auth.users` row.
- FastAPI verifies an asymmetric Supabase access token against the project's HTTPS issuer/JWKS.
- The current verifier requires and validates signature, `iss`, `aud`, `sub`, `exp`, and `role`;
  only RS256 and ES256 are accepted.
- `sub` must be a UUID and `role` must equal `authenticated`.
- The current `AuthenticatedActor` contains only that UUID. The verifier does not currently retain
  an email claim.

### 2.2 LINGUA Application User

- `public.users.id` is both the application-user primary key and a foreign key to `auth.users.id`
  with `ON DELETE CASCADE`.
- It stores only product lifecycle timestamps and `deleted_at`; it duplicates no credential,
  password, provider, session, or token state.
- No trigger, worker, route, or repository service currently creates this row for a real auth user.

### 2.3 Learner Profile

- `learner_profiles` is one-to-one with `public.users` through primary key `user_id`.
- It owns `display_name`, learner-wide `interface_language_code`, `time_zone`, and product
  timestamps.
- Current schema defaults interface language to `vi` and timezone to `Asia/Ho_Chi_Minh`.
- There is no revision, timezone-confirmation state, or onboarding flag.

### 2.4 Language Profile

- `user_languages` is the persisted Language Profile authority.
- It owns target language, goal, current/self-estimated level reference, target level reference,
  `daily_minutes`, lifecycle status, and timestamps. The current schema does not yet have an
  unambiguous native-language authority.
- `UNIQUE (user_id, language_code)` permits structurally multiple target-language profiles but only
  one row per user and target language.
- The target language column is correctly named `language_code`.
- Historical audit does **not** prove that `user_languages.interface_language_code` always meant
  native language. `CODEX_PROJECT_SPEC.md` explicitly names Vietnamese as the interface language,
  the original `user_languages` summary did not declare a native-language field, and migration
  `0001` used the interface-language name. Later Brain code interprets the same column as Vietnamese
  support, but that later usage cannot retroactively erase the distinct UI-locale concept.
- Therefore `0007` must not cosmetically rename this column. It will add a separate
  `native_language_code` authority, preserve the legacy column and values, and move all pair-aware
  runtime reads to the new field. `learner_profiles.interface_language_code` remains the sole
  editable learner-wide UI-locale authority.

### 2.5 Current access boundary

- RLS is enabled on all three application identity/profile tables.
- The authenticated database role has own-row SELECT policies only. It has no INSERT, UPDATE, or
  DELETE policy for these tables.
- Anonymous access is revoked.
- Existing FastAPI services use a server-side PostgreSQL connection and always scope product SQL by
  the verified actor UUID. RLS remains defence in depth rather than the primary application write
  authorization mechanism.
- Current tests manually insert `auth.users`, `public.users`, and usually `user_languages`; several
  fixtures omit `learner_profiles` because no application lifecycle existed yet.

There is no Profile router, Profile application service, Profile store, or runtime implementation
for any of the five contracted operations.

## 3. Identity authority matrix

| Value | Authority | Persistence rule |
|---|---|---|
| Stable actor ID | verified JWT `sub` | `public.users.id` uses the same UUID |
| Issuer/audience/expiry/role | verified JWT claims | validation only; never copied to product tables |
| Email | Supabase Auth, from a verified optional JWT claim | read-only transport value; never persisted in product tables |
| Password/session/provider/refresh state | Supabase Auth | never copied or exposed by Profile API |
| Display name | LINGUA `learner_profiles` | product-owned, nullable, editable |
| Interface language | LINGUA `learner_profiles` | product-owned; `vi` is the only activated MVP UI locale |
| Timezone | LINGUA `learner_profiles` | product-owned, nullable until explicitly supplied, valid IANA name only |
| Native/support language | future `user_languages.native_language_code` | `vi` for the activated MVP pair; never inferred from mutable UI locale at runtime |
| Target language | LINGUA `user_languages` | `en` for the activated MVP pair |
| Goal/daily target/target level | LINGUA `user_languages` | product-owned, client-selected within contract bounds |
| Starting Level Estimate | Assessment result joined through its attempt/profile | never fabricated by Profile and never inferred from self estimate |

The stable UUID, not mutable email, is the identity join key.

## 4. Existing Profile OpenAPI audit

All operations inherit global `supabaseBearer` security. No request accepts `userId`.

| Operation | Current request | Current success | Current errors | ETag/idempotency | Schema/runtime assessment |
|---|---|---|---|---|---|
| `GET /v1/me` / `getMe` | none | 200 `MeResponse`, `ETag`, `Cache-Control: private, no-store` | 401, 403, 422, 500 | strong response ETag | Sole minimal bootstrap; email/timezone are required nullable values. No runtime. |
| `PATCH /v1/me` / `updateMe` | `If-Match`; partial displayName/interfaceLanguageCode/timeZone | 200 `MeResponse`, new `ETag` | 401, 403, 404, 412, 422, 500 | required optimistic concurrency | Missing/malformed/stale If-Match is 412; no runtime revision/IANA service yet. |
| `GET /v1/me/languages` / `listMyLanguageProfiles` | none | 200 bounded `LanguageProfile[]` | 401, 404, 422, 500 | none | Missing bootstrap is 404; native-language authority requires `0007`. No runtime. |
| `POST /v1/me/languages` / `createMyLanguageProfile` | required `Idempotency-Key`; literal en/vi pair, goal/dailyMinutes; optional self/target level | 201 `LanguageProfileResponse`, `ETag` | 401, 404, 409, 422, 500 | required exact idempotency replay | Natural target uniqueness exists; exact key replay/fingerprint storage requires `0007`. No runtime. |
| `PATCH /v1/me/languages/{languageProfileId}` / `updateMyLanguageProfile` | path UUID, `If-Match`; partial goal/dailyMinutes/target level/status | 200 `LanguageProfileResponse`, new `ETag` | 401, 403, 404, 412, 422, 500 | required optimistic concurrency | Fields persist today, but there is no revision or route. |

`MeProfile` embeds at most 20 language profiles and requires the `email` and `timeZone` properties,
both nullable. `LanguageProfile` requires target/native languages, goal, daily minutes, nullable target
level, nullable Starting Level Estimate, status, and timestamps.

## 5. Bootstrap alternatives and decision

### A. Bootstrap on every authenticated application request — rejected

Applying implicit creation to Today, Brain, Reader, Review, or generic auth middleware would make
unrelated reads write product state and distribute lifecycle policy across routers.

### B. Add a new bootstrap endpoint — rejected for v1

A new `POST /v1/bootstrap` could be explicit but is unnecessary because the authoritative contract
already names `GET /v1/me` the learner bootstrap profile operation. It would expand the public API
and generated clients without adding domain value.

### C. Use the existing `GET /v1/me` lifecycle — chosen

`GET /v1/me` is the single approved materialization boundary. Its requested semantic is “return my
LINGUA application profile”; idempotent internal materialization is incidental to satisfying that
read. It remains safe from the client's perspective: repeated calls create no additional resource,
language profile, evidence, plan, or external side effect.

No other operation may call an “ensure user” helper that writes. Other Profile operations require
the bootstrap to exist; other domains continue to be read/write owners only for their own state.

### 5.1 Bootstrap response cache policy

Every successful `GET /v1/me` response carries the exact header:

```http
Cache-Control: private, no-store
```

`no-store` prevents browsers and intermediaries from retaining the authenticated representation;
`private` additionally documents that it is actor-specific. A shared cache must never reuse the
profile or bootstrap result across bearer tokens. `Vary: Authorization` is not required for this
operation because storage itself is forbidden. No cache service or unrelated cache policy is added.

## 6. Bootstrap transaction and concurrent first requests

One database transaction performs:

1. Reconfirm that `auth.users.id = actor.id` exists. A signed but now-stale token for a deleted auth
   identity cannot create product rows.
2. `INSERT public.users(id = actor.id) ... ON CONFLICT (id) DO NOTHING`.
3. Reject a pre-existing tombstoned `public.users` row; bootstrap never resurrects an account.
4. `INSERT learner_profiles(user_id = actor.id, display_name = null,
   interface_language_code = 'vi', time_zone = null, revision = 1) ... ON CONFLICT DO NOTHING`.
5. Read the owned application profile and bounded language profiles, then commit.

The primary keys are the concurrency mechanism. With two simultaneous first requests, one insert
wins and the other waits or observes the committed unique row; both return the same application
identity/profile revision. Only each envelope's `requestId` differs. No duplicate row, guessed
language profile, or partial parent/child state can commit.

If the transaction fails, neither the application user nor learner profile remains partially
created. Retrying the same GET is safe and needs no `Idempotency-Key`.

## 7. Login-method and JWT boundary

TASK-006E does not select email/password, magic link, OAuth, phone, or another Supabase provider.
Any mechanism is compatible if it produces a token accepted by the existing verifier.

Required authorization claims remain:

- valid asymmetric signature from the configured project JWKS;
- exact HTTPS issuer;
- configured authenticated audience;
- unexpired `exp`;
- UUID `sub`;
- learner role `authenticated`.

An email claim is optional, auth-owned presentation data. The Profile response reads it only from
the currently verified access-token claim when that claim is a syntactically valid email string;
otherwise it returns null. The current public schema contains no email column and this phase does
not add one. FastAPI does not query mutable client metadata, persist an email copy, or synchronize
email on requests. A missing email does not invalidate an otherwise valid learner token. Product
display name, locale, timezone, goals, and levels never come from untrusted client identity fields
or mutable Supabase user metadata.

No second JWT implementation, custom token, service-role token in the browser, or frontend-decoded
authorization is introduced.

## 8. Application-user lifecycle

| State | Persisted condition | Allowed next action |
|---|---|---|
| Auth only | valid JWT; no `public.users` | `GET /v1/me` bootstrap |
| Identity bootstrapped | `public.users` + `learner_profiles`; timezone null | `PATCH /v1/me` with IANA timezone |
| Learner profile ready | valid timezone; no language profile | `POST /v1/me/languages` |
| Learning ready | valid timezone + active vi→en Language Profile | Today/Review/Reader/Brain may use that profile |
| Learning paused | supported profile status `paused` | update it back to active or archive it |
| Learning archived | supported profile status `archived` | restore the same row to active; no duplicate create |
| Tombstoned application user | `users.deleted_at` non-null | fail closed; no resurrection in TASK-006E |

Display name is optional. A missing display name never blocks onboarding or Today.

## 9. Language-profile lifecycle

### Create

- Caller identity comes only from the JWT actor.
- The learner profile must already exist and have a valid non-null timezone.
- V1 accepts exactly `targetLanguageCode=en` and `nativeLanguageCode=vi`.
- `goal` is one of the authoritative five LearningGoal values.
- `dailyMinutes` is required and between 5 and 180.
- Optional self-estimated and target level codes must resolve to the seeded CEFR A0–B1 set.
- New row status is `active`.
- Uniqueness is `(user_id, target language)` for the lifetime of the row, not merely a partial
  active-row constraint. Duplicate actor + target language returns 409 even when the existing row
  is paused or archived; creation never replaces or forks it.

### Fetch

`GET /v1/me` embeds all owned profiles and `GET /v1/me/languages` returns the same bounded owned
collection. Stable order is `created_at, id`. There is no single-language GET operation.

### Update

Goal, daily minutes, target level, and status are mutable through the contracted PATCH. Target and
native language are immutable; changing the pair is a different future Language Profile.

Allowed status transitions are active ↔ paused, active → archived, paused → archived, and archived
→ active for restoration. Reapplying the current value is a no-op. No transition deletes learning
history.

### Archive/delete

There is no Language Profile DELETE or reset endpoint in the MVP contract. `archived` removes the
profile from default active resolution while preserving all evidence, Review, Reader, Today, Brain,
and assessment history.

Archive effects are frozen as follows:

| Surface | Archived-profile behavior |
|---|---|
| Today | no new plan generation or completion through the archived profile; persisted plans remain history |
| Review | no active queue resolution or new answers through the archived profile; Review/FSRS history remains |
| Brain | archived profile is excluded from active projection reads; persisted evidence/projections remain |
| Reader/Content | no learner-state mutation through the archived profile; saved/progress/exposure history remains |
| Starting Level | no new or resumed assessment through an archived profile; prior attempts/results remain |
| Progress | future active-profile reads exclude it by default; historical source facts remain available for an explicitly approved historical view |

Reactivation changes the same row back to `active`; it does not copy, reset, or re-key any history.

## 10. One profile versus multiple profiles

The structure is **multiple target-language profiles per user, one row per target language for all
time**. The MVP
activates only one valid pair, Vietnamese native/support language → English target language, so an
MVP user has at most one Language Profile.

There is no separate active/default-profile pointer. Default selection is unambiguous because:

- actor ownership is mandatory;
- target `en` is unique per actor;
- the row must have native/support `vi` and status `active`.

Future language activation may retain one row per target; if multiple simultaneously active target
languages become product behavior, clients already have `languageProfileId` on relevant operations.
No speculative default-profile column is added now.

## 11. Language-pair and level policy

- Architecture remains multilingual-aware through language foreign keys and one-per-target
  uniqueness.
- Runtime v1 rejects every pair other than vi→en with 422 `VALIDATION_ERROR`.
- It does not create CJK behavior or claim those languages are active.
- `selfEstimatedLevelCode` maps to `user_languages.current_level_id` as learner-declared initial
  calibration. It is not an Assessment result and never becomes `StartingLevelEstimate` on the
  wire.
- `targetLevelCode` maps to `target_level_id`; omission means null, not an invented B1 target.
- Invalid, unsupported, or cross-framework codes return 422.

## 12. Timezone authority

`learner_profiles.time_zone` is the sole learner-timezone authority consumed by Today.

V1 rules:

- New bootstrap profiles store null, not the server timezone and not a geographic guess.
- `PATCH /v1/me` is the only v1 mutation for timezone.
- Input must be a trimmed IANA zone name recognized by the runtime timezone database and at most 64
  characters. Raw offsets such as `+07:00` are invalid.
- The server stores the accepted IANA identifier, never derives it from server location or IP.
- A language profile cannot be created until timezone is non-null and valid; that application-state
  precondition fails with HTTP 409 and code `INVALID_STATE_TRANSITION`.
- A timezone update increments the learner-profile revision and parent representation timestamp.
- Existing Today reconciliation already treats the learner profile timezone as authoritative and
  expires/reactivates local-day plans when it changes.

Existing non-null legacy timezone rows are preserved. Invalid legacy strings are never replaced
silently; they must be corrected through the owned profile update before Today becomes usable.

Before timezone readiness, `GET /v1/today` performs no plan write and returns HTTP 409
`INVALID_STATE_TRANSITION`. It never substitutes UTC, server local time, an IP-derived zone, or a
raw device offset. A missing application identity/profile is still 404 `NOT_FOUND`; this separates
“resource has not been bootstrapped” from “owned profile exists but onboarding state is incomplete.”

## 13. Daily-minutes authority

`user_languages.daily_minutes` is authoritative. It is required during language-profile creation,
bounded to 5–180 by both contract and database, and updateable through the existing PATCH.

There is no backend default. The approved UI currently offers 10/20/30/45 minutes, while the API
keeps the broader accepted 5–180 domain range. Today reads the stored value and does not own,
recalculate, or silently replace it.

### 13.1 LearningGoal authority

`LearningGoal` is already an approved public registry with exactly `communication`, `work`,
`travel`, `basics`, and `academic`. It is required by the existing
`CreateLanguageProfileRequest` and persisted once on `user_languages`; this freeze does not make it
required merely because Today might use it. Today v1 remains goal-neutral and neither ranks by goal
nor creates a second goal authority. Language-profile PATCH may change the same stored value.

## 14. Onboarding semantics

Authentication is not onboarding. No boolean `onboarding_complete` column or transport field is
needed in v1.

The backend derives lifecycle predicates rather than one ambiguous stored boolean:

| Predicate | Exact condition |
|---|---|
| identity bootstrapped | live `public.users` row and its owned `learner_profiles` row both exist |
| timezone ready | identity bootstrapped and `learner_profiles.time_zone` is a valid non-null IANA identifier |
| language setup complete | exactly one owned vi→en row exists with valid goal/daily minutes, regardless of active/paused/archive status |
| learning ready | timezone ready and that vi→en row is `active` |

The derived product states are:

| Derived state | Condition | Product meaning |
|---|---|---|
| `PROFILE_SETUP_REQUIRED` | learner timezone is null/invalid | collect and persist IANA timezone |
| `LANGUAGE_SETUP_REQUIRED` | timezone valid; no vi→en profile | collect pair, goal, daily minutes, optional levels |
| `READY` | timezone valid; owned vi→en profile is active | first Today request is valid |
| `INACTIVE` | supported profile exists but is paused/archived | setup exists, but the learning loop is intentionally unavailable |

These are design predicates, not new public enum values. The current wire representation already
contains `timeZone`, `languageProfiles`, and profile status, so clients can determine the next
action without a duplicated persisted flag.

Display name, target level, and Starting Level Estimate are optional and do not block `READY`.

## 15. Starting Level boundary

TASK-016 exclusively owns adaptive selection, responses, stopping, confidence, Assessment results,
and any result-to-profile recalibration policy.

TASK-006E represents only existing facts:

- not started: no in-progress attempt and no result;
- pending: an Assessment attempt is `in_progress`;
- completed: a completed result exists and Profile may project the latest owned result;
- abandoned: an attempt has the existing `abandoned` status;
- skipped: no persisted distinct state in v1.

Skipping or never starting the estimate is allowed. `startingLevelEstimate` remains null, and Today
uses its already-approved current-level/easiest-content fallback. TASK-006E does not add a skip flag,
formal CEFR claim, assessment item, or placement algorithm.

## 16. Exact new-user lifecycle

1. Supabase authenticates by any later-approved login method and issues a valid access token.
2. Client calls `GET /v1/me`.
3. FastAPI validates the token and atomically creates/reconciles the application user plus learner
   profile. Response has no language profile; email and timezone may be null.
4. Client obtains the `/me` ETag and PATCHes the actual IANA timezone, and optionally display name.
5. Client POSTs the vi→en Language Profile with goal, daily minutes, optional self estimate, and
   optional target level, reusing one Idempotency-Key across retries.
6. FastAPI creates one active owned profile and returns its ETag.
7. Onboarding is `READY`. The learner may either start/skip TASK-016 later or request Today now.
8. Today resolves the one active English profile, learner timezone, and daily target. No bootstrap,
   placement, or goal inference occurs inside Today.

## 17. ETag and optimistic concurrency

The future migration adds monotonic `revision bigint` columns to `learner_profiles` and
`user_languages`, beginning at 1.

- `/v1/me` ETag is a quoted strong opaque token derived from resource kind, actor UUID, and the
  learner-profile revision.
- A Language Profile ETag is derived from resource kind, language-profile UUID, and its revision.
- The exact encoding is server-owned; clients compare and echo it but never parse it.
- Every semantic PATCH locks the owned row, validates `If-Match`, applies the mutation, increments
  revision, and sets `updated_at` in one transaction.
- Creating or semantically changing a Language Profile also increments the parent learner-profile
  revision because `/v1/me` embeds the language collection.
- Updating learner-wide fields changes only the learner-profile revision and does not invalidate a
  Language Profile ETag. Updating one Language Profile changes that row's revision plus the parent
  learner-profile revision, but not any unrelated Language Profile revision.
- A no-op PATCH returns the current representation and ETag without incrementing revision.
- The current error registry already defines `PRECONDITION_FAILED` at 412 and has no 428 code. The
  smallest compatible rule is therefore: missing, weak, wildcard, multiple, malformed, or stale
  `If-Match` fails with 412
  `PRECONDITION_FAILED`.
- For an explicit languageProfileId, ownership/existence is checked first; missing and foreign both
  return 404, never a version oracle.

`updated_at` alone is not the concurrency token: the current schema has no automatic touch trigger,
timestamps can be externally preserved, and `/me` is a composite representation.

## 18. Idempotency strategy

| Mutation | Mechanism |
|---|---|
| `GET /v1/me` bootstrap | actor UUID primary keys + one transaction; no header |
| `PATCH /v1/me` | required ETag/If-Match |
| `POST /v1/me/languages` | required Idempotency-Key + persisted actor/key/fingerprint/result snapshot + natural target uniqueness |
| `PATCH /v1/me/languages/{id}` | required ETag/If-Match |

For language creation, the unique storage scope is `(user_id, idempotency_key)`. The canonical
fingerprint contains only the logical command:

- operation discriminator/version `create-language-profile-v1`;
- normalized `targetLanguageCode` and `nativeLanguageCode`;
- `goal` and integer `dailyMinutes`;
- normalized explicit null/value forms of `selfEstimatedLevelCode` and `targetLevelCode`.

The actor is already in the storage scope and is not duplicated inside the fingerprint. The key,
request ID, bearer token, header ordering, JSON property ordering, and other transport-only values
are excluded.

Replay rules:

- same actor/key/fingerprint replays status 201, the original `data` snapshot, and original ETag;
  current request metadata receives a new requestId;
- same actor/key with a different fingerprint returns 409 `IDEMPOTENCY_KEY_REUSED`;
- different key for an already-existing actor/target returns 409 `CONFLICT`;
- concurrent same-key requests use the database unique key. The loser waits for the bounded
  transaction and replays; a lock timeout returns 409 `CONFLICT` and may be retried with the same
  key;
- the persisted exact result is the original HTTP status, complete `LanguageProfile` data object,
  original strong ETag, operation/schema version, and completion timestamp. Envelope `requestId`
  is intentionally regenerated and is not snapshotted;
- replay never rebuilds the creation response from mutable current profile state. Later changes to
  goal, daily minutes, target level, status, timestamps, or revisions do not alter the historical
  creation replay;
- the idempotency result remains for the life of the profile because v1 has no delete operation.

Natural uniqueness alone is insufficient because it cannot distinguish a retry from a distinct
duplicate intent or replay the original response.

## 19. Authorization and resource hiding

- Actor identity is always derived from the verified JWT. No Profile DTO accepts `userId`.
- Every query and mutation includes actor ownership predicates even on a service-role connection.
- `languageProfileId` missing and `languageProfileId` owned by somebody else both return the same
  404 `NOT_FOUND` response.
- The server checks existence/ownership before ETag comparison, preventing a stale-tag oracle.
- 403 is reserved for an authenticated principal whose global application state/role disallows the
  operation, such as a tombstoned application identity; it does not disclose a foreign resource.
- 401 means bearer authentication failed, not that an application profile is missing.
- Validation messages never include raw SQL, auth metadata, or another actor's identifiers.

This matches the accepted Brain resource-hiding rule for explicit profiles.

## 20. Service role and RLS boundary

```text
Browser
  → Supabase Auth session
  → Bearer JWT
  → FastAPI verification and product authorization
  → server-only PostgreSQL/service-role connection
  → public application tables
```

Bootstrap may insert `public.users.id = actor.sub` only after the auth row is confirmed. The foreign
key is a second invariant. FastAPI never accepts a substitute ID from headers or body.

RLS remains enabled. Existing own-row SELECT policies remain, no browser mutation grants are added,
and the future idempotency table receives the same own-row SELECT/anonymous-deny defence. Service
role bypass does not bypass application ownership checks.

## 21. Profile reads and mutation boundary

Only `GET /v1/me` may materialize missing `public.users` and `learner_profiles` rows.

- Repeated `/v1/me` calls are idempotent.
- `GET /v1/me/languages` is read-only.
- Brain, Today, Review, Content, Reader, Progress, and Assessment reads never call bootstrap.
- Synthetic Brain zero-state remains read-only and requires an existing owned Language Profile.
- No read creates a vi→en profile, evidence row, Memory lineage, competence projection, assessment,
  or Today plan except Today's separately accepted plan-generation behavior after setup.

Other Profile operations require an existing application identity. A missing bootstrap is 404 after
the future additive response amendment; clients recover by calling `GET /v1/me`.

The cross-domain gate is exact: for a valid JWT whose `public.users` or `learner_profiles` row is
missing, every product operation other than `GET /v1/me` returns 404 `NOT_FOUND` and performs no
bootstrap write. This includes Profile mutations/listing and Brain, Today, Reader, Dictionary,
Library, Content, Review, Assessment, and Progress. Once identity is bootstrapped but no active
Language Profile exists, each domain retains its already-frozen route behavior (for example, Review
may return its accepted empty queue); `/v1/me` remains the onboarding authority.

## 22. New user with no Language Profile

The authoritative setup response is `GET /v1/me`: 200 with `languageProfiles: []` and possibly null
timezone. The next valid action is timezone PATCH, then language-profile POST.

Downstream routes do not infer or create a profile:

- Today and Brain use their existing not-found behavior when no active owned English profile exists;
  Today uses 409 only for an owned identity/profile whose timezone is present but not ready.
- Content operations that require an active profile use existing not-found behavior.
- Reader mutations reject a supplied non-owned/non-active profile using their current validation
  contract.
- Review queue currently returns an empty collection when no active profile resolves. That is an
  accepted compatibility empty state, not an onboarding signal; clients must use `/v1/me` to decide
  setup. TASK-006E does not widen Review scope.

No fake profile ID, default goal, default daily target, self estimate, or zero-state language profile
is returned.

## 23. Existing data and legacy safety

| Existing state | Proposed behavior |
|---|---|
| auth user + complete app identity/profile | read without bootstrap mutation |
| auth user without app user | `/v1/me` creates application user + learner profile atomically |
| app user without learner profile, auth user valid | `/v1/me` repairs the missing one-to-one child only |
| app user with no language profile | return empty collection; collect timezone then create |
| app user + valid language profile | preserve IDs/history; expose it |
| language profile but missing learner profile | bootstrap the missing learner profile; require timezone before Today if none exists |
| duplicate same-target profiles | impossible under current unique constraint; migration preflight fails if constraint integrity was bypassed |
| unsupported or invalid language pair | preserve for audit, exclude from default MVP resolution, do not rewrite automatically |
| invalid legacy timezone | migration preflight fails; operator/user correction is required before `0007`; no fallback |
| orphan public user without auth identity | do not fabricate auth identity; fail migration/runtime audit |
| tombstoned public user with valid token | fail closed; never resurrect |

The repository has no production data connection in this audit. Test fixtures contain multiple
`public.users + user_languages` combinations without `learner_profiles`, and one fixture uses goal
`general`, which is outside the public LearningGoal registry. Future migration tests must detect and
update those fixtures deliberately.

## 24. Database compatibility and exact future migration

Current schema supports ownership, target uniqueness, daily-minute bounds, status bounds, level
references, and the auth/application UUID join. It does not fully support the frozen lifecycle.

Frozen intended migration `0007_profile_language_auth_bootstrap_v1`:

1. Add `user_languages.native_language_code text` with a language FK. Preflight requires all
   existing activated MVP rows to be the known `interface_language_code='vi'`/target `en` shape,
   backfills those rows to `vi`, then makes the new column `NOT NULL`. Unsupported/ambiguous rows
   fail rather than being guessed.
2. Preserve `user_languages.interface_language_code` and its values; drop its `NOT NULL` requirement
   and mark it as a deprecated legacy profile-local interface/support snapshot. New Profile runtime
   does not read it as native language. `learner_profiles.interface_language_code` remains the only
   editable UI-locale authority. Brain and other pair-aware SQL move to `native_language_code` in
   the separately approved runtime change.
3. Drop the geographic default on `learner_profiles.time_zone` and allow null for pre-onboarding
   identity rows. Preserve valid existing values; fail preflight on invalid non-null IANA values.
4. Add `revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1)` separately to
   `learner_profiles` and `user_languages`.
5. Replace the broad nonblank `user_languages.goal` check with the exact approved five-value
   LearningGoal registry check. Existing non-registry rows fail preflight and are not silently
   mapped.
6. Add actor-owned `profile_mutation_results` solely for `create-language-profile-v1`, keyed by
   `(user_id, idempotency_key)`, with operation type/version, SHA-256 request fingerprint,
   language-profile ID, HTTP status fixed to 201, exact JSON result-data snapshot, original strong
   ETag, completed/created timestamps, and an owned composite resource FK using `ON DELETE RESTRICT`.
7. Enable RLS on the new table, add authenticated own-row SELECT defence, grant no browser writes,
   and revoke anonymous access. Service-role SQL must still bind both actor and key.
8. Add migration preflight assertions for invalid timezones, invalid goals, ambiguous/unsupported
   pairs, duplicate target rows, orphan ownership, and legacy rows that cannot be backfilled safely.
   Do not guess production corrections.

Persistence responsibility map:

| Field/table | Authority | Current support | `0007` change | Uniqueness/ownership/RLS | Rollback risk |
|---|---|---|---|---|---|
| `users.id` | verified JWT `sub` + `auth.users.id` FK | complete | none | actor PK; existing own SELECT | bootstrap rows become parents of history; runtime phase must not cascade-delete |
| `learner_profiles.interface_language_code` | UI locale | complete | none | one per actor; existing own SELECT | none |
| `learner_profiles.time_zone` | learner timezone | wrong default/non-null | nullable, no default; runtime IANA validation | one per actor; existing own SELECT | down migration cannot invent a timezone for null rows |
| `learner_profiles.revision` | composite `/me` version | absent | monotonic bigint from 1 | one per actor | down loses concurrency lineage once writes exist |
| `user_languages.native_language_code` | Language Profile native/support language | absent/ambiguous legacy column | new FK, validated vi backfill, NOT NULL | lifetime unique target remains `(user_id, language_code)` | down loses pair authority after Profile rows use it |
| `user_languages.interface_language_code` | deprecated legacy profile-local interface/support snapshot | present | preserve, nullable, no new authority | still actor-owned through row; no new index | retained specifically to avoid destructive semantic rewrite |
| `user_languages.daily_minutes` | daily target consumed by Today | complete | none | existing 5..180 check | none |
| `user_languages.goal` | approved learner goal | broad nonblank only | exact five-value check | existing owned row | down would weaken validation only; invalid legacy data blocks up |
| `user_languages.revision` | individual Language Profile version | absent | monotonic bigint from 1 | per row; existing own SELECT | down loses concurrency lineage once writes exist |
| `profile_mutation_results` | exact create replay | absent | new narrow append-only result table | PK `(user_id,key)`; owned FK/RLS; no client writes | down must refuse after results exist to avoid replay loss |

`reader_mutation_results` is not reused: it is intentionally Reader-owned, constrains operation
types to Reader commands, and has Reader-specific lifecycle/rollback rules. A Profile-specific
table is the smallest safe boundary and is not a generic mutation dumping ground.

No onboarding boolean, active/default pointer, email column, auth metadata, password/session table,
profile JSON blob, or cascade-delete workflow is proposed.

## 25. OpenAPI compatibility and exact future amendment

Decision: **B — CONTRACT AMENDMENT APPLIED; GENERATED FRONTEND COMPATIBILITY PASSED**.

Smallest amendment:

1. Keep `email` required as a property but change its value to `string | null`; it is nullable when
   the verified Supabase identity has no email.
2. Keep `timeZone` required as a property but change its value to `string | null`; null means
   learner setup must collect an IANA timezone.
3. Clarify `GET /v1/me` as the only idempotent application-user/learner-profile bootstrap boundary,
   state that it creates no Language Profile, and require `Cache-Control: private, no-store`.
4. Clarify POST language prerequisites, exact vi→en activation, duplicate behavior, and
   Idempotency-Key replay/reuse semantics.
5. Clarify Profile PATCH ETags as strong revision-backed tokens and explicit profile ownership as
   existence-hiding 404.
6. Add additive 403 to `GET /v1/me` for a non-resurrectable/tombstoned application identity.
7. Add additive 404 responses wherever an operation currently lacks one but requires an existing
   application identity. Missing and foreign explicit resources remain indistinguishable.
8. Add Today's explicit 409 `INVALID_STATE_TRANSITION` response for an owned profile that is not
   timezone-ready; missing application/profile state remains 404.

No new path, operationId, onboarding enum/field, active-profile field, auth endpoint, login field,
preference field, Starting Level state, or userId is added.

Generated TypeScript makes `MeProfile.email` and `MeProfile.timeZone` nullable and narrows creation
to literal `en`/`vi`. Generation and freshness pass. The approved compatibility patch makes
`UserProfileViewModel.name`, `email`, and `timeZone` nullable, maps display name/email/timezone
directly without cross-field or empty-string defaults, and uses `Chưa cung cấp` only when rendering
an absent Profile heading. Typecheck and the complete frontend gates pass without weakening the
contract.

## 26. Profile deletion and reset

The MVP contract has no profile DELETE/reset operation. TASK-006E does not expose one.

- Archiving a Language Profile preserves every dependent row.
- It does not cascade-delete events, Review/FSRS, competence, Reader progress, Today plans, Brain
  anchors, Library state, or Assessment history.
- `users.deleted_at` is not activated as an account-deletion workflow here.
- Account export/deletion remains a separate asynchronous privacy feature requiring retention,
  audit, recovery, and multi-table policy.

## 27. Frontend contract boundary

The compatibility patch changes only the shared Profile view model/adapter, two deterministic
Profile fixtures/tests, and one presentation-only null label in `ProfileView`. It does not change
layout, styling, auth behavior, transport, `packages/ui`, GSAP, or the design system. The verified
frontend baseline is now 313 tests / 27 files.

Current frontend auth correctly separates Supabase session identity from LINGUA learner state and
provides a bearer-token abstraction. It still deliberately leaves the login method unresolved.

The future contract correction will require a bounded generated-type/mock/adapter compatibility
pass for nullable email/timezone and the bootstrap empty state. Backend lifecycle semantics outrank
the existing complete-profile mock.

## 28. Contract and future persistence test plans

Contract-freeze tests must prove:

- `MeProfile.email` and `timeZone` are required properties whose values are nullable;
- `/v1/me` documents sole bootstrap ownership, minimal created state, idempotence, transaction/race
  safety, and `Cache-Control: private, no-store`;
- no additional bootstrap path or operation exists;
- create requires exactly the existing body fields, required Idempotency-Key, vi→en validation,
  goal registry, and `dailyMinutes` bounds 5..180;
- Profile PATCH operations require `If-Match`, document 412 for missing/malformed/stale values, and
  return strong ETags after success;
- missing application state and missing/foreign explicit resources use 404 without a client
  `userId`, password, session, provider, or token field;
- Starting Level is nullable and absent from the readiness predicate;
- the generated TypeScript declaration is fresh.

Migration/runtime tests after separate approval must cover:

- empty `0001..0007` apply, unchanged reapply, protected down/up, checksum rejection, valid legacy
  preservation, and preflight failure for ambiguous pairs/goals/timezones/orphans;
- first and concurrent bootstrap, exact actor identity, one transaction, and proof that no Language
  Profile/evidence/assessment/Today/Library/Reader row is auto-created;
- null initial timezone, valid update, invalid/offset zone rejection, and Today before/after
  readiness with no fallback;
- vi→en create, lifetime duplicate behavior, archive/reactivate of the same ID, exact replay after
  later mutations, same-key/different-command rejection, and concurrent same-key convergence;
- missing/malformed/stale If-Match, two concurrent updates, per-resource revision isolation, parent
  `/me` revision changes for nested Language Profile mutations, and ownership-before-ETag checks;
- own/foreign/missing actor scoping through service-role SQL, RLS own-read isolation, anonymous/direct
  write denial, and identical explicit missing/foreign 404 behavior.

### 28.1 Future implementation test matrix

| ID | Required proof |
|---|---|
| A | valid JWT + existing application user returns owned Me profile without insert |
| B | valid JWT + first `/me` atomically bootstraps application user and learner profile |
| C | two concurrent first `/me` calls create one pair of rows and return one revision |
| D | missing/invalid signature, issuer, audience, role, or subject returns 401/403 per contract |
| E | expired JWT returns 401 and creates no rows |
| F | bootstrap creates no Language Profile, evidence, Memory, competence, assessment, or Today row |
| G | valid timezone + vi→en create persists exact goal/daily/level inputs |
| H | duplicate actor+target returns 409; same key/same payload replays original 201 |
| I | target/native pairs other than en/vi return 422 with no writes |
| J | owned Profile and Language Profile reads return only actor state |
| K | missing and foreign explicit languageProfileId return identical 404 envelopes |
| L | IANA timezone accepted; raw offsets, unknown, blank, overlong values rejected |
| M | dailyMinutes 5 and 180 accepted; 4 and 181 rejected at HTTP and DB boundaries |
| N | GET returns strong ETag and matching If-Match update increments revision |
| O | missing/malformed/stale If-Match returns 412; foreign resource remains 404 |
| P | create key payload mismatch returns IDEMPOTENCY_KEY_REUSED; bounded race is safe |
| Q | null timezone/no profile yields setup-required state and no downstream bootstrap |
| R | valid timezone + active vi→en profile yields onboarding-ready state |
| S | no Starting Level result remains valid and Today fallback remains usable |
| T | Today/Brain/Review/Reader ownership resolution works with created profile and no duplicate authority |
| U | RLS own read succeeds, other/anonymous read fails, and direct browser mutation remains denied |
| V | real PostgreSQL covers bootstrap, language-create, ETag, idempotency, rollback, and concurrency |
| W | all five FastAPI operations match amended OpenAPI responses, headers, DTOs, and errors |
| X | generated freshness and frozen frontend regression remain at least 308/308 across 27 files |

Additional migration tests must cover empty `0001..0007`, reapply, down/up, checksum rejection,
legacy valid-row preservation, preflight rejection, and no accidental history cascade.

## 29. Worked user journeys

### 29.1 Brand-new Supabase user

```text
valid JWT(sub=A, email optional)
→ GET /v1/me
→ create public.users(A) + learner_profiles(A, timezone=null)
→ 200 MeResponse, languageProfiles=[]
→ PATCH /v1/me If-Match with Asia/Ho_Chi_Minh
→ POST /v1/me/languages vi→en + goal + dailyMinutes
→ 201 active Language Profile
→ GET /v1/today is valid
```

### 29.2 Returning user with complete profile

```text
valid JWT(sub=A)
→ GET /v1/me
→ no bootstrap mutation
→ 200 existing profile + active language profile + current ETag
→ Today/Review/Reader/Brain may continue
```

### 29.3 Authenticated user without Language Profile

```text
valid JWT(sub=A)
→ GET /v1/me
→ 200 with empty languageProfiles
→ next action is timezone PATCH if needed, then language-profile POST
→ no downstream route invents a profile
```

### 29.4 Two simultaneous first requests

```text
JWT A → GET /v1/me ┐
                   ├→ PK/transaction serialization → one users row + one learner_profiles row
JWT A → GET /v1/me ┘
→ both 200 with same resource revision; different requestId only
```

### 29.5 Stale profile update

```text
GET /v1/me → ETag "M1"
another accepted update → revision M2
PATCH /v1/me If-Match "M1"
→ 412 PRECONDITION_FAILED; no overwrite
```

### 29.6 Access another user's Language Profile

```text
JWT A + PATCH /v1/me/languages/{B-profile}
→ actor-scoped lookup finds nothing
→ 404 NOT_FOUND before ETag comparison
```

### 29.7 Change timezone

```text
JWT A + current Me ETag
→ PATCH /v1/me {timeZone: "Europe/Paris"}
→ validate IANA, update revision/timestamp
→ 200 with new ETag
→ existing Today timezone reconciliation governs local-day plans
```

### 29.8 Starting Level not completed

```text
JWT A + valid timezone + active vi→en profile + no assessment result
→ LanguageProfile.startingLevelEstimate = null
→ onboarding remains READY
→ Today uses self-estimated current level when present, otherwise easiest-first fallback
```

## 30. Security failure review

| Threat | Control |
|---|---|
| IDOR/profile enumeration | actor-scoped SQL; missing and foreign explicit IDs both 404 |
| Client-supplied identity | no userId field/header; actor always verified JWT subject |
| Duplicate users/profiles in races | actor PKs, actor+target unique constraint, transaction, persisted idempotency key |
| Stale overwrite | monotonic revision, strong ETag, row lock, required If-Match |
| Auth/application privilege confusion | exact UUID boundary; auth owns credentials, product owns learning state |
| Service-role bypass | server-only secret plus mandatory product actor predicates and tests |
| Bootstrap from deleted/stale auth token | confirm auth row; FK; fail closed; no resurrection |
| Email coupling | optional verified claim only; never identity key or required login mechanism |
| Profile enumeration through ETag | ownership checked before version comparison |
| Timezone poisoning | runtime IANA validation, no offsets/server default, length bound, Today fail closed |
| Idempotency-key payload swap | canonical request fingerprint and 409 IDEMPOTENCY_KEY_REUSED |
| Cascading history loss | no delete/reset endpoint; archive only; account deletion deferred |

## 31. Acceptance criteria for future runtime

TASK-006E implementation is acceptable only when:

1. the contract and migration described above are separately approved and implemented first;
2. exactly five Profile operations become executable, with no new endpoint;
3. `/v1/me` is the only bootstrap-capable operation;
4. bootstrap is minimal, idempotent, concurrent-safe, and transaction-safe;
5. no Language Profile is auto-created;
6. nullable email does not select a login method or persist auth data;
7. timezone and language-pair rules fail closed;
8. ETag and create idempotency semantics are proven on real PostgreSQL;
9. foreign profiles are hidden and direct browser writes remain denied;
10. Starting Level, Today, Memory, competence, frontend behavior, AI, speech, and CJK boundaries are
    preserved;
11. OpenAPI/generated/frontend and all backend/database gates pass;
12. TASKS/STATUS are marked DONE only after verification and reviews.

## 32. Remaining blockers and approval questions

The domain, HTTP, security, future persistence semantics, and frontend compatibility boundary are
frozen. No compatibility blocker remains. Migration/runtime still requires separate explicit
approval and has not started.

Separate product/deployment work still remains:

- select and configure a real frontend Supabase login method later;
- provide real Supabase/database environment values and apply migrations;
- implement migration/runtime only after a separate approval, preserving the 313-test/27-file
  frontend baseline;
- reconcile legacy invalid/missing fixture rows during implementation;
- keep account deletion/export and persisted skip history outside TASK-006E;
- begin TASK-016 only after TASK-006E is verified DONE.

This phase changes OpenAPI, generated declarations, contract tests, design/ADR/task tracking only.
No migration, runtime, frontend application/mock/adapter, UI, GSAP, or design-system file changes.
