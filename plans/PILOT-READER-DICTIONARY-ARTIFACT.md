# Reader dictionary artifact and acceptance

Status: bounded local implementation approved; source activation and hosted release HOLD.
Date: 2026-10-11

This continues the verified [any-word lookup prototype](PILOT-READER-ANY-WORD-DICTIONARY.md), draft PR #73 at `39b828be83ad140a1f058cf5252741be204268ad`. It does not reopen Knowledge V2 or change migration 0022, Auth/RLS or FSRS.

## Reviewed scope

The implementation worker is assigned GPT-6 Luna / Max; routine source discovery uses Luna / Medium. A separate Luna / Max reviewer accepted the architecture v2.1 at SHA-256 `4cea87e6850a931862efcdf6abe4eae55c322083217155a5cd4855b9a96dec75`, with 0 HIGH/BLOCKER. The independent review has SHA-256 `9b733a31fd214e946d288a37e4d020eeb608e763884daac40a8b777f171417da`.

Root releases only:

- A deterministic offline SQLite builder with strict source-manifest, normalization, grouping, explicit form, attribution, approval and response-bound validation.
- Non-root Docker packaging with root-owned artifact and ancestor paths, no writable mount or replacement path, and an independently pinned trusted digest.
- Local builder/provider and actual image tests, including same-user write, chmod, unlink, rename, sibling and SQLite write denial.
- A dictionary-only extension of the existing protected Reader harness. The selected word must be demonstrably unannotated; annotated-token exposure regression remains separate.

Synthetic fixtures stay in tests and clearly labelled non-promotable local test images. They must never become a checked-in production artifact, approved production manifest or deployment digest. No actual source records, production artifact or hosted action is approved by this phase.

## Sources

The Vietnamese-edition Kaikki corpus stays held. The new bounded candidate is English-edition Wiktionary English entries with explicit Vietnamese translation rows at pinned revisions, including existing translations subpages. The initial probe found candidate rows on 11/16 exact forms; only 10 overlap the current Reader's 258 distinct tokens. These are discovery counts, not approved coverage. A five-word subset does not meet the product goal of a useful dictionary.

Review selected records' source lineage, applicable license, original/additional attribution, change notices and Vietnamese POS/sense quality. Use Wikimedia Terms of Use and actual page/revision notices; the Wiktionary Copyrights page is an unofficial draft. A fresh first-party authored and independently reviewed pack is another permitted source path. No blanket source clearance, automatic lemma inference or general morphology is allowed. Only explicit reviewed source-structured form relationships may be used.

## Deployment boundary

Preserve the existing Render service `srv-daip7vbm8hqs73dp00pg` in workspace `tea-dainjnh594qs739g7nfg`, its Free plan, URL, repository and master branch. Do not Blueprint-sync the different service name in render.yaml or create a replacement service. Any future runtime update must target the exact existing service by API, with fresh identity/configuration reads, serialized source/configuration rollout, one explicit deploy and restoration of prior auto-deploy settings if temporarily changed. Existing cold starts do not create an upgrade gate.

Vercel's read-only project inventory found zero project drains and no logging property names. This is configuration evidence, not proof that a request body is absent from hosted logs. Preserve the fixed POST URL/body privacy and require a sanitized synthetic sentinel log check at release.

## Verification and release

1. Build synthetic artifacts twice and require byte-identical output; reject invalid, unapproved, oversized, duplicate or inconsistent records.
2. Run focused builder/provider/API/body/log tests and touched-source Ruff/type checks.
3. Build the labelled local test image and prove non-root ownership/read-only/no-replacement behavior. Missing Docker proof is a failure, not a skip.
4. Run Reader harness local regressions, including unannotated dictionary taps and unchanged actor snapshots.
5. Freeze changed source hashes for separate Luna Max review. Resolve every HIGH/BLOCKER and run exact-head CI.
6. Separately approve exact lexical records, notices, production artifact/digest and final image before any activation.
7. Root alone may promote/deploy after the gates. Hosted acceptance uses normal sessions for two disposable actors, 27-table snapshots, zero dictionary-triggered writes, automatic cleanup/Auth deletion/zero residue and exact retained-learner comparison. No manual owner actor workflow or real learner action is allowed.

The endpoint and DTO already exist; no API or schema change is expected. Source, final image, hosted privacy and learner-isolation proofs remain open until actually verified.
