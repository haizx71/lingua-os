# Independent review: Reader comprehension follow-up

**Date:** 2026-10-10 (Asia/Saigon)
**Reviewer configuration:** GPT-6 Luna, Max reasoning
**Review scope:** plan and offline content candidate only; no runtime implementation, Git integration, hosted query, or hosted write.

## Verdict

**PASS for the bounded, gated plan; no Blocker or High finding.** This is not content approval, rights approval, CEFR certification, implementation authorization, or publication authorization. Keep the candidate in staging. Exact-content owner/editorial and rights approvals remain pending, and the Reader guidance change remains gated on a separate owner exception because PILOT-004 is P2.

## Frozen artifacts reviewed

- Baseline: `c61019addfaf9974ad582f73b02cf10474b3e34d`.
- [Follow-up plan](../plans/PILOT-READER-COMPREHENSION-FOLLOWUP.md), SHA-256 `54e28f8393b87f0afdd60c7967e0e5f4af051a1beffefdb12e355ab9c0a74e66`.
- [Vietnamese draft JSON](../knowledge/staging/pilot-reader-vi-draft/translation-draft.json), SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`.
- [Editorial preview](../knowledge/staging/pilot-reader-vi-draft/editorial-preview.md), SHA-256 `386ee0a998a0c28c8600c207ab96781d5bc5cc1be0d211dc2ee0e785b1098759`.

## Evidence and findings

- Follow-up re-review targeted the two Vietnamese copy edits requested in the initial review. Ordinal 18 now says `Mina quét những lá trà khô vào thùng rác đặt trên sàn.` Ordinal 57 now says `Mina đong lá trà, đợi nước trong ấm nóng lên rồi rót thật chậm.` These clarify the bin location and that the water in the kettle is heating. The current plan and editorial preview both reference candidate hash `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`. No additional copy finding arose in this bounded re-review.
- The candidate retains 72 sentence pairs and the same English body and four disclosed English edits reviewed previously.
- The final canonicalization was compared with parent commit `bc4462e`: parsed candidate JSON is semantically equal, and the CRLF-insensitive Git diff has no candidate content change. Repository attributes set `eol=lf` for the candidate, plan, and preview, making the approved candidate hash stable across Git checkout. The plan and preview diffs contain only the updated candidate-hash reference. The Commander repeated the accepted Admin splitter, source/body, and per-row hash checks after these two translation-only changes: 72 passed. I confirmed the current artifact hash, target row text, and plan/preview hash references. This does not substitute for later concept-matching, publication, or exact-head verification.
- The four English edits improve the water/tea subject and resolve the photo sequence. The revised text says Lan takes one photo from her bag, puts it on the table, Mina looks at that photo, and Lan leaves it for Mina. It preserves the known context terms. The draft translations I checked convey the sentence meanings without an evident reversal or missing plot event. This is a bounded language review, not native-editor signoff.
- The candidate explicitly marks itself as AI-assisted, unpublished, and unauthorized; rights and owner review are pending; PR #38 approval is not inherited. The preview repeats those limitations and says the existing A1 label is not evidence of level fit. The plan correctly requires exact-hash owner editorial/rights approval and makes no CEFR certification claim.
- Current local Admin create/update request DTOs accept English body and source metadata, not sentence translations. Reader sentence storage and response already support optional translations with `source_record_id` provenance. The proposed change is correctly contract-first: use server-determined segmentation/order and text alignment, reject invalid or stale alignment, attach approved translation provenance, preserve the existing publication gate, and use a new content identity. Published/retired immutability and preservation of the original item and learner references are explicit. The plan does not authorize arbitrary sentence IDs, a fallback translation, a schema migration, or changes to learning architecture.
- The plan current-gate paragraph now records this PASS and resolved copy notes, while explicitly keeping owner editorial/rights approval and bounded authoring/guidance authorization pending; it also disclaims CEFR and runtime/publication acceptance.
- The navigation guidance keeps Today server-selected and user-controlled. It distinguishes concept Save/Learn from article/sentence bookmarks, describes Review as checking words due rather than promising immediate due status, and offers a user-clicked return to Today. The separate owner exception for this P2 runtime change is correctly required; the full-web redesign authorization does not substitute for it.

## Limits

No hosted or learner data was queried in this review. The zero-translation count cited by the plan is the prior actorless observation, not a new check. No API, exact concept-matching, rollback, publication, or browser test was run; those are later implementation/verification gates. No translations have been published by this review, and no rights or legal conclusion is made.
