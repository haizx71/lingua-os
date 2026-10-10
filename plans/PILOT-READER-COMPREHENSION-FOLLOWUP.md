# Reader meaning and next-action follow-up

## Evidence and scope — 2026-10-10 Asia/Saigon

After the option 3 release, the owner again reports that translations are absent and clarifies that the features feel dull because they do not know which feature to use next. This is a repeated PILOT-003 comprehension-support report and a more specific PILOT-004 guidance report, not measured prevalence or learning outcome.

Authoritative local/remote master is `c61019addfaf9974ad582f73b02cf10474b3e34d` with zero divergence and attachment-only untracked files. Earlier runtime/review workers are completed. Commander owns the sole mutation lock. This follow-up is isolated on `codex/pilot-reader-guidance-followup`; generated cache remains preserved and excluded.

## Confirmed source gap

- Reader renders supplied `translationVi`; no source translation means no reveal control. The redesigned affordance is implemented, but it cannot create content.
- The first-party A Quiet Cup of Tea source splits into 72 sentences using the existing Admin splitter. The prior actorless catalog observation (2026-10-09) found zero nonempty Vietnamese translations; no new hosted or learner query was made here.
- Admin create/update contracts and forms accept English body/source metadata, but no sentence translations. Reader storage/read DTOs already support `sentence_translations` with provenance. A UI-only correction cannot populate this gap through the authorized authoring path.
- ADR-024 and the Reader publication gate forbid editing published/retired structures. New content needs a new identity; retiring the old item would hide it and therefore requires a separate learner-reference impact review. No retirement is proposed or authorized now.

## Concrete offline candidate

`knowledge/staging/pilot-reader-vi-draft/translation-draft.json` and its readable `editorial-preview.md` contain a complete 72-sentence Vietnamese draft for this one article. Candidate SHA-256: `e88ccc0938dfcc00df6e84a0aea8918ea9cb6c6e62cc1471c935ae6aafd79838`. They are editorial artifacts, not an Admin payload, fixture fallback or published catalog data. Original PR #38 approval is explicitly not inherited. Four disclosed English corrections resolve water/tea and photo continuity problems while retaining previously mapped context terms. Existing exact concept matching and rejection of unmapped sentences must still pass normal validation; offline pairing is not that gate. Candidate level fit, editorial accuracy and rights are still review gates.

Preparation/source audit used GPT-6 Luna / Medium. Root assembled the paired candidate and four disclosed corrections; this is not a Luna-worker implementation packet. Separate final safety/design review is assigned GPT-6 Luna / Max. No runtime implementation or hosted write is underway.

## Bounded proposed content correction, pending authorization

1. Review the exact candidate, its four English changes, Vietnamese meanings and provenance; obtain owner editorial/rights approval for that exact hash and staging-only use.
2. Review a minimal extension of existing Admin authoring contracts to accept supplied Vietnamese translations aligned to server-determined sentence order/text. Do not silently invent a public field, accept arbitrary sentence/catalog IDs, or bypass the current publication validator. Agree the exact request/response contract before implementation.
3. Restrict translation authoring to unpublished owner-authorized first-party content; preserve existing Auth/allowlist/RLS and published immutability. Reject misalignment, duplicate entries, empty/oversized meaning, and source/body changes that would leave stale translations. Translation rows need their own approved provenance linked to the new item.
4. A dedicated Luna Max implementation plus independent Luna Max review must prove transaction rollback, source alignment, immutable published content, old-reference preservation and no learner-table writes. Update contracts in the same change; existing schema is reused if proven sufficient, with no speculative migration.
5. Pass focused API/database/frontend tests, generated-contract checks and exact-head CI/Preview. Only then perform authorized normal Admin draft → validate → publish, under Commander serialization. Preserve original content and all learner references. A separate controlled disposable actor must verify returned sentence meaning and reveal without generating learning evidence merely by revealing, plus automatic cleanup/Auth deletion/zero residue/retained comparison if any hosted actor is used.

## Bounded proposed guidance correction, P2 exception required

Keep the current navigation and server-selected Today order. At Reader entry, a short instruction can explain lookup and explicit concept Save/Learn. After a successful concept save, offer a user-clicked Review link described as checking words due for review, not a promise that the saved word is immediately due. At reading completion, offer a user-clicked return to Today for the server's next activity. Article/sentence saves remain bookmarks and must not be described as FSRS activation. No auto-navigation, auto-saving, new persisted learner step, fabricated progress, or client-side scheduler is proposed.

PILOT-004 remains P2, so the pilot's existing P0/P1 rule requires a specific owner exception before this runtime guidance change. The completed full-web presentation authorization does not imply new learning architecture. Until authorized, only the draft, findings and plan are prepared.

## Current gate

Offline alignment/count/nonempty checks PASS for 72 pairs. Independent GPT-6 Luna / Max plan/candidate review PASS with no HIGH/BLOCKER; see [review](../reviews/PILOT-READER-COMPREHENSION-PLAN-REVIEW.md). The two Vietnamese phrasing notes are resolved. This is design/draft verification, not native-editor approval, CEFR certification or runtime/publication acceptance. Owner exact-content/rights approval and bounded authoring/guidance implementation authorization remain pending. No translations have been published; no real learner account was navigated, refreshed or mutated. K2-06–K2-10, migration 0021, one FSRS lineage and the four separate hardening follow-ups remain preserved.
