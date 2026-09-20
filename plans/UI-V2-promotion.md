# UI v2 promotion

Source: `chatgpt/ui-redesign-v2-2026-09-15`; target: `master`.

1. Merge the visual implementation on top of current `master`, preserving the newer font setup and server-verified account deletion.
2. Exclude the source branch's tracked `.env.production`; configure hosted values through deployment settings.
3. Reconcile frontend tests against the approved UI while retaining behavior assertions for actor isolation, explicit Save/Learn, Today completion, Reader saves, and accessibility.
4. Run frontend tests, typecheck, lint, production build, contract freshness and deployment review. Promote only after these gates pass; record infrastructure blockers separately from code regressions.

No API contract or database migration is planned.
