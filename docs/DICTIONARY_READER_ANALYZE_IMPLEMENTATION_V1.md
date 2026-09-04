# Dictionary and Reader Analyze API v1

TASK-008A implements the frozen `getConcept`, `searchDictionary`, and `analyzeReaderText`
operations over the relational catalog and learner projections.

Reader Analyze is a pure, deterministic leftmost-longest exact matcher. It scans each Unicode
sentence independently, prefers the longest span at the earliest start, then breaks ties by
normalized form and concept identifier. Matching uses catalog lexemes and forms only; source
UTF-16 offsets are preserved and no fuzzy, semantic, stemming, or AI behavior is performed.

Dictionary reads enforce approved provenance, actor ownership, and opaque HMAC-signed cursors.
Analyze opens a read-only Brain snapshot and never persists learner state. Missing learner state is
represented as the existing synthetic zero-evidence projection.

The PostgreSQL test fixture uses an isolated migrated database per test to prevent cross-suite
mutation from changing deterministic catalog results.
