# Profile / Language Profile / Auth Bootstrap v1 — Implementation

Status: verified implementation of `TASK-006E`  
Implemented: 2026-09-02  
Design authority: `docs/PROFILE_LANGUAGE_AUTH_BOOTSTRAP_V1.md`, ADR-019, and the frozen OpenAPI contract

## Runtime boundary

The runtime exposes exactly the five frozen Profile operations:

- `GET /v1/me`
- `PATCH /v1/me`
- `GET /v1/me/languages`
- `POST /v1/me/languages`
- `PATCH /v1/me/languages/{languageProfileId}`

The implementation is separated into Profile domain rules, strict transport DTOs, an actor-scoped
PostgreSQL store, an application service, and FastAPI routes. No login UI, Starting Level
algorithm, frontend integration, preference API, account workflow, or additional endpoint was
added.

## Identity bootstrap and JWT boundary

`GET /v1/me` is the sole application bootstrap boundary. The existing Supabase JWT verifier
validates the asymmetric signature, issuer, audience, expiry, UUID subject, and authenticated role.
It also carries a syntactically valid email claim into the request-scoped `AuthenticatedActor` when
present. Email is never inserted into `public.users`, `learner_profiles`, or another product table,
and it is never used for ownership or display-name derivation.

After verifying that `auth.users` still owns the subject, bootstrap atomically inserts the
`public.users` and `learner_profiles` rows with `ON CONFLICT DO NOTHING`, locks the application-user
lifecycle row, rejects tombstoned identities, and returns the canonical projection. The initial
learner profile has nullable `display_name`, nullable `time_zone`, Vietnamese interface language,
and revision 1. Bootstrap creates no language profile, assessment, evidence, competence, Review,
FSRS, Reader, Library, or Today state. PostgreSQL uniqueness and transaction semantics make first
bootstrap race-safe across workers; no Python lock exists.

Brain, Today, Review, and Content reads perform read-only application-identity resolution and
return hidden-resource 404 behavior when the application identity is absent. They never invoke the
bootstrap path.

All successful `GET /v1/me` responses set `Cache-Control: private, no-store` and a strong opaque
ETag so an authenticated representation cannot be stored or reused across actors.

## Timezone and readiness lifecycle

`learner_profiles.time_zone` is the only persisted timezone authority. Bootstrap leaves it `NULL`.
Updates accept only bounded, trimmed IANA identifiers recognized by `zoneinfo`; raw offsets,
unrecognized zones, and server/device fallbacks are rejected. Today fails closed with
`409 INVALID_STATE_TRANSITION` while timezone is absent and writes no Today plan.

Learning readiness is derived rather than persisted. It requires an existing application identity,
a valid authoritative timezone, and an active vi-to-en language profile whose `daily_minutes` is in
the approved range. Starting Level is not a readiness prerequisite.

## Language-profile authority and lifecycle

`learner_profiles` remains learner-global authority. `user_languages` remains the language-learning
context and sole authority for `daily_minutes`, goal, target level, lifecycle status, and the
native/target pair. The active MVP pair is exactly native Vietnamese to target English.

Migration 0007 adds `user_languages.native_language_code` as a separate authoritative column.
The legacy nullable `interface_language_code` is retained as a deprecated profile-local interface
snapshot and is not used as native-language truth. Brain pair resolution now reads
`native_language_code`.

The existing `(user_id, language_code)` uniqueness preserves one lifetime row per learner and
target language. Create rejects an existing active, paused, or archived English lifecycle row.
Archive and reactivate update the same ID and retain every dependent history row. Starting-level
responses only project an already completed, contract-valid assessment; this task introduces no
placement calculation.

## Revisions, ETags, and concurrency

Migration 0007 adds positive bigint revisions to `learner_profiles` and `user_languages`. ETags are
strong opaque SHA-256 validators derived from resource kind, stable ID, and revision; timestamps are
not concurrency tokens.

Both PATCH operations require exactly one current strong `If-Match`. Missing, malformed, weak,
wildcard, multiple, and stale validators produce `412 PRECONDITION_FAILED`. Ownership/existence is
resolved before comparison, so missing and foreign language profiles produce the same 404 without
revealing a validator. Row locks serialize concurrent mutations. A semantic no-op preserves the
revision and ETag. A committed language mutation increments its own revision and the parent learner
revision because `/v1/me` embeds language profiles; a learner-only mutation does not invalidate the
independent child ETag.

## Exact create replay

`profile_mutation_results` is a narrowly scoped immutable replay authority for language-profile
creation. Its primary key is `(user_id, idempotency_key)`, and its composite foreign key binds the
snapshot to an actor-owned language profile. It stores the canonical logical-command fingerprint,
exact creation data snapshot, original ETag, original 201 status, schema/operation identity, and UTC
timestamps.

An actor/key-scoped PostgreSQL advisory transaction lock serializes competing requests. Same key and
same normalized command returns the original 201 data and ETag even after later profile mutations,
while transport metadata receives a fresh request ID. Same key and a different command returns
`IDEMPOTENCY_KEY_REUSED`. Independent keys still converge through the locked learner row and the
lifetime database uniqueness constraint, preventing duplicate profiles without a check/insert race.

## Migration 0007 and legacy data

The up migration:

- fails closed on orphan application users, invalid legacy IANA timezones, ambiguous legacy
  language pairs, unapproved goals, or duplicate learner/target rows;
- removes the learner timezone default and allows `NULL` while preserving valid values;
- adds positive learner and language revisions;
- adds `native_language_code`, backfilling only the demonstrably known legacy MVP shape where
  `language_code = 'en'` and `interface_language_code = 'vi'`;
- keeps `interface_language_code` separately and makes it nullable;
- constrains goals to `communication`, `work`, `travel`, `basics`, and `academic`; and
- creates the append-only Profile create replay table and RLS policy.

The protected down migration refuses rollback if replay history exists, either revision moved from
1, a learner timezone is null, or native-language data cannot safely collapse into the legacy
interface snapshot. Empty/unused compatible schema can roll down and back up reproducibly.

## Authorization and RLS

Every SQL access derives ownership from the verified actor and uses parameterized statements.
Client bodies contain no ownership authority. Missing and foreign language resources are
indistinguishable 404s. The browser remains outside product-write authority:

`Browser -> FastAPI -> PostgreSQL/Supabase`

`profile_mutation_results` enables only authenticated own-row SELECT as defense in depth, revokes
browser writes, denies anonymous access, and is append-only even for privileged accidental UPDATE
or DELETE attempts. FastAPI/service-role writes remain actor-scoped in application SQL.

## Verification evidence

- Ruff format: 76 files formatted.
- Ruff lint: pass.
- strict mypy: 76 source files, no issues.
- non-database backend: 133 passed.
- Profile/Auth focused suite before final matrix expansion: 61 passed; final Profile API: 32 passed.
- PostgreSQL 17.11 database suite: 188 passed.
- full backend suite: 321 passed.
- migration workflow: empty 0001..0007 apply, no-op reapply, 0007 down/up, checksum rejection, safe
  legacy backfill/preflight, and protected rollback pass in the database suite.
- OpenAPI Spec Validator 0.9.0: pass.
- frozen contract tests: 26 passed.
- generated TypeScript freshness: pass with openapi-typescript 7.9.1.
- Redocly CLI 2.13.0: exit 0 with the unchanged Reader discriminator warning.
- frontend: typecheck, zero-warning ESLint, 313/313 Vitest tests across 27 files, Storybook build,
  and Next.js production build pass.

The frozen OpenAPI document, generated TypeScript contract, and frontend application behavior were
not changed by the runtime implementation.
