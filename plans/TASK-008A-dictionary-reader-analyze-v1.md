# TASK-008A — Dictionary and Reader Analyze API v1

Current phase: **IMPLEMENTATION AUTHORIZED**

Implementation date: 2026-09-02

## Objective

Implement the three already-frozen operations `getConcept`, `searchDictionary`, and
`analyzeReaderText` over approved PostgreSQL catalog data and actor-owned learner projections.
Dictionary and Analyze remain read-only; Analyze uses the approved
`reader-analyze-leftmost-longest-exact-v1` policy and never creates evidence or catalog data.

## Locked boundaries

- OpenAPI, shared enums, error registry, generated TypeScript, and frontend application behavior
  remain unchanged.
- Dictionary composes approved canonical data with the existing learner projection; it does not
  recompute competence, mastery, ConceptStatus, FSRS, or Today priority.
- Analyze performs exact catalog matching only, preserves original UTF-16 offsets, and persists
  neither submitted text nor learner state.
- MVP activation is Vietnamese learner to English target; no external dictionary, NLP provider,
  fuzzy/vector search, Library behavior, or concept fabrication is added.
- Existing provenance/license/review gates are reused. POS stays optional and no fallback label is
  invented.
- Migration `0009` is added only if measured PostgreSQL plans prove the current indexes inadequate.

## Approved Analyze policy

`reader-analyze-leftmost-longest-exact-v1` scans Unicode-aware token boundaries from left to right.
At the earliest eligible start it selects the longest normalized exact catalog form; equal spans
use normalized form then concept UUID ascending. Selected spans are non-overlapping and non-nested.
Matching cannot cross a sentence boundary or occur inside a larger token. Normalization is NFKC,
casefolding, and whitespace collapsing for matching only, with an exact mapping back to the
original source text and UTF-16 code-unit offsets.

## Implementation sequence

1. **Pure Analyze policy — RED/GREEN**
   - Add golden tests for leftmost-longest selection, tie-breaking, repetition, punctuation,
     Unicode/token boundaries, unknown input, sentence boundaries, and UTF-16 offsets.
   - Implement bounded normalization, sentence splitting, source-span mapping, and selection as a
     transport/database-independent policy.
2. **Dictionary read model — RED/GREEN**
   - Add PostgreSQL API tests for approved detail/search, optional POS, grammar/skill, no match,
     deterministic ordering, signed keyset pagination, malformed/cross-scope cursors, active owned
     profile overlays, and publication/provenance exclusion.
   - Implement domain projections, strict DTOs, signed cursor, actor-scoped store, service, and
     thin routes for the two frozen Dictionary operations.
3. **Transient Reader Analyze — RED/GREEN**
   - Add PostgreSQL API tests for batched exact candidate loading, overlay status, deterministic
     annotations, request bounds, unsupported language behavior, and unmatched input.
   - Extend Reader with a read-only analysis store/service/route using one catalog candidate query
     and one owned overlay query per request, independent of token count.
4. **Isolation and performance proof**
   - Assert before/after counts across evidence, competence, FSRS, Review, Library, Reader progress,
     Today, content, sentence, and concept tables.
   - Inspect PostgreSQL query plans for Dictionary ordering/filtering and Analyze form lookup;
     create no migration if existing structures are adequate.
5. **Integration and verification**
   - Register applications, routes, and standard error mappings in `main.py`.
   - Run focused tests after every slice, then Ruff format/lint, strict mypy, non-database backend,
     full database, full backend, OpenAPI validation, Redocly, contract tests, enum checks,
     generated-TypeScript freshness, frontend typecheck/lint/Vitest/Storybook/production build.
6. **Review and tracking**
   - Perform specification, architecture, security, query, side-effect, and boundary reviews;
     classify findings as Critical/Required/Recommended and resolve all blockers.
   - Record the approved matching policy in `DECISIONS.md`, implementation evidence in
     `docs/DICTIONARY_READER_ANALYZE_IMPLEMENTATION_V1.md` and
     `reviews/TASK-008A-dictionary-reader-analyze-v1.md`, then update `TASKS.md` and `STATUS.md`
     only after all gates pass.

## Acceptance checks

- Exactly the three frozen operations have authenticated runtime handlers and standard envelopes.
- Only approved, allowed-license, attributable catalog dependencies are exposed.
- Search is deterministic, bounded, keyset-paginated, opaque, tamper-resistant, and cursor-scoped.
- Analyze follows every approved golden case with exact original UTF-16 spans and no overlaps.
- Unknown text creates no concept and all Dictionary/Analyze calls are side-effect free.
- Learner overlays are actor/profile-scoped and consume persisted projection authorities only.
- Query count is bounded rather than proportional to token count; SQL remains parameterized.
- Real PostgreSQL 17.x, full backend/database/contract, and frozen frontend baseline gates pass.

## Known risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Unicode normalization changes length | Build normalized-to-original boundary maps and test combining characters and surrogate pairs. |
| Catalog aliases produce equal spans | Apply the approved normalized-form/UUID tie-break explicitly. |
| Unapproved dependency leaks through detail | Apply the same fail-closed source predicate to concepts, lexemes, senses, examples, and relations. |
| Search cursor replayed with another filter/actor | Sign actor, profile, language, normalized query, ordering key, and concept ID. |
| Analyze becomes N+1 | Generate a bounded set of candidate normalized spans and resolve it with set-based queries. |
| Read path accidentally mutates state | Use read-only transactions and assert broad table-count snapshots around real API calls. |

## Open questions

None. The overlap policy was explicitly approved on 2026-09-02; the frozen OpenAPI is sufficient.
