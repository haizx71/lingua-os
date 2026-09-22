# Core Roadmap Audit after TASK-012

Status: **AUDIT COMPLETE — NO IMPLEMENTATION STARTED**

Date: 2026-08-31

Authority: `MASTER_PROJECT.md`, accepted ADRs, current OpenAPI, migrations `0001..0006`, and the
verified repository runtime

## Executive conclusion

- Core learning-engine capability is approximately **60–65% complete**. Memory, Review,
  Competence, persisted Reader/Content, Today, and Brain are complete, but identity/profile
  bootstrap, assessment, Dictionary, Library, Progress, and production data ingestion are not.
- The complete MVP end-to-end journey is approximately **45% complete**. The returning-learner
  learning loop works for a pre-provisioned learner, but a real new learner cannot bootstrap a
  product profile through the API.
- The current public contract contains **26 paths / 31 operations**. Exactly **12 operations are
  implemented** and **19 have no runtime route**.
- **TASK-014 SHOULD NOT BE NEXT.** Progress has high product value, but it does not unlock entry
  into the product and its contract still contains metrics without an accepted authority.
- TASK-016 should move before TASK-014, but only after the missing Profile/Auth Bootstrap core
  task.
- Frontend readiness is **B — CORE READY FOR PARTIAL FRONTEND INTEGRATION**. The 12 implemented
  operations are stable for an already authenticated, pre-provisioned learner; major MVP
  integration remains blocked by Profile, Starting Level, Dictionary, Library, and Progress.
- Recommended next CODEX task: **TASK-006E — Profile / Language Profile API & Auth Bootstrap v1**.

## 1. Completed core capability map

| Capability | State | Actual authority/runtime |
|---|---|---|
| Supabase JWT verification | PARTIAL | Asymmetric JWKS verification, issuer/audience/role checks and actor UUID mapping exist. Real provider configuration and product-profile bootstrap do not. |
| Learner profile/language profile persistence | PARTIAL | `users`, `learner_profiles`, and `user_languages` exist with RLS and constraints; no Profile route or create/update application service exists. |
| Memory / FSRS-6 | DONE | One primary learner × concept lineage, versioned parameters, due query, atomic transition and exact replay. |
| Review API | DONE | Queue and answer operations are authenticated, cursor-safe, idempotent, and PostgreSQL verified. |
| Evidence / competence | DONE | Append-only canonical evidence and replayable recognition/listening/production projections are authoritative. |
| Content catalog / Reader persisted flow | DONE | Published content list/detail, sentence save, progress and passive exposure are implemented. |
| Reader transient analysis | MISSING | Contract exists; no route, lexical matcher or runtime service exists. |
| Today | DONE | Deterministic persisted plan and evidence-gated completion are implemented. |
| Language Brain | DONE | Summary/list/detail are read-only, bounded and PostgreSQL verified. |
| Dictionary / concept API | MISSING | Catalog tables and a Brain catalog projection exist, but both Dictionary operations lack routes. |
| Library | PARTIAL | All three saved-state tables exist and Reader sentence-save writes one of them. List and six explicit save/remove operations lack runtime. |
| Starting Level Estimate | MISSING | Schema and three OpenAPI operations exist; method policy, item bank, runtime and evidence adapter do not. |
| Progress | MISSING | One OpenAPI operation exists; no accepted metric policy, application service or route exists. |
| Production content/data pipeline | PARTIAL | Provenance/publication enforcement and a deterministic test seed exist; no production ingestion/normalization pipeline or production data pack exists. |

## 2. MVP user-journey gap map

| Journey stage | Classification | Evidence and gap |
|---|---|---|
| New user authentication identity | PARTIAL | Frontend auth foundation and backend JWT verification exist. No sign-in method is approved/configured end to end, and no repository-owned `auth.users -> public.users/learner_profiles` bootstrap exists. |
| Learner language profile | MISSING | Persistence/contract exist, but all five Profile operations are absent. |
| Onboarding | BLOCKED | UI/mock state exists, but target/native language, goal and daily minutes cannot be persisted through runtime. No explicit onboarding-completion authority is contracted. |
| Starting Level Estimate | MISSING | Optional assessment can be skipped, but the mandatory MVP surface has no runtime or item data. |
| Today | DONE for provisioned learners | Safely works without placement by using current level or easiest-first content. Cannot create its own missing profile. |
| Review | DONE | Complete backend path for provisioned learners. |
| Reader | PARTIAL | Catalog reading, save sentence, progress and passive exposure work; transient analyze and lazy Dictionary detail do not. |
| Dictionary | MISSING | No search/detail runtime. Brain detail is learner-anchored presentation and is not a replacement for catalog discovery. |
| Library | PARTIAL | Sentence save works; list, unsave, concept save and content save are absent. |
| Language Brain | DONE | Complete read-only v1 projection. |
| Progress | MISSING | No runtime and several metric definitions remain unresolved. |
| Returning learner | PARTIAL | Today → Review/Reader → evidence → Memory/Competence → Brain → next-day Today works when identity/profile/content are pre-provisioned. Secondary MVP surfaces remain absent. |

## 3. OpenAPI implementation coverage

The current contract, after TASK-008 and TASK-012 amendments, has 26 paths and 31 operations.
Historical TASK-004 records saying 24/29 describe the contract at that earlier checkpoint.

| API group | Implemented | Missing | Classification |
|---|---:|---:|---|
| Profile | 0 | 5 | NOT IMPLEMENTED |
| Today | 2 | 0 | IMPLEMENTED |
| Review | 2 | 0 | IMPLEMENTED |
| Concepts / Dictionary | 0 | 2 | NOT IMPLEMENTED |
| Reader | 3 | 1 | PARTIALLY IMPLEMENTED |
| Content | 2 | 0 | IMPLEMENTED |
| Library | 0 | 7 | NOT IMPLEMENTED; shared Reader sentence-save is implemented separately |
| Assessment | 0 | 3 | NOT IMPLEMENTED |
| Brain | 3 | 0 | IMPLEMENTED |
| Progress | 0 | 1 | NOT IMPLEMENTED |
| **Total** | **12** | **19** | **38.7% operation coverage** |

Implemented operation IDs are `getTodayPlan`, `completeTodayActivity`, `listReviewQueue`,
`answerReviewItem`, `recordReaderExposure`, `updateReaderProgress`, `saveReaderSentence`,
`listRecommendedContent`, `getContent`, `getBrainSummary`, `listBrainConcepts`, and
`getBrainConcept`.

Missing operation IDs are the five Profile operations, `getConcept`, `searchDictionary`,
`analyzeReaderText`, the seven Library operations, the three Starting Level operations, and
`getProgressOverview`. No operation is deferred by contract; AI Tutor and speech have no public
MVP operation and correctly remain post-MVP.

## 4. Database/runtime ownership gap map

The ordered migrations currently create 53 tables.

| Database authority | Runtime state | Gap / risk |
|---|---|---|
| `users`, `learner_profiles`, `user_languages` | Read by existing engines only | No owner for first product-row bootstrap or Profile mutations. `MeProfile.email` is auth-owned and not stored in public schema; its source must be frozen before implementation. |
| concepts/lexemes/forms/senses/framework mappings | Partly read by Content/Brain | No catalog-wide Dictionary search/detail owner; IPA has no persisted lexical authority. |
| `user_saved_*` | Sentence save plus internal Today/Content/Brain reads | No complete Library service. Concept save must not create a second Memory/evidence authority. |
| assessment tables | Dormant | Six persisted structures have no runtime, seed/item bank, confidence-band policy or projection bridge. |
| learning/review/exposure/projection tables | Active | Correctly owned by TASK-006/006D/008; Progress must consume rather than duplicate them. |
| Today tables | Active | Correctly owned by TASK-010. |
| topics/concept topics | Dormant reference data | Not required for current neutral-goal Today policy; future-facing but not harmful. |
| provenance/content tables | Active publication gate, manual fixtures | No importer/job owns acquire → normalize → QA → publish for production data. |

Primary duplicated-authority risks for future tasks:

1. Starting level must define how `assessment_results`, `user_languages.current_level_id`, and the
   public `startingLevelEstimate` relate; none may silently overwrite the others.
2. Progress must not invent a second competence, Memory Health, Reader progress, Today completion,
   or activity-history truth.
3. Library concept saving must coordinate intent/evidence and Memory activation through existing
   authorities rather than directly editing projection or FSRS state.
4. `nativeLanguageCode` currently maps onto a database column named `interface_language_code` in
   `user_languages`; the transport/domain meaning must be made explicit before Profile runtime.

## 5. Starting Level Estimate audit

- Existing schema: `assessment_templates`, `assessment_items`, `assessment_item_concepts`,
  `assessment_attempts`, `assessment_responses`, and `assessment_results` with ownership, RLS,
  method version, confidence and evidence fields.
- Existing contract: start, resume/get, and submit-response operations plus `AssessmentSession`
  and `StartingLevelEstimate` DTOs.
- Persistence readiness: structural only. There are no accepted assessment templates/items in the
  seed and no runtime writes or reads.
- Runtime: absent.
- Onboarding: the assessment invitation is skippable, so it is not required to generate the first
  Today plan. It remains a MUST-ship MVP capability under the master contract.
- Today fallback: safe. Missing estimate uses `current_level_id` when present or Content's
  easiest-first ordering; Today never derives placement.
- Owner: TASK-016.
- Exact remaining work: freeze `starting-estimate-v1` selection/stopping/confidence-band policy;
  curate a provenance-backed item set; implement start/resume/answer/idempotency/concurrency;
  persist one result; define the result-to-profile projection; emit versioned assessment evidence
  through TASK-006D without IRT or certification claims; expose it consistently to Profile, Brain
  and Progress.

TASK-016 should move **before TASK-014**, but after TASK-006E because an assessment requires an
owned language profile and a real onboarding entry point.

## 6. Progress audit

Existing authoritative sources can support much of Progress:

- activity windows: Review events, Reader exposures/progress and Today activity completion;
- skill state: `user_skill_states`;
- concept/status distribution: Brain/TASK-006D projections;
- review history: Review events and the independent Memory lineage;
- reading completion/resume: `user_content_progress`;
- starting estimate: nullable future assessment result.

The current `ProgressOverview` contract is not implementation-ready:

- `memoryHealth` is required non-null although ADR-018 established no authoritative metric and
  Brain correctly returns null;
- `targetLearningDays` has no profile/config authority;
- `minutes`/`totalMinutes` have no frozen source rule because measured duration is optional;
- `conceptsStrengthened`, `successfulLearningDays`, `goalMet`, and successful-review ratio lack
  accepted definitions and bucketing/timezone rules.

TASK-014 is still required, but must begin with a bounded Progress policy/contract freeze. It
should aggregate existing authorities in read-only queries and should not add XP, streak pressure,
or duplicate projection tables without measured need.

## 7. Profile and onboarding audit

The schema can store display name, UI language, timezone, target language, Vietnamese support
language, goal, daily minutes, target/current level and lifecycle. The contract provides ETag-based
profile edits and idempotent language-profile creation.

Missing runtime and decisions:

- all five Profile operations;
- authenticated actor bootstrap into `public.users` and `learner_profiles`;
- authoritative source for required `MeProfile.email`;
- ETag/version derivation and precondition handling;
- idempotent language-profile creation semantics;
- exact mapping of native language versus the ambiguously named database field;
- whether onboarding completion is derived from an active usable language profile or needs a new
  persisted/contracted state.

Existing Today and other services must continue to reject or return not-found for absent profiles;
they must not become bootstrap writers. This gap is the largest remaining CODEX-owned P0 blocker.

## 8. Dictionary audit

- Routes implemented: none of `getConcept` or `searchDictionary`.
- Persistence: concepts, lexemes, forms, senses, framework mapping, relations, sentences/examples,
  provenance and learner overlays exist.
- Ownership: catalog is shared/published; learner overlays must remain actor/profile scoped.
- Pagination: search is contracted as opaque cursor pagination.
- Lexical source: only a small LINGUA-authored test fixture; no production dictionary dataset.
- IPA/pronunciation: optional contract fields exist, but no canonical pronunciation/IPA table or
  production data source is active.

Brain detail already proves reusable bounded catalog composition, but Dictionary must be a
catalog-discovery service and cannot simply expose learner-anchored Brain membership.

## 9. Library audit

- Persistence exists for saved concepts, content and sentences with ownership/RLS.
- `saveReaderSentence` is implemented and writes authoritative catalog sentence membership.
- `listLibraryItems` plus six PUT/DELETE operations are not implemented.
- Content/Brain/Today already consume saved content/concept rows, demonstrating real downstream
  value.
- Search/filter and pagination must follow the existing opaque cursor contract.
- Saved-sentence notes remain NOT_YET_PERSISTED and are not part of this gap.
- Concept save must define whether and how learning intent activates the existing single Review
  lineage and canonical `learning.concept.saved.v1` evidence.

## 10. Content-data readiness

| Data/pipeline need | Internal MVP demo | External user testing | Post-MVP |
|---|---|---|---|
| Current 5-item/14-sentence/30-concept deterministic fixture | Sufficient for automated/demo-state verification only | Insufficient | — |
| Curated production-quality A0–B1 content pack | Desirable | REQUIRED | — |
| English–Vietnamese lexical definitions and examples | Small fixture can demonstrate shape | REQUIRED | Broader coverage continues |
| IPA | Optional for basic demo | REQUIRED for a credible Dictionary subset where available | Accent/locale expansion |
| Provenance/license/attribution data | Gate/runtime DONE | Concrete pinned records REQUIRED | Additional sources |
| Import/normalize/dedupe/QA pipeline | Manual fixture acceptable | REQUIRED at bounded production scale | Richer automation |
| Tatoeba/ipa-dict ingestion | Not needed | Only after concrete pinned license/source review | Wider datasets |
| Wiktionary/Wiktextract, wordfreq, Tatoeba audio, other locales | Not needed | Not approved | POST-MVP or later legal/data review |

The current seed is loaded by tests, not automatically by the migration runner, and includes
`.invalid` fixture media. It must not be represented as production content.

## 11. Auth and end-to-end readiness

Backend readiness:

- Supabase JWT verification is implemented with HTTPS issuer/JWKS, RS256/ES256, audience, role,
  expiry and UUID-subject checks.
- Runtime requires `SUPABASE_URL`, `DATABASE_URL`, a server-only cursor secret, and a real Supabase
  project whose auth schema and database migrations are provisioned.
- No real sign-in method has been selected. That is primarily a product/frontend decision, not a
  reason to add authentication endpoints to FastAPI.
- No auth-user provisioning trigger/service exists in the repository. Tests manually insert
  `auth.users`, `public.users`, learner profile and language profile rows.

Before a real user can authenticate end to end, the project must select/configure a Supabase
sign-in method, configure allowed URLs/provider settings and environment variables, provision the
database, and implement TASK-006E bootstrap/profile behavior. Frontend login UI remains a separate
explicitly authorized Gemini task.

## 12. Remaining task dependency graph

```text
TASK-006E Profile/Auth Bootstrap (READY, next)
  ├─ TASK-016 Starting Level Estimate
  │    └─ TASK-017 Onboarding/Estimate UI
  ├─ real new-user Today/Review/Reader/Brain integration
  ├─ TASK-008A Dictionary + Reader Analyze API
  └─ TASK-008B Library API

existing engines 006A + 006D + 008 + 010 + 012
  └─ TASK-014 Progress policy/API
       └─ TASK-015 Progress UI

TASK-008C Production Content/Lexical Data Pipeline
  └─ external user testing readiness
```

Remaining frontend tasks 007, 009, 011 and 013 have their backend dependencies satisfied but stay
manually blocked/frozen. TASK-015 still depends on TASK-014; TASK-017 depends on TASK-016.

## 13. TASK-014 assessment

**TASK-014 SHOULD NOT BE NEXT.**

- Declared dependency TASK-012 is satisfied.
- Actual sources also include TASK-006A, TASK-006D, TASK-008 and TASK-010; all are DONE and should
  be recorded explicitly.
- It adds a high-value evidence-based Progress surface, but it does not unblock authentication,
  profile creation, onboarding or the first plan.
- Its scope is not superseded by Brain: Brain is current learner state; Progress is bounded
  time-window activity/trend aggregation.
- Its one-line board scope is stale/incomplete because multiple public metrics lack accepted
  definitions and `memoryHealth` conflicts with the nullable-authority conclusion in ADR-018.
- When selected later, its first phase must be domain/read-model/contract freeze before runtime.

## 14. TASK-016 assessment

- Declared dependencies TASK-003/TASK-004 are technically insufficient.
- Actual dependencies include TASK-006E for owned profile/bootstrap and TASK-006D for the accepted
  assessment-evidence boundary.
- TASK-016 remains mandatory because Starting Level Estimate is a MUST-ship MVP surface.
- It is not a hard prerequisite for Today; the existing easiest-first fallback is correct.
- It is a larger new-user/onboarding blocker than Progress and should move earlier than TASK-014,
  but it should not precede TASK-006E.
- No IRT, certification, speaking inference, AI or speech provider belongs in v1.

## 15. Frontend integration readiness

Decision: **B — CORE READY FOR PARTIAL FRONTEND INTEGRATION**.

Safe API groups today for a provisioned authenticated learner:

- Today (2 operations)
- Review (2)
- Content + persisted Reader actions (5)
- Language Brain (3)

Not safe/available for real integration yet:

- Profile/bootstrap and onboarding persistence
- Dictionary and transient Reader analysis
- full Library
- Starting Level Estimate
- Progress
- real production content/data

The frontend remains frozen in this audit. Partial readiness is not authorization to start Gemini
tasks and does not change the 308-test/27-file baseline.

## 16. Remaining work priority

### P0 — blocks the basic MVP journey

1. TASK-006E Profile/Auth Bootstrap runtime and its preflight decisions.
2. Real Supabase environment plus explicit sign-in-method/product decision and later login UI.

### P1 — required for a useful MVP

1. TASK-016 Starting Level Estimate after TASK-006E.
2. TASK-008A Dictionary + Reader Analyze runtime.
3. TASK-008B Library runtime.
4. TASK-014 Progress policy/contract/runtime.
5. Authorized partial frontend real-transport integration after the relevant API group is ready.

### P2 — required before external user testing

1. TASK-008C production content/lexical data pack and bounded ingestion/QA workflow.
2. Staging Supabase configuration, end-to-end auth/onboarding tests, backup/restore, observability,
   security and load verification.
3. Credible English–Vietnamese lexical/examples/IPA coverage for the tested cohort.

### P3 — post-MVP / enhancement

AI Tutor, speech/pronunciation scoring, forced alignment, CJK behavior, graph visualization,
gamification, vector/ML ranking, IRT and social/marketplace features.

## 17. Recommended next CODEX-owned task

**TASK-006E — Profile / Language Profile API & Auth Bootstrap v1**

Owner: CODEX

Dependencies: TASK-001, TASK-003, TASK-004, TASK-006C.2

State: READY, awaiting explicit implementation approval

Recommended bounded scope:

- freeze bootstrap/email/native-language/onboarding-completion/ETag/idempotency semantics;
- implement exactly the five existing Profile operations;
- derive ownership only from verified JWT;
- create or reconcile the actor's product identity/profile safely without making Today/Brain GETs
  implicit writers;
- support the approved English-for-Vietnamese profile, timezone, goal, daily minutes, target level
  and status;
- add ownership, concurrency, replay and real-PostgreSQL tests;
- do not implement login UI, Starting Level algorithms, frontend integration or new preferences.

## 18. Rationale

Every implemented learning engine starts from an owned `user_languages` row, yet no public runtime
can create that row or its parent product profile. Therefore the deepest completed engine work is
currently reachable only through manually seeded state. Completing Progress next would improve a
downstream read surface while leaving the product entrance unusable. TASK-006E is the smallest
vertical slice that converts the current engine set from fixture-reachable to real-user-reachable
and unlocks TASK-016 plus later integration.

## 19. Minimal task-board corrections

Applied corrections:

1. Added TASK-006E as the READY next CODEX core task.
2. Added TASK-008A for Dictionary/Reader Analyze, TASK-008B for Library, and TASK-008C for the
   production content/data pipeline because these MUST-ship areas had no backend owner.
3. Expanded TASK-014's actual dependencies to TASK-006A, TASK-006D, TASK-008, TASK-010 and
   TASK-012, and recorded its required contract-policy preflight.
4. Added TASK-006E and TASK-006D to TASK-016's actual dependency chain; TASK-016 is blocked until
   TASK-006E completes.
5. Kept every frontend task blocked/frozen and did not start any implementation.

No runtime, migration, OpenAPI, generated contract, frontend or test file was changed by this
audit.
