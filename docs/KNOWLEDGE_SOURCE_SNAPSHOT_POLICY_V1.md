# LINGUA OS — Knowledge Source Snapshot Policy V1

Status: knowledge-branch design/operations policy; no database import is authorized by this document.  
Scope: external language-data sources used to prepare English-for-Vietnamese A0–B1 catalog candidates.

## Why this policy exists

A URL or repository name is not enough provenance for durable learning data. Upstream files change, mirrors can lag, licences can differ between software and embedded data, and the same headword may be normalized differently by two importers. LINGUA OS therefore treats a **source snapshot** as the reproducible boundary between an external artifact and our candidate-generation pipeline.

This policy does not weaken the existing publication/provenance gate. It adds a stricter pre-import record for catalog knowledge.

## Snapshot manifest

Every external artifact considered for ingestion must have a committed manifest entry containing, at minimum:

- stable registry source ID;
- source/project name;
- exact release/version or retrieval date when no release exists;
- canonical homepage;
- exact artifact URL;
- artifact file name;
- SHA-256 of the bytes actually reviewed;
- byte size;
- media/file type;
- retrieval timestamp;
- observed schema/columns or format version;
- record count where deterministically measurable;
- licence/terms URL and attribution text;
- rights decision at snapshot time;
- parser/normalizer version;
- whether the raw artifact is stored, externally pinned, or intentionally not redistributed;
- reviewer notes and unresolved obligations.

A manifest can record third-party observations of a checksum, but such a checksum is **evidence only** until LINGUA OS independently fetches the canonical artifact and computes the same digest.

## Three trust states

### `observed_external`

A reputable independent repository or publication reports an artifact URL, size, checksum or row count. This helps triangulate the source but is not sufficient for production ingestion.

### `verified_lingua`

LINGUA OS fetched the canonical artifact itself, computed the digest, checked the schema and recorded the terms that applied at retrieval time. Only this state can feed a production candidate pipeline.

### `superseded`

A newer source release or changed rights statement exists. The old snapshot remains immutable for reproducibility, but no new candidates should be generated from it unless a review explicitly re-approves that historical version.

## CEFR-J 1.6 evidence currently available

The canonical artifact repeatedly reported by independent projects is:

`https://www.cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip`

Independent 2026 repositories report that Wordlist 1.6 is the 2020-03-24 release, contains 7,801 rows in the ALL sheet, and uses the columns `headword`, `pos`, `CEFR`, `CoreInventory 1`, `CoreInventory 2`, `Threshold`. One independently captured manifest reports:

- SHA-256: `c837d2c00ab8954ed8db48e79afd8ef37099570295fec36950dbf9322303a37a`
- size: `1089155` bytes

Those values are useful **cross-check evidence, not a LINGUA-pinned checksum**. Before our importer can mark CEFR-J 1.6 `verified_lingua`, it must re-fetch the official artifact and reproduce the digest/shape itself.

The Open Language Profiles GitHub mirror remains valuable for inspecting the CEFR-J schema and licence wording, but its vocabulary CSV is Version 1.5. It must never silently stand in for Version 1.6.

## Raw artifacts and repository policy

Do not automatically commit large or redistribution-sensitive source archives to this repository.

For each source choose one of these modes:

1. `commit_raw` — only when redistribution is clearly allowed, file size is reasonable, and committing the bytes materially improves reproducibility;
2. `manifest_only` — commit URL/hash/schema/count but require a fetch step to reconstruct the raw source;
3. `private_snapshot` — store the source outside the public/product tree when redistribution or access terms make repository inclusion inappropriate;
4. `reference_only` — no ingestion artifact at all; use the source only to inform human review.

The manifest must state which mode applies.

## Rights are part of snapshot identity

An artifact snapshot is not production-eligible merely because its checksum is stable. A production decision also requires:

- the data licence/permission, not just the parser/software licence;
- attribution requirements;
- ShareAlike or non-commercial restrictions;
- restrictions on redistribution, derived databases, audio re-hosting or identity use;
- upstream lineage for generated/aggregated datasets.

If these are uncertain, `usagePolicy` stays `unknown` or `restricted` and candidate application fails closed.

## Deterministic normalization

The raw snapshot must never be written directly into product tables. Pipeline stages are:

`source snapshot -> parser -> normalized candidate -> human/review gate -> preview diff -> apply`

The normalized candidate retains the snapshot ID, upstream record key, raw-payload hash where possible and transform version. A changed parser therefore produces a distinguishable lineage even if the source artifact did not change.

## Reproducibility checks

A source adapter should be considered ready only when all of the following are testable:

- same artifact + same transform version yields byte-stable normalized candidate output;
- malformed rows fail or quarantine deterministically;
- duplicate natural keys are surfaced, not silently overwritten;
- source-specific POS and level labels are preserved in evidence fields;
- slash variants/multi-word expressions are not split by an unsafe generic rule;
- record-level rights/provenance survive normalization;
- rerunning preview produces the same diff;
- rerunning apply is idempotent;
- no learner-state table can be touched by the knowledge import path.

## Source-specific notes

### CEFR-J

Use the official 1.6 artifact once independently pinned. Treat `(headword, POS)` as upstream evidence rather than a sense ID; the source does not provide definitions or sense distinctions. Preserve the raw POS and level even when our normalized concept requires review.

### Open English WordNet

Pin the edition (for example 2025) and exact JSON/LMF artifact. Never select the first synset automatically as a learner-facing meaning. Sense matching is a reviewed enrichment step.

### PanLex

Pin a CC0 snapshot and language-variety identifiers. Treat equivalences as translation candidates, not reviewed Vietnamese definitions.

### NGSL family

Pin the exact list and licence. Because current lists are distributed under CC BY-SA 4.0, keep raw rank/list data out of the production catalog until a deliberate ShareAlike packaging decision exists.

### Tatoeba / Wiktionary / audio sources

Rights may be record-specific or inherited from upstream data. A repository-level licence never substitutes for row-level or content-level provenance.

## Acceptance gate for a new source

A new source is not accepted because it has many records. Acceptance requires a stronger answer to all four questions:

1. **Pedagogical value:** what decision does this source improve?
2. **Identity/provenance:** can we reproduce exactly which bytes and records were used?
3. **Rights:** can the intended production use be justified and audited?
4. **Quality:** can noisy or ambiguous records be quarantined without weakening catalog invariants?

If any answer is missing, keep the source in research/reference/quarantine state.
