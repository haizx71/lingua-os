# LINGUA OS Knowledge System V2 — Master Technical Specification

**Document Version**: 2.1.0-RECONCILED
**Status**: APPROVED MASTER SPECIFICATION
**Authoritative Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a` (rebased from `72828daeac0f3c4e8a2dafc44d168b2862228e8b`)
**Classification**: `PROPOSAL` (V2 Complete System Specification) / `FACT` (Production Invariant Verification)
**Author**: Lead Architecture & System Design Agent (Gemini)
**Target Repository**: `https://github.com/haizx71/lingua-os`

---

## 1. Executive Summary & Architectural Vision

**LINGUA OS Knowledge System V2** represents the foundational technical specification for enterprise-scale, cognitively grounded adaptive language acquisition. It provides the definitive design for structuring linguistic knowledge, modeling multi-dimensional learner competence, scheduling spaced repetition reviews, collecting learning evidence across surfaces, and deterministically planning daily learning trajectories.

### Core Architectural Axiom
> **Linguistic Knowledge is Universal; Learning is Individual; Planning is Deterministic.**
> Knowledge System V2 establishes an impenetrable boundary between universal canonical truths (vocabulary, grammar, phonology) and private learner cognitive progress (competence, retrievability, FSRS schedules). All pedagogical decisions are 100% deterministic, verifiable, and grounded in relational PostgreSQL bedrock.

---

## 2. Master Specification Document Index

The Knowledge System V2 specification suite consists of 16 deeply integrated, implementation-ready technical documents:

| Document Path | Title & Core Scope | Key Entities & Topics |
| :--- | :--- | :--- |
| [`00-current-state.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/00-current-state.md) | **Current State Audit** | Empirical audit of migrations `0001`–`0013`, live services, contracts, test evidence, and reality map. |
| [`01-architecture-principles.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/01-architecture-principles.md) | **Architecture Principles & Axioms** | 7 core axioms, 6-tier separation of concerns, 7 non-negotiable invariants, core ADRs. |
| [`02-domain-model.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/02-domain-model.md) | **Domain Model & ERDs** | Bounded contexts, ubiquitous language, comprehensive ERDs, SQL table schemas. |
| [`03-canonical-knowledge.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/03-canonical-knowledge.md) | **Canonical Knowledge Catalog** | Polysemy Option A vs B comparison, `concept_senses`, grammar specs, phonetics/IPA, CEFR mappings. |
| [`04-learner-knowledge.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/04-learner-knowledge.md) | **Learner Knowledge & State Machine** | Competence (Beta distributions), py-fsrs 6.3.2 retrievability math, dynamic stagnation resolution. |
| [`05-evidence-model.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/05-evidence-model.md) | **Evidence Ledger & Telemetry** | 9 learning surfaces, Exposure != Learn Intent, append-only ledger, projectors. |
| [`06-knowledge-graph.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/06-knowledge-graph.md) | **Knowledge Graph & Ontology** | 11 edge types, concurrency-safe DAG trigger with advisory locks, recursive CTE queries. |
| [`07-review-integration.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/07-review-integration.md) | **Review & Memory Integration** | py-fsrs 6.3.2 authority, single primary lineage, multi-modal prompts, row-lock updates. |
| [`08-today-engine.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/08-today-engine.md) | **Today Engine Heuristic V2** | Deterministic budget packing, remediation prioritization, activity cards, timezones. |
| [`09-brain-library-dictionary.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/09-brain-library-dictionary.md) | **Brain, Library, & Dictionary** | Brain projections, Library bookmarks with GAP-01 activation, single-lemma Dictionary search. |
| [`10-ai-tutor-context.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/10-ai-tutor-context.md) | **AI Tutor Context Contract** | Post-MVP forward compatibility, privacy-preserving envelopes, provider abstraction. |
| [`11-migration-plan.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/11-migration-plan.md) | **Database Migration Plan** | Additive forward migrations (`0014`–`0016`), honest 4-stage rollback semantics, SQL assertions. |
| [`12-security-and-isolation.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/12-security-and-isolation.md) | **Security, RLS, & Isolation** | Migration 0013 privilege alignment, server-side actor authority, anti-IDOR, account deletion proofs. |
| [`13-test-strategy.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/13-test-strategy.md) | **Test Strategy & Pyramid** | Unit, property-based (Hypothesis), integration, concurrency (DAG locks), security tests. |
| [`14-implementation-waves.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/14-implementation-waves.md) | **Implementation Roadmap** | 10 reviewable execution waves (`K2-01` to `K2-10`), gates, and deliverables. |
| [`MASTER-SPEC.md`](file:///D:/LINGUA_OS_GEMINI_KNOWLEDGE_V2/docs/knowledge-v2/MASTER-SPEC.md) | **Master Specification Synthesis** | Executive overview, cross-cutting invariant map, ADR register, architecture sign-off. |

---

## 3. High-Level System Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                      FRONTEND CLIENT LAYER                                         |
|                 (Today UI  |  Smart Review  |  Reader  |  Language Brain  |  Library)              |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  | HTTPS / REST API (Supabase Auth JWT)
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                    FASTAPI APPLICATION GATEWAY                                     |
|  - Cryptographic JWT Actor Resolution (No client user_id trusted)                                  |
|  - Contract Validation against OpenAPI 3.x, enums.json, errors.json                                 |
|  - Strict Layer Separation: Routes -> Services -> Domain -> Repositories                           |
+----------------------------------------------------------------------------------------------------+
       |                           |                           |                           |
       v                           v                           v                           v
+---------------+           +---------------+           +---------------+           +---------------+
| Today Service |           | Review Engine |           | Competence    |           | Catalog Graph |
| (Deterministic|           | (py-fsrs 6.3.2|           | (Bayesian     |           | (Recursive    |
| Budget Packer)|           | Memory Core)  |           | Beta-Binomial)|           | CTE DAG Query)|
+---------------+           +---------------+           +---------------+           +---------------+
       |                           |                           |                           |
       +---------------------------+-------------+-------------+---------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                   POSTGRESQL RELATIONAL BEDROCK                                    |
+----------------------------------------------------------------------------------------------------+
| CANONICAL KNOWLEDGE (Universal/Immutable)      | LEARNER KNOWLEDGE (Private/Isolated)              |
| - concepts, lexemes, word_senses               | - user_concept_states, user_skill_states          |
| - concept_senses (Option A Polysemy Bridge)    | - review_items (Single Primary Lineage)           |
| - grammar_specifications, phrase_specifications| - fsrs_states (py-fsrs parameters)                |
| - concept_edges (Concurrency DAG Advisory Lock)| - user_saved_concepts, today_plans                |
| - sentences, audio_assets, licenses            | - learning_events, exposure_events (Append-only)  |
|                                                | - v_learner_concept_retrievability (Dynamic View) |
| PRIVILEGES: USAGE & EXECUTE revoked from anon/ | RLS: Strict user_id = auth.uid() isolation        |
| authenticated by default (Migrations 0010-0013)| Functions: SECURITY INVOKER + pinned search_path  |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. Cross-Cutting Invariant Verification Matrix

| Invariant | System Enforcement Mechanism | Verification Query / Test | Failure Mode Prevented |
| :--- | :--- | :--- | :--- |
| **1. Exposure $\ne$ Learn Intent** | Encounters in Reader/Dict only write `exposure_events`. `review_items` created only on explicit save or plan accept. | `SELECT COUNT(*) FROM review_items ri JOIN exposure_events ee ON ee.concept_id = ri.concept_id ...` | Queue saturation with unwanted low-frequency vocabulary. |
| **2. Single Primary Lineage** | Partial Unique Index: `uq_review_items_primary ON review_items(user_id, concept_id) WHERE lineage_type = 'primary'`. | `INSERT INTO review_items (user_id, concept_id, lineage_type) ...` duplicate fails with `unique_violation`. | Fragmented cards and conflicting review schedules for the same concept. |
| **3. Content Provenance & License** | Non-nullable foreign keys: `license_id REFERENCES licenses(id)` on `concepts` and `content_items`. | Preflight migration assertion query checking 0 null licenses. | Copyright infringement and unvetted content ingestion. |
| **4. Deterministic Planning** | Heuristic V2 uses pure SQL/relational mathematics. Zero LLM dependencies in critical path. | Idempotency test: calling `GET /v1/today` 100 times returns identical activity cards. | Flaky schedules, high latency, and unpredictable curriculum drift. |
| **5. Multi-Tenant Isolation & Privilege Lockdown** | Server-side JWT parsing, RLS policies, and Migrations `0010`–`0013` revoking USAGE and EXECUTE from browser roles. | `test_browser_roles_have_no_public_function_execute_privileges` passes. | Unauthorized cross-tenant data leakage or direct browser RPC abuse. |
| **6. Account Deletion Cascade** | `ON DELETE CASCADE` from `users(id)` on all learner tables; 0 foreign keys from canonical tables to `users`. | Delete user in test DB; assert 0 learner rows remaining and 100% canonical concepts intact. | GDPR non-compliance and orphaned user records. |
| **7. Acyclic Prerequisite Graph** | Database trigger `trg_concept_edges_acyclic` backed by transaction advisory lock `pg_advisory_xact_lock`. | Concurrent cycle race test: simultaneous opposing inserts serialize; cycle is blocked with `check_violation`. | Infinite loops during prerequisite resolution under concurrency. |

---

## 5. Architectural Decision Record (ADR) Summary Log

| ADR ID | Decision Summary | Core Justification | Migration Impact |
| :--- | :--- | :--- | :--- |
| **ADR-K2-001** | Polysemy Option A: Shared Lexeme $\to$ Senses $\to$ Concepts via `concept_senses` | Avoids massive morphological duplication in `lexeme_forms`; provides single-lemma dictionary lookups while enabling sense-level mastery. | Additive migration `0015` deploying `concept_senses`. Preserves `lexemes` uniqueness. |
| **ADR-K2-002** | First-Class Grammar Specifications | Dedicated `grammar_specifications` table provides structured formulas and L1 Vietnamese notes to Brain. | Additive migration `0014` deploying table referencing `concept_id`. |
| **ADR-K2-003** | Tripartite Learner State & py-fsrs 6.3.2 Retrievability Alignment | Eliminates FSRS-4.5 formula drift; aligns SQL retrievability view with py-fsrs 6.3.2 ($w_{20}$ decay exponent, integer elapsed days). | Additive view `v_learner_concept_retrievability` in migration `0016`. |
| **ADR-K2-004** | Concurrency-Proven Relational DAG Prerequisite Integrity | Uses `pg_advisory_xact_lock` inside the trigger to serialize DAG edge writes, preventing phantom cycles under `READ COMMITTED`. | Additive trigger in migration `0014`. Set to `search_path = public, pg_temp`. |
| **ADR-K2-005** | Realistic 4-Stage Rollback Semantics | Clarifies schema vs. data vs. pre-cutover vs. post-cutover rollback boundaries, eliminating unverified claims of "exact rollback". | Documented in `11-migration-plan.md`. |
| **ADR-K2-006** | Remediation-First Today Engine Packing | Allocates budget to overdue reviews and decaying `at_risk` items before admitting new curriculum concepts. | Updated algorithm in `lingua_api/today/planner.py`. |
| **ADR-K2-007** | Non-Destructive Library Unsaving | Deleting a saved concept removes the bookmark without destroying months of calibrated FSRS memory state. | Delete on `user_saved_concepts` leaves `review_items` untouched. |
| **ADR-K2-008** | Post-MVP AI Tutor Context Envelope | Formulates a token-budgeted, privacy-preserving context contract without making AI Tutor an MVP blocker. | Pure service interface abstraction; zero MVP runtime dependencies. |
| **ADR-K2-009** | Additive Forward Migration Sequence (0014–0016) | Accommodates authoritative baseline migration `0013` by renumbering V2 migrations to `0014`–`0016`. | Zero conflict with repository migration registry. |
| **ADR-K2-010** | 10-Wave Phased Execution Roadmap | Decomposes V2 delivery into granular, reviewable waves (`K2-01` to `K2-10`) with automated CI verification gates. | Low-risk incremental delivery. |

---

## 6. Architectural Sign-Off and Next Steps

The technical design and architectural specifications for **LINGUA OS Knowledge System V2** are fully reconciled with authoritative master `c2db86387e0879f56817cd748899e80f46b5d79a`, verified against all 13 historical migrations, and ready for immediate implementation.

### Implementation Readiness Checklist
- [x] Authoritative master commit `c2db86387e0879f56817cd748899e80f46b5d79a` audited and integrated.
- [x] Migration collision resolved: V2 migrations renumbered to `0014`–`0016`.
- [x] Security invariant from migration `0013` (`REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`) fully incorporated into all function DDL.
- [x] Polysemy evaluated across 7 dimensions; Option A (Shared Lexeme $\to$ Senses $\to$ Concepts via `concept_senses`) selected.
- [x] Retrievability decay mathematically aligned with py-fsrs 6.3.2 ($w_{20}$ decay, integer elapsed days).
- [x] DAG acyclicity trigger concurrency-proven via transaction advisory serialization locks.
- [x] Rollback semantics formalized into 4 clear stages (schema, data, pre-cutover, post-cutover recovery).
- [x] Zero modifications to production source code (`apps/`, `services/`, `packages/`, `database/`, `migrations/`, `contracts/`).

The engineering team is clear to proceed with **Wave K2-01: Canonical Schema Foundations** upon operational approval.
