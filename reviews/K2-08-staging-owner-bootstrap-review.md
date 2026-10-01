# K2-08 Staging Owner Admin Bootstrap — Bounded Security Review

Date: 2026-10-01; reviewer: configured GPT-6 Luna / Max

## Verdict

**PASS for the specifically authorized staging bootstrap, subject to the preflight and
verification checks below.** No HIGH/BLOCKER issue was found in the one-variable
authorization path. This security review does not extend the user’s authorization to
content publication, actor creation, or any production change.

This review relies on root’s sanitized, read-only identity and service checks. The bearer
token, account UUID, email, database URL, and environment values were not provided to or
recorded by this reviewer.

## Scope and evidence

The requested target is Render service `lingua-api-staging` (`srv-daip7vbm8hqs73dp00pg`)
in workspace `tea-dainjnh594qs739g7nfg`. Root reports that the live service identity was
matched to the intended staging service. The staging environment currently has no
`LINGUA_ADMIN_USER_IDS`; its existing environment key names were inventoried without
reading or reporting values.

Root reports that the current bearer was verified for the intended Supabase project,
issuer, audience, `authenticated` role, expiration, and UUID subject, and that a private
read-only Auth lookup found exactly one matching email-confirmed user. The normal Admin
request returns 403 while the owner allowlist is unset. These checks establish the
intended identity through the existing authentication boundary without adding or
modifying an Auth user.

The repository code supports this narrow change:

- `services/api/src/lingua_api/auth.py:64-80` verifies the signed bearer’s issuer,
  audience, expiration and required claims, requires role `authenticated`, and maps the
  UUID `sub` to `AuthenticatedActor.id`.
- `services/api/src/lingua_api/main.py:128-136` builds `AdminActorPolicy` from the
  server-side `LINGUA_ADMIN_USER_IDS` value at application startup; the new value
  therefore requires a service restart/redeploy to take effect.
- `services/api/src/lingua_api/admin/authorization.py:21-37` parses UUID allowlist
  entries and fails closed for missing, malformed, or nonmatching configuration.
- `services/api/src/lingua_api/admin/routes.py:55-61` requires both the verified actor
  and the owner policy at the HTTP boundary. The configured UUID must match that verified
  actor exactly.
- `tests/backend/test_admin_policy.py` verifies exact-UUID matching and fail-closed
  missing/invalid configuration. Focused result: **7 passed**.

The Admin application methods do not enforce the HTTP actor policy by themselves.
Direct `AdminContentApplication` calls, SQL writes, service-role-as-actor, or changes to
Auth, RLS, grants, or other environment values would bypass or broaden the reviewed
scope and are not approved by this review.

## Exact approved operation

After rechecking the service ID, workspace, service name, URL, owner/repository and
deployment branch against the intended staging target, add only the single server-side
`LINGUA_ADMIN_USER_IDS` variable, with the one UUID corresponding to the already verified
current account. Use the root-held private value and `replace: false`. Confirm before
mutation that the key is still absent; record only environment key names and guard
booleans. The value must not appear in logs, output, screenshots, or repository files.

Redeploy the existing current `master` revision without clearing the build cache or
deploying this worktree. Verify that service health reports the exact expected `master`
SHA and that a read-only Admin HTTP request such as `GET /v1/admin/content` succeeds under
the same verified browser account. Recheck environment key names and confirm the only
addition is `LINGUA_ADMIN_USER_IDS`; retain no environment values in review evidence.

Stop if the target identity or current master SHA differs, the allowlist key unexpectedly
exists, the update would replace unrelated variables, deployment health reports another
SHA, or the same account remains denied. Do not widen the allowlist or try another
identity as a fallback.

## Boundaries that remain

This bootstrap does not create, validate, or publish Reader content. The earlier K2-08
content-pack approval is scoped to staging/hosted acceptance, and publication remains
separately gated by the PR #38 review/CI conditions and learner-state baseline. Before
any content write, the existing read-only retained learner-state snapshot is required.
After publication, the actorless exact-catalog and learner-state comparison must pass
before actor creation; the full K2-08 actor cycle remains separate.

No hosted mutation has been performed by this reviewer. Root owns the single environment
update and redeploy, and must record only sanitized target, key-set, health-SHA, and
same-account Admin outcome checks. No Auth, learner, RLS, grant, database, or content
write is part of this authorization.
