# Independent Review — K2-08 Post-Setup Proof Scope

Date: 2026-10-02  
Reviewer: GPT-6 Luna / Max  
Disposition: **PASS for this bounded harness fix; no HIGH/BLOCKER findings.** This review does not establish hosted K2-08 acceptance.

## Reviewed patch

- Base: `a71fa0df7804398d1657ea14ce6ef0141ceba29c`
- Two-file raw Git diff SHA-256: `c4204a9b073c7e1666346855351a6ed2bba34186be76b753b112888e344e0cc6`
- Files: `tests/acceptance/support/k2_hosted_wave_k2_08.ts` and `tests/acceptance/support/k2_hosted_wave_k2_08.test.ts`

The failed run `36898739546` reached `fixture_k208_post_setup_snapshots` after passing the setup seed and candidate-matrix phases. The assertion compared actor-wide expected row totals (20/22/1/0) to `actorLineage()` fields that are scoped to the single fixed K2 anchor concept. Those were different quantities. The existing actor-wide `requireSnapshotRows` gate was already checking total rows separately.

The patch preserves the exact actor-wide snapshot row checks and changes the anchor-scoped proof to require exactly zero anchor state, review, and FSRS rows, zero evidence counts and masses, and no review events. Candidate remediation graphs are rejected if any actor’s N/W/F roles contain the fixed anchor. Dictionary pages are shape- and size-checked before filtering; only the fixed anchor handle is excluded from due candidate selection, and more than one anchor occurrence in a page fails closed. The shared selector, API limits, K2-07 path, authentication, actor binding, and cleanup logic are unchanged. Later checks still compare anchor lineage to its setup baseline.

## Verification

- Independent focused Vitest run: `k2_hosted_wave_k2_08.test.ts` — **15/15 passed**.
- `git diff --check` for the two reviewed files — **passed**.
- The tests cover keeping 20 due selections when the anchor is first in a Dictionary page, rejecting anchor targets in the remediation graph, rejecting an oversized raw page before filtering, preserving actor-wide count checks, and failing closed on nonzero anchor rows/evidence/masses/events.
- The implementation worker reported **67/67** focused tests, TypeScript check, lint, and diff check passing. Those broader results were not rerun independently.

## Runtime boundary

The preceding full hosted run `36898739546` remains **FAIL** at `fixture_k208_post_setup_snapshots`; this review is source/test review only. The run log showed cleanup of actors and fresh identities, retained-state comparison, and finalizer completion passing; the separate current-run cleanup job succeeded. The root operator separately reported an exact post-cleanup comparison against the 27-table baseline. These cleanup results do not convert the failed run into K2-08 acceptance. A new exact-master deployment attestation and complete hosted rerun, including final cleanup and retained comparison, are still required.

No source, Git, or hosted state was changed by this review; this file is the only review artifact added.
