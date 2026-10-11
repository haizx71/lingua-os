# PILOT Reader Dictionary Source Candidate Review

Review date: 2026-10-11 (Asia/Saigon).
Reviewer assignment: independent GPT-6 Luna/Max source and rights review. Runtime model/effort metadata is not exposed to this reviewer, so the exact serving model and reasoning setting cannot be independently attested here.
Review target: C:\Users\pc\.codex\worktrees\pilot-reader-dictionary\LINGUA_OS_PROJECT_STARTER, branch codex/pilot-reader-dictionary-runtime, base bb59cb171fd440b9cb097752a16e33dc800cac1b.
Scope: exact-form public-source candidate only; no meanings copied, no corpus activated, no runtime or hosted changes.

## Evidence identity

Verified SHA-256:

- Candidate report exact-form-rights-quality-candidate-v3.md: A2A5F529ED20B995283135ECBF939D0635E7AF35778AE19EC234E4CA35AD63AB.
- candidate-matrix-v2.json: AC01BEF1DA64DC1A9A46DD28E145F508454A16BFDC1E7150615429FD2FFBE.
- Pinned source snapshots are preserved beside those files. The matrix has 16 requested forms, 15 resolved pages with English-section markers, and one missing page (Mina). The candidate report and matrix contain no glossary meanings.

## Disposition

One narrow morphology-only record is a plausible reuse candidate under the default CC BY-SA 4.0 route: visits at oldid 1944446. This disposition is limited to the explicit Wiktionary relation encoded in that pinned English entry. It does not clear any meaning or other content from visit, whose English entry is FVDP-referenced. It is an exact-record candidate for root approval, not authorization to activate or publish corpus data. External publication remains unauthorized.

The candidate visits revision contains the English form relation, with no gloss and no external-source reference template. Its page history has 11 revisions back to 2007-09-11; the first revision comment describes English verb conjugation. The discussion page was absent in the unauthenticated public API check. The pinned revision's rendered footer identifies CC BY-SA and says additional terms may apply. The vi-Wiktionary copyright policy says content defaults to CC BY-SA 4.0 and previously GFDL unless noted, permits attribution by linking the source entry, and directs reusers to check page-specific exceptions. Wikimedia Terms of Use likewise direct reusers to inspect the footer, history and discussion for imported text and require preservation of additional source attribution.

For a visits-only artifact, preserve the permanent source link https://vi.wiktionary.org/w/index.php?title=visits&oldid=1944446, the CC BY-SA 4.0 license link, clear notice of extraction/normalization changes, and share-alike terms on any adapted dictionary data. Do not add terms or technical restrictions that prevent reuse of that licensed data. Keep the record and its license/credits separable from application code. Do not include the visit page's senses, examples, or other lexical content under this candidate: that English page is FVDP-referenced and remains held. The history comment and lack of a reference marker are positive provenance evidence, but they do not independently prove that no upstream database influenced the morphology relation; root should keep this exact boundary in its approval.

## Per-form source decision

| Requested form | Exact source signal in the pinned English section | Review disposition |
|---|---|---|
| Mina | Page missing; no English entry or rights evidence. | Exclude from this candidate. |
| visits | Oldid 1944446; explicit third-person singular relation; no gloss or reference template. | Conditional candidate pass, morphology relation only, subject to the attribution/share-alike package above and root's exact-record approval. |
| visit | Oldid 2403596; R:FVDP in English section. | Hold pending POS/sense lineage, FVDP/VACETS resolution and distribution terms. |
| her | Oldid 2477381; English section has R:FVDP. R:slr:Stroy is in a separate Salar section. | Hold for FVDP lineage; Stroy is not an English-section blocker. |
| grandmother | Oldid 2474973; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| every | Oldid 2468481; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| Sunday | Oldid 2449583; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| for | Oldid 2369426; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| tea | Oldid 2411397; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| in | Oldid 2537406; English section has R:FVDP. R:WinVNKey:Lê Sơn Thanh is in Vietnamese; R:Duden and R:DWDS are in German. | Hold for FVDP lineage; the other references do not attach to the English section. |
| small | Oldid 2422779; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| house | Oldid 2537372; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| beside | Oldid 2453428; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| park | Oldid 2538042; R:FVDP in English section. | Hold for FVDP lineage and record-level rights. |
| went | Oldid 1946482; no source-reference template, but no explicit form relation; only generic/older morphology templates were detected. | Hold. Absence of a source marker does not establish provenance or a valid lemma mapping; do not infer a lemma. |
| go | Oldid 2537205; English section has R:FVDP. R:WinVNKey:Lê Sơn Thanh is in Vietnamese. | Hold for FVDP lineage; WinVNKey does not attach to the English section. |

The matrix's source-template list is page-wide, not language-section-specific. The checks above inspected reference-template placement within the pinned wikitext before assigning a source to an English excerpt. In particular, the extra Stroy, WinVNKey, Duden and DWDS references should not be attributed to the English records named above.

## Remaining rights and attribution conditions

The FVDP origin page describes an English–Vietnamese database distributed under GPL, identifies about 5,000 technical terms as imported from VACETS, and records the FVDP author's no-objection to importing part of the work under GFDL. This documents a possible GFDL path for a verified FVDP-derived subset; it does not identify which candidate POS/senses came from FVDP versus VACETS, or grant blanket reuse of all candidate entries under CC BY-SA. The VACETS origin page calls the database intellectual property of its project participants and requests clear credit to the original author and project team, without naming a specific license on the reviewed page. Those exact source records need an applicable rights path and required credit before activation.

For any FVDP-tagged record, the next source gate needs to establish, for the exact English POS/senses proposed:

1. Whether the relevant content is FVDP-derived, VACETS-derived, Wiktionary-native, or mixed, using the source history/discussion and source records where available.
2. Whether its applicable terms are CC BY-SA, GFDL, or another specific grant; do not assume that page-level CC BY-SA metadata settles the license of imported text.
3. Required author, project and source attribution; preserve visible source notices.
4. The compatible license/change-notice and accessible source/credits package for the actual delivery format. If relying on GFDL, document and satisfy its applicable license, notice, history and transparent-copy requirements.
5. That no application-level terms or technical measures restrict reuse of the licensed dictionary artifact.

The Wiktextract software's MIT license is not a license for corpus records. No meanings or data have been copied into the product as part of this review.

## Promotion/privacy boundary

The current work is a local prototype; no external corpus publication or deployment is approved. The Next catch-all API proxy copies request.url's search string to the backend at apps/web/src/app/api/[...path]/route.ts:99. Vercel's official Runtime Logs documentation says log details expose Search Params for a request path, and its Log Drains schema defines proxy.path as including query parameters. Thus, if this GET is deployed on Vercel, the tapped surface can enter Vercel runtime/log-drain observability even when Uvicorn access logs are disabled. This is a confirmed HIGH promotion blocker for the plan's no-query-retention requirement; retention duration depends on the configured plan and drains. A bounded read-only POST body is the current proposed repair, but it requires a frozen plan/OpenAPI amendment and independent review before route or contract changes. Do not treat local Uvicorn redaction as proof of end-to-end privacy. No platform settings, global logging configuration, or runtime code were changed.

## Primary sources

- [Pinned visits entry, oldid 1944446](https://vi.wiktionary.org/w/index.php?title=visits&oldid=1944446)
- [Pinned visit entry, oldid 2403596](https://vi.wiktionary.org/w/index.php?title=visit&oldid=2403596)
- [Vi-Wiktionary copyright policy, oldid 2210567](https://vi.wiktionary.org/w/index.php?title=Wiktionary:Quy%E1%BB%81n_t%C3%A1c_gi%E1%BA%A3&oldid=2210567)
- [FVDP provenance and GFDL permission record, oldid 2033151](https://vi.wiktionary.org/w/index.php?title=Wiktionary:Ngu%E1%BB%93n_g%E1%BB%91c/FVDP&oldid=2033151)
- [VACETS provenance/credit notice, oldid 2033156](https://vi.wiktionary.org/w/index.php?title=Wiktionary:Ngu%E1%BB%93n_g%E1%BB%91c/VACETS&oldid=2033156)
- [Wikimedia Terms of Use, Licensing of Content](https://foundation.wikimedia.org/wiki/Terms_of_Use/en#7._Licensing_of_Content)
- [CC BY-SA 4.0 legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)
- [GNU Free Documentation License 1.3](https://www.gnu.org/licenses/fdl-1.3.en.html)


- [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime)
- [Vercel Log Drains log schema](https://vercel.com/docs/drains/reference/logs)
