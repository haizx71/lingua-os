# K2-08 Article Candidate: Dry-Run Catalog Mapping

**Status:** CANDIDATE ONLY — mapping feasibility prepared; editorial, level, rights, author, and publication approvals remain pending.
**Candidate body:** `knowledge/k208-a2-market-article-candidate-2026-10-01.md`
**Body SHA-256:** `6c39d16de0f6ecb27be2420c2f011a704663e036e77a86afb2c09b72930ba28c`
**Body measurements:** 1,263 whitespace tokens; 72 sentences; 8 estimated minutes under the Reader API formula `ceil(tokens / 180)`.
**Catalog scope:** approved English word/phrase records only; no Auth, user, profile, learner, or event records were read. No catalog UUIDs were returned or stored in this packet.

## Admin contract and deterministic mapping

The accepted owner-only API is `POST /v1/admin/content` with required fields `title`, `body`, `languageCode`, `level`, `authorName`, `sourceName`, `sourceVersion`, `attributionText`, and `rightsStatement`. It authenticates an existing JWT and checks the server-side `LINGUA_ADMIN_USER_IDS` allowlist. This packet does not create an API request or provide an owner credential.

On create, the service splits the body with the accepted Reader splitter and applies `analyze_transient_text`. The database candidate lookup uses approved, quality-scored, allowed-provenance concept/lexeme/forms and the analyzer chooses leftmost-longest exact normalized matches, returning explicit UTF-16 half-open offsets. Creation stores those automatic sentence annotations and the aggregated `content_concepts`; an owner may use the exact manual mapping route only for corrections before publish. Validation and publication remain separate lifecycle operations and were not called.

The read-only staging query mirrored the code's eligibility predicate for concept, lexeme, and lexeme-form provenance, and used the Admin projection's canonical-form ordering. It returned 98 unique eligible normalized forms for English word/phrase concepts (excluding the FRLL-only anchor); none mapped to multiple concept identities. For the 66 forms selected below, an aggregate confirmed 66 distinct catalog concepts and 66 distinct lemma strings. The candidate contains only ASCII text, so the reported local offsets equal the API's UTF-16 offsets. The source matcher tie-break by concept UUID is immaterial for this candidate because every selected normalized form mapped to exactly one eligible concept.

The source-driven dry run selected 186 occurrences across all 72 sentences, leaving no sentence without at least one target annotation. This is a mapping feasibility result, not a live Admin create, database persistence check, Reader publication gate result, or publication approval.

## Sentence-to-concept dry-run

Sentence numbers are the deterministic Admin segment order, zero-padded. Each occurrence is `Admin canonical form (matched normalized form) [startOffset, endOffset)`; spans are UTF-16 half-open and relative to that sentence's exact text in the candidate body. Every annotation would use the existing `target` occurrence role.

| Sentence | Selected catalog mappings |
| --- | --- |
| 01 | on (`on`) [0, 2); morning (`morning`) [12, 19); friend (`friend`) [33, 39); plan (`plan`) [58, 62) |
| 02 | usually (`usually`) [4, 11); breakfast (`breakfast`) [17, 26); home (`home`) [30, 34); today (`today`) [40, 45); near (`near`) [76, 80); station (`station`) [85, 92) |
| 03 | appointment (`appointment`) [11, 22); leave (`leave`) [63, 68); early (`early`) [69, 74) |
| 04 | bus (`bus`) [15, 18); on (`on`) [24, 26); screen (`screen`) [29, 35); choose (`choose`) [40, 46); bus (`bus`) [49, 52) |
| 05 | journey (`journey`) [4, 11); enough (`enough`) [37, 43); water (`water`) [44, 49); be (`be`) [95, 97) |
| 06 | go (`go`) [12, 14); advice (`advice`) [33, 39); buy (`buy`) [54, 57); how much (`how much`) [62, 70) |
| 07 | card (`card`) [22, 26) |
| 08 | card (`card`) [13, 17) |
| 09 | goal (`goal`) [6, 10); morning (`morning`) [21, 28); choose (`choose`) [38, 44) |
| 10 | plan (`plan`) [15, 19); bus (`bus`) [49, 52); stop (`stop`) [53, 57); want (`want`) [88, 92) |
| 11 | advice (`advice`) [16, 22); plan (`plan`) [49, 53) |
| 12 | compare (`compare`) [14, 21); price (`price`) [26, 31); buy (`buy`) [68, 71) |
| 13 | go (`go`) [34, 36) |
| 14 | possible (`possible`) [35, 43); have (`have`) [57, 61); work (`work`) [65, 69); today (`today`) [89, 94) |
| 15 | enough (`enough`) [36, 42); free (`free`) [43, 47); journey (`journey`) [66, 73) |
| 16 | water (`water`) [15, 20); would like (`would like`) [55, 65) |
| 17 | station (`station`) [54, 61) |
| 18 | help (`help`) [125, 129) |
| 19 | find out (`find out`) [67, 75); bus (`bus`) [92, 95) |
| 20 | bus (`bus`) [7, 10); stop (`stop`) [11, 15) |
| 21 | bus (`bus`) [4, 7); on time (`on time`) [16, 23); station (`station`) [60, 67); stop (`stop`) [80, 84) |
| 22 | ticket (`ticket`) [56, 62); journey (`journey`) [71, 78) |
| 23 | price (`price`) [16, 21); ticket (`ticket`) [48, 54); buy (`buy`) [76, 79) |
| 24 | choose (`choose`) [5, 11); near (`near`) [32, 36); comfortable (`comfortable`) [69, 80) |
| 25 | on (`on`) [0, 2); compare (`compare`) [17, 24); coffee (`coffee`) [86, 92) |
| 26 | coffee (`coffee`) [10, 16); breakfast (`breakfast`) [50, 59); be (`be`) [78, 80); enough (`enough`) [81, 87) |
| 27 | would like (`would like`) [29, 39); tea (`tea`) [40, 43) |
| 28 | leave (`leave`) [10, 15); bus (`bus`) [20, 23) |
| 29 | morning (`morning`) [92, 99) |
| 30 | home (`home`) [71, 75) |
| 31 | menu (`menu`) [11, 15); breakfast (`breakfast`) [85, 94) |
| 32 | hungry (`hungry`) [89, 95) |
| 33 | tea (`tea`) [18, 21); enough (`enough`) [48, 54); right (`right`) [72, 77); card (`card`) [78, 82); in (`in`) [83, 85) |
| 34 | price (`price`) [4, 9); card (`card`) [34, 38) |
| 35 | water (`water`) [33, 38); classmate (`classmate`) [57, 66) |
| 36 | classmate (`classmate`) [13, 22); tired (`tired`) [29, 34); work (`work`) [41, 45); habit (`habit`) [69, 74) |
| 37 | possible (`possible`) [21, 29); solution (`solution`) [30, 38); screen (`screen`) [63, 69) |
| 38 | advantage (`advantage`) [17, 26); disadvantage (`disadvantage`) [57, 69) |
| 39 | comfortable (`comfortable`) [14, 25); journey (`journey`) [74, 81) |
| 40 | breakfast (`breakfast`) [6, 15); look for (`look for`) [22, 30); plan (`plan`) [93, 97) |
| 41 | near (`near`) [59, 63); station (`station`) [68, 75) |
| 42 | medicine (`medicine`) [36, 44); near (`near`) [59, 63); home (`home`) [64, 68) |
| 43 | help (`help`) [14, 18); leave (`leave`) [38, 43); appointment (`appointment`) [65, 76) |
| 44 | compare (`compare`) [49, 56); price (`price`) [61, 66) |
| 45 | medicine (`medicine`) [24, 32); name (`name`) [66, 70) |
| 46 | want (`want`) [13, 17); choose (`choose`) [21, 27); name (`name`) [93, 97) |
| 47 | please repeat (`please repeat`) [11, 24); name (`name`) [29, 33); please (`please`) [45, 51) |
| 48 | friend (`friend`) [23, 29); near (`near`) [30, 34); bus (`bus`) [39, 42); stop (`stop`) [43, 47); friend (`friend`) [69, 75) |
| 49 | friend (`friend`) [4, 10); work (`work`) [23, 27); there (`there`) [33, 38); enough (`enough`) [42, 48) |
| 50 | compare (`compare`) [5, 12); weekend (`weekend`) [13, 20); journey (`journey`) [79, 86) |
| 51 | would like (`would like`) [18, 28); come (`come`) [32, 36); plan (`plan`) [72, 76) |
| 52 | tomorrow (`tomorrow`) [46, 54) |
| 53 | station (`station`) [7, 14); bus (`bus`) [31, 34) |
| 54 | bus (`bus`) [11, 14); have (`have`) [52, 56) |
| 55 | lesson (`lesson`) [26, 32) |
| 56 | expensive (`expensive`) [16, 25); help (`help`) [47, 51); study (`study`) [56, 61) |
| 57 | card (`card`) [27, 31); price (`price`) [80, 85) |
| 58 | enough (`enough`) [44, 50); water (`water`) [51, 56); journey (`journey`) [65, 72) |
| 59 | tea (`tea`) [63, 66); near (`near`) [67, 71); station (`station`) [76, 83) |
| 60 | bus (`bus`) [4, 7); menu (`menu`) [54, 58) |
| 61 | plan (`plan`) [26, 30); comfortable (`comfortable`) [71, 82) |
| 62 | like (`like`) [34, 38); ticket (`ticket`) [50, 56); water (`water`) [70, 75); problem (`problem`) [91, 98) |
| 63 | near (`near`) [17, 21); home (`home`) [22, 26); appointment (`appointment`) [69, 80) |
| 64 | coffee (`coffee`) [78, 84) |
| 65 | medicine (`medicine`) [44, 52) |
| 66 | price (`price`) [86, 91) |
| 67 | journey (`journey`) [35, 42); bus (`bus`) [48, 51); study (`study`) [84, 89) |
| 68 | usually (`usually`) [4, 11); habit (`habit`) [43, 48) |
| 69 | plan (`plan`) [28, 32); weekend (`weekend`) [42, 49); would like (`would like`) [80, 90) |
| 70 | choose (`choose`) [5, 11); leave (`leave`) [74, 79); early (`early`) [80, 85) |
| 71 | advice (`advice`) [61, 67) |
| 72 | tomorrow (`tomorrow`) [20, 28); friend (`friend`) [50, 56); plan (`plan`) [73, 77) |

## Non-submittable authoring fields

These are schema reminders only, not an API-ready payload. Human approval must supply the unresolved authorship and rights values before the owner-only create operation:

- `title`: `A Saturday Market Plan`
- `body`: exact fenced article body in the linked candidate artifact; hash above
- `languageCode`: `en`
- `level`: proposed `A2`, pending editorial confirmation
- `authorName`, `sourceName`, `attributionText`, `rightsStatement`: pending human ownership/attribution and rights approval
- `sourceVersion`: `k208-a2-market-plan-candidate-2026-10-01-v1`

Do not validate or publish this content until editorial and rights approval, exact Admin response review, and the complete Reader publication dependency checks are done. The exact database-generated sentence/content UUIDs, persisted `sentence_concepts`, `content_concepts`, source record hash, and publication state remain unknown because no authoring operation was performed.

## Source references

- `contracts/openapi.yaml` — Admin create, manual sentence mapping, validate, and publish contracts.
- `services/api/src/lingua_api/admin/models.py` — strict request DTO and required create fields.
- `services/api/src/lingua_api/admin/store.py` — eligible candidate lookup, deterministic sentence persistence, canonical Admin projection, and aggregated content concept links.
- `services/api/src/lingua_api/catalog/sql.py` — approved provenance predicate.
- `services/api/src/lingua_api/reader/analyze_policy.py` — segmentation, normalization, leftmost-longest exact matching, and UTF-16 offset calculation.
- `services/api/src/lingua_api/content/store.py` and `database/migrations/0005_reader_content_service_v1.up.sql` — Reader output and publication eligibility.
