# K2-08 Fixture Boundary Design Review

**Design decision:** PASS on the immutable amended plan `19a11b2b4a1b4cce676dd4746bf1c7dfb29dc266`; independent review reported no HIGH or BLOCKER findings.
**Design worker:** GPT-6 Luna, reasoning effort Max (configured by the task dispatcher; no deeper runtime introspection claimed).
**Independent reviewer:** GPT-6 Luna, reasoning effort Max (configured review assignment).
**Scope:** architecture review only. This record does not certify source, CI, migration, content publication, or hosted acceptance.

## Review history

- Plan commit `66e85560d14f5529bc35fb52072779af293f473c` was NO-GO.
- The first revised design at `2a00743eb3dbe978ec9f212ad8d46cbb61141a8f` closed the initial privilege-split findings. A later rank-feasibility review found that the hosted scenario must not claim a fabricated adverse production `source_rank`.
- The immutable amendment at `19a11b2b4a1b4cce676dd4746bf1c7dfb29dc266` separates baseline catalog fit order from actual Today V2 order and was independently approved with no HIGH/BLOCKER findings. It retains the four-actor matrix, exact actor binding, fixed fixture operations, metadata-only privilege preflight, cleanup after uncertain profile bootstrap, and the source-merge → separately authorized migration → master-only hosted order.

## Accepted architecture

The protected runner retains the existing Auth Admin and service-role credentials. It gives wave code sanitized actor handles and fixed, actor-bound normal API closures. Only the runner may create the two reviewed synthetic state fixtures or inspect the exact fresh actor's projected effective status. The read-only probe remains the catalog/base-candidate and retained-snapshot reader. No new roles, grants, policies, secrets, Auth SQL access, production API changes, or RLS changes are part of the design.

The four fresh actors separately cover the 20-due control, forgotten over weak with the daily reserve, weak over novel, and novel-only control. Every selected candidate must be in both the bounded baseline set and the actual post-fixture V2 set. The hosted test checks source-derived order and exact output; adversarial rank precedence remains covered by the existing pure policy tests. Content eligibility and human publication approval remain prerequisites.

## Current implementation checkpoint

The implementation branch is based on the normal merge of PR #35 source commit `ecb830418e81cc60e573fe91acf7382563ac0568` and the accepted design line ending at `19a11b2b4a1b4cce676dd4746bf1c7dfb29dc266`. Any implementation checkpoint committed from this branch is explicitly **INCOMPLETE** until the remaining full-wave source, CI, and independent exact-head security review pass.

The staging Reader catalog was reported with zero eligible published items at design time. The prepared A2 article is not editorially or rights approved and is not published. No candidate may be described as eligible, no migration `0020` may be applied, and no hosted full K2-08 PASS may be claimed until their separate gates complete. The accepted K2-07 result is unchanged.

## Review limits

The design approval applies only to the plan at the exact immutable head above. It is not approval of the implementation, does not close source review or credential-free PostgreSQL parity, and does not authorize PR #35 integration, migration application, content publication, or a staging run. Those remain separate owner-controlled gates.
