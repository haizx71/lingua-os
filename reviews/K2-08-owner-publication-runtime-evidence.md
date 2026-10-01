# K2-08 Owner Publication Runtime Evidence

Updated: 2026-10-02

## Scope and disposition

This record documents the staging runtime acceptance evidence for the exact owner-approved PR #38 Reader pack. Runtime and hosted facts below are transcribed from the root operator’s live-run observations; this author did not independently query the deployments or database. The evidence is limited to the controlled staging workflow and the before/after-publication retained learner-state comparison. It does not authorize production publication or unlock K2-09. The latest full hosted K2-08 run is **FAIL** at the due-seed gate. The source fix for the diagnosed request-normalization defect passed independent Max review with no HIGH findings, 54 focused tests, typecheck, and lint. CI, merge, and the full hosted rerun remain pending; K2-08 cannot be called PASS and K2-09/K2-10 remain locked.

The candidate content was created only through the normal authenticated Admin UI/API path. No direct database writes or application-store bypass were used. This record intentionally contains no actor UUIDs, email addresses, access tokens, credentials, or raw retained-state rows.

## Models and independent review

- Initial content preparation and packet authoring: **GPT-6 Luna, Medium** (this authoring task's configured model and effort).
- Independent content review and prose corrections: **GPT-6 Luna, Max**, performed by a separate review worker.
- The Max review applied to the frozen content pack SHA256 `5eb2d97d94f6288f6195c22cf9ae87d7e912ce09dc9b97e4eab626620fa4a679` and returned PASS. The retained review record is `reviews/K2-08-approved-content-pack-review.md` (review commit `9f4bc2b2127304948d639d595716af243819b5ad`).

## Authorization and deployment boundary

The project owner used one normal authenticated staging account for the Admin bootstrap and publication cycle. The only authorization setting changed was `LINGUA_ADMIN_USER_IDS`, with replacement disabled; the original four values were retained. No other environment variables or GitHub secrets were modified. This statement is limited to bootstrap and publication: the broader hosted harness may create its separately authorized disposable actors.

The owner-bootstrap automatic Render deployment `dep-dav8ho6k1f9s73d853rg` is live, with `/health` healthy and authenticated Admin requests returning HTTP 200. The merge-associated Render deployment `dep-dav8rhu0tbcc739712h0` is live and healthy at commit `25e7e1a3b85b302f7f1c6a9613e55b82e6f0ef55`. GitHub Vercel Production deployment record `6789933001` succeeded for that merge; it is a deployment record, not a workflow-run identifier. The connected Vercel MCP did not expose team access. Protected-access OIDC was verified PASS for the current hosted run.

CI runs `36892053818` and `36892053880` both passed. PR #38 was merged at `25e7e1a3b85b302f7f1c6a9613e55b82e6f0ef55`.

## Normal Admin content lifecycle

Three content items were created through the standard Admin UI, each with an HTTP 201 response and the already-approved exact DTO metadata and body hashes:

| Role | Item | Body SHA256 | Sentences | Annotations | Private target matches |
|---|---|---|---:|---:|---:|
| Novel control | N | `7f91d20d0fe2b13816f1fd1b79924cf24ea3d8d828f9023bfca48196a1339627` | 72 | 82 | 46 tea |
| Weak remediation | W | `bf6e7d3cacfbf1b76c091d043a47487090933df4cef219c405075dc08c3926a9` | 69 | 76 | 35 coffee |
| Forgotten remediation | F | `1f6d0597845775716507091daa81bbcb040618a79786ad86aee8774926e9261e` | 74 | 76 | 49 water |

All sentence matches came from the production matcher. Each sentence had at least one match; all 234 annotation spans matched their exact UTF-16 source slices and were non-overlapping. The private target concepts were isolated to their own item. The items retained their reviewed A1/A2/B1 levels and the approved first-party metadata.

All three normal Admin validation calls returned HTTP 200 with `isValid=true` and zero issues before publication. All three normal Admin publication calls returned HTTP 200. The actorless catalog gate then reported exactly three globally eligible published items, exactly these three pack items, all three five-minute items, correct 1–4 concept totals (N/W/F: 4/3/3), exact aggregate occurrence counts, and the rank view available. The gate passed its required checks.

## Retained learner-state comparison

Before and after publication, 27 retained learner-state table snapshots were compared. Both sides had 61 rows and 51,535 total bytes; the per-table hashes/counts matched. Raw rows were not exported or stored. Aggregate comparison results were held in memory.

For the before/after-publication comparison, the read-only database caller used the existing privileged PostgreSQL identity with `NOSUPERUSER` and `BYPASSRLS=true`, in an explicitly `READ ONLY`, `REPEATABLE READ` transaction. This evidence does **not** establish least-privilege harness proof. An attempted `SET LOCAL ROLE` failed with SQLSTATE `42501`; no grants or role memberships were changed. The installed `digest` extension was verified. The probe applied global count/byte bounds and a 30-second timeout while hashing the retained-state tables.

## Current gate status and limits

The K2-08 hosted run `36894644581` is **FAIL**, stopping at `fixture_k208_due_seed`. The exact runner error was: “Error: K2 hosted acceptance staging API returned HTTP 422.” The unexpected-status guard in `seedDueBacklog`, wave 229, observed this on a Dictionary GET whose actual outbound URL was missing the required query string. The request normalizer dropped query parameters that had already passed validation; the resulting bare path received HTTP 422. The Dictionary API contract accepts a one-letter query and `limit=100`, so this is a request-construction defect rather than a contract rejection. The independent Max review of the source fix returned PASS with no HIGH findings; 54 focused tests, typecheck, and lint passed. CI, merge, and full hosted rerun are still pending. See [K2-08 Dictionary fixture query review](K2-08-dictionary-fixture-query-review.md). No JSON-parser repair or API-limit broadening is part of the fix.

Before the failing due-seed gate, all hash checks, deployment/OIDC/protected API checks, migration and fixture-capability checks, empty-HEAD preflight, retained-state baseline, disposable actor creation, authorization/browser/profile checks, and candidate-matrix checks passed. Finalizer actor cleanup, fresh identity cleanup, retained comparison, and finalizer completion checks passed; separate cleanup job `110481331920` succeeded. An additional post-failure cleanup comparison of 27 retained-state tables passed against the publication baseline. K2-08 is **NOT PASS**; K2-09 and K2-10 remain locked. Do not claim full hosted acceptance PASS. In particular:

- The publication/runtime evidence above is staging-only and applies to the exact PR #38 candidate.
- Matching before/after aggregate hashes support that the checked retained learner-state tables did not change during publication; finalizer retained-comparison checks also passed, but these facts do not prove least-privilege isolation.
- A failed `SET LOCAL ROLE` was not repaired by adding privileges; role configuration remains unchanged.
- This record does not authorize production publication or staging operations beyond the separately authorized full K2-08 harness, and does not unlock K2-09.
- K2-09 remains locked until K2-08 full hosted acceptance reaches PASS after final cleanup and independent review.
