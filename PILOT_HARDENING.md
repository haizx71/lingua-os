# Real Learner Pilot — Separate Hardening Follow-ups

These four items are tracked separately from pilot findings. They are nonblocking follow-ups for the bounded observation period; none is represented as fixed or as a verified learner defect. Current acceptance evidence and its limits are recorded in the [K2-10 verification seal](reviews/K2-10-verification-seal.md).

| Follow-up | Current evidence | Scope and treatment |
|---|---|---|
| Leaked-password protection | The seal records the pre-existing Supabase Auth MEDIUM leaked-password warning; Auth configuration was not changed. | Track for a separately authorized Auth configuration change. Do not treat its presence as a pilot observation or silently change hosted settings. |
| Conditional Next.js advisory | The seal preserves two conditional Moderate Next.js advisories and the conditions under which they were assessed. This is not an unconditional clean dependency audit. | Reassess against the deployed framework and affected conditions in a separate dependency/security review. |
| Protected Next `/api` proxy end-to-end coverage | The seal's hosted coverage is deployed UI plus normal-JWT direct Render requests; it does not cover the protected Next `/api` proxy. | Add a separately reviewed end-to-end gate if evidence or a future acceptance scope requires it. Do not imply current coverage. |
| Auth-form end-to-end coverage | The seal does not claim an auth-form browser E2E for K2-10. | Track separately from the current learner observation and do not treat normal-JWT checks as proof of the auth-form flow. |

These follow-ups do not authorize pilot-time product, Auth, deployment, contract, or database changes. A reproducible P0/P1 runtime defect follows the isolated regression and review path in the [pilot plan](plans/REAL-LEARNER-PILOT-V2-FREEZE.md).
