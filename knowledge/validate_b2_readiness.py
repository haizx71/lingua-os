#!/usr/bin/env python3
"""Post-Pilot B2 Expansion Readiness Validator for LINGUA OS Knowledge System V2.

Verifies that during the current V2 Pilot Freeze, all contracts, schemas, and catalog
artifacts strictly enforce the A0-B1 boundary with zero B2 leaks.
Provides the authoritative 4-gate post-pilot checklist required to unlock B2 expansion.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent

CONTRACTS_ENUMS_PATH = REPO_ROOT / "contracts" / "enums.json"
CONTRACTS_OPENAPI_PATH = REPO_ROOT / "contracts" / "openapi.yaml"
CORE_SCHEMA_PATH = REPO_ROOT / "database" / "migrations" / "0001_core_schema_v1.up.sql"
CATALOG_CANDIDATE_PATH = ROOT / "v2" / "compiled_catalog_candidate.v2.json"

FROZEN_LEVELS = ("A0", "A1", "A2", "B1")


def evaluate_b2_readiness(repo_root: Path | None = None) -> dict[str, Any]:
    """Evaluate repository freeze compliance (strictly A0-B1) and return B2 expansion checklist."""
    r_root = repo_root or REPO_ROOT
    enums_path = r_root / "contracts" / "enums.json"
    openapi_path = r_root / "contracts" / "openapi.yaml"
    schema_path = r_root / "database" / "migrations" / "0001_core_schema_v1.up.sql"
    catalog_path = r_root / "knowledge" / "v2" / "compiled_catalog_candidate.v2.json"

    leaks: list[dict[str, str]] = []
    audit_findings: dict[str, Any] = {}

    # 1. Inspect contracts/enums.json
    enums_data = json.loads(enums_path.read_text(encoding="utf-8"))
    starting_bands = enums_data.get("starting_level_band", [])
    reader_levels = enums_data.get("reader_content_level", [])

    if "B2" in starting_bands:
        leaks.append(
            {
                "target": "contracts/enums.json",
                "field": "starting_level_band",
                "leak": "B2 present during pilot freeze",
            }
        )
    if "B2" in reader_levels:
        leaks.append(
            {
                "target": "contracts/enums.json",
                "field": "reader_content_level",
                "leak": "B2 present during pilot freeze",
            }
        )

    audit_findings["contracts_enums_json"] = {
        "starting_level_band": starting_bands,
        "reader_content_level": reader_levels,
        "b2_leaks_found": 1 if ("B2" in starting_bands or "B2" in reader_levels) else 0,
        "status": "freeze_compliant"
        if ("B2" not in starting_bands and "B2" not in reader_levels)
        else "leaked",
    }

    # 2. Inspect contracts/openapi.yaml
    openapi_text = openapi_path.read_text(encoding="utf-8")

    # Search for StartingLevelBand enum and ReaderContentLevel enum
    starting_band_match = re.search(
        r"StartingLevelBand:\s*\n\s*type:\s*string\s*\n\s*enum:\s*\[(.*?)\]",
        openapi_text,
    )
    reader_level_match = re.search(
        r"ReaderContentLevel:\s*\n\s*type:\s*string\s*\n\s*enum:\s*\[(.*?)\]",
        openapi_text,
    )

    openapi_b2_leaks = 0
    if starting_band_match and "B2" in starting_band_match.group(1).split(","):
        leaks.append(
            {
                "target": "contracts/openapi.yaml",
                "field": "StartingLevelBand",
                "leak": "B2 present during pilot freeze",
            }
        )
        openapi_b2_leaks += 1
    if reader_level_match and "B2" in reader_level_match.group(1).split(","):
        leaks.append(
            {
                "target": "contracts/openapi.yaml",
                "field": "ReaderContentLevel",
                "leak": "B2 present during pilot freeze",
            }
        )
        openapi_b2_leaks += 1

    audit_findings["contracts_openapi_yaml"] = {
        "starting_level_band_enum": [s.strip() for s in starting_band_match.group(1).split(",")]
        if starting_band_match
        else [],
        "reader_content_level_enum": [s.strip() for s in reader_level_match.group(1).split(",")]
        if reader_level_match
        else [],
        "b2_leaks_found": openapi_b2_leaks,
        "status": "freeze_compliant" if openapi_b2_leaks == 0 else "leaked",
    }

    # 3. Inspect database/migrations/0001_core_schema_v1.up.sql
    schema_text = schema_path.read_text(encoding="utf-8")
    # Match rows inserted into proficiency_levels
    pl_matches = re.findall(
        r"\('[0-9a-f-]+',\s*'[^']+',\s*'([A-Z0-9]+)',\s*'[^']+',\s*(\d+)",
        schema_text,
    )
    db_level_codes = [m[0] for m in pl_matches]
    db_b2_leaks = 1 if "B2" in db_level_codes else 0
    if db_b2_leaks:
        leaks.append(
            {
                "target": "database/migrations/0001_core_schema_v1.up.sql",
                "field": "proficiency_levels",
                "leak": "B2 inserted during pilot freeze",
            }
        )

    audit_findings["database_migration_0001"] = {
        "seeded_levels": db_level_codes,
        "b2_leaks_found": db_b2_leaks,
        "status": "freeze_compliant" if db_b2_leaks == 0 else "leaked",
    }

    # 4. Inspect knowledge/v2/compiled_catalog_candidate.v2.json
    catalog_data = json.loads(catalog_path.read_text(encoding="utf-8"))
    counts_by_band = catalog_data["summary"].get("countsByCefrBand", {})
    concepts = catalog_data.get("concepts", [])

    catalog_b2_leaks = 0
    if "LINGUA_B2" in counts_by_band or "B2" in counts_by_band:
        catalog_b2_leaks += 1

    for c in concepts:
        band = c.get("curriculumBand", "")
        if "B2" in band or band.upper() == "LINGUA_B2":
            catalog_b2_leaks += 1

    if catalog_b2_leaks > 0:
        leaks.append(
            {
                "target": "knowledge/v2/compiled_catalog_candidate.v2.json",
                "field": "curriculumBand",
                "leak": f"{catalog_b2_leaks} B2 concepts detected during pilot freeze",
            }
        )

    audit_findings["knowledge_v2_catalog"] = {
        "counts_by_band": counts_by_band,
        "b2_leaks_found": catalog_b2_leaks,
        "status": "freeze_compliant" if catalog_b2_leaks == 0 else "leaked",
    }

    active_b2_leaks = len(leaks)
    freeze_compliant = active_b2_leaks == 0

    post_pilot_b2_checklist = {
        "database_migration_proficiency_levels": {
            "status": "pending_post_pilot",
            "gate_order": 1,
            "description": (
                "Author and apply forward migration 0023+ inserting 'B2' into "
                "proficiency_levels (framework CEFR, code 'B2', rank_order 4, "
                "bounds 0.8000-1.0000) and updating Reader gate check in 0005 "
                "to permit B2 content items."
            ),
            "file": "database/migrations/0023_add_b2_proficiency_level.up.sql",
            "action_required": "Forward PostgreSQL migration with immutable rollback down script",
        },
        "contracts_enums_json": {
            "status": "pending_post_pilot",
            "gate_order": 2,
            "description": (
                "Synchronized update adding 'B2' to 'starting_level_band' and "
                "'reader_content_level' in contracts/enums.json once database "
                "migration is applied."
            ),
            "file": "contracts/enums.json",
            "action_required": "Append 'B2' to authoritative contract enum registry",
        },
        "contracts_openapi_yaml": {
            "status": "pending_post_pilot",
            "gate_order": 3,
            "description": (
                "Synchronized schema regeneration adding 'B2' to StartingLevelBand and "
                "ReaderContentLevel enum schemas in contracts/openapi.yaml."
            ),
            "file": "contracts/openapi.yaml",
            "action_required": "Update OpenAPI schema definitions to match contracts/enums.json",
        },
        "knowledge_v2_curriculum_band": {
            "status": "pending_post_pilot",
            "gate_order": 4,
            "description": (
                "Compile and publish B2 curriculum band concepts, phonetic profiles, and bilingual "
                "micro-articles in knowledge compiler with verified DAG acyclicity."
            ),
            "file": "knowledge/v2/compiled_catalog_candidate.v2.json",
            "action_required": "Unlock B2 lexical, grammar, and bilingual reader packs post-pilot",
        },
    }

    return {
        "freeze_compliant": freeze_compliant,
        "active_b2_leaks": active_b2_leaks,
        "leaks": leaks,
        "frozen_levels_enforced": list(FROZEN_LEVELS),
        "audit_findings": audit_findings,
        "post_pilot_b2_checklist": post_pilot_b2_checklist,
    }


def main() -> None:
    print("Evaluating B2 Readiness and Pilot Freeze Compliance...")
    report = evaluate_b2_readiness()
    print(f"Freeze Compliant: {report['freeze_compliant']}")
    print(f"Active B2 Leaks: {report['active_b2_leaks']}")
    print(f"Post-Pilot Checklist Gates Documented: {len(report['post_pilot_b2_checklist'])}")
    for gate_name, gate_info in report["post_pilot_b2_checklist"].items():
        print(f"  - [{gate_info['gate_order']}] {gate_name}: {gate_info['status']}")


if __name__ == "__main__":
    main()
