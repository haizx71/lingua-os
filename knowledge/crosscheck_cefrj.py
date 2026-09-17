#!/usr/bin/env python3
"""Cross-check LINGUA candidate concepts against a pinned CEFR-J source artifact.

This tool is deliberately read-only. It does not mutate candidate packs or any database.
It accepts CEFR-J CSV, XLSX, or the official ZIP containing an XLSX workbook and emits a
machine-readable evidence report.

Typical use once the official artifact has been fetched locally::

    python knowledge/crosscheck_cefrj.py \
      --source .runtime/CEFRJ_wordlist_ver1.6.zip \
      --source-version 1.6 \
      --pack knowledge/first_party_starter_inventory.v1.json \
      --pack knowledge/first_party_content_support.v1.json \
      --output .runtime/cefrj-crosscheck-v1.json

The report is evidence, not an automatic curriculum rewrite. Any mismatch remains a review
item until a human accepts a level/source decision.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET

LEVEL_TO_RANK = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
BAND_TO_LEVEL = {
    "LINGUA_A0": None,
    "LINGUA_A1": "A1",
    "LINGUA_A2": "A2",
    "LINGUA_B1": "B1",
}
POS_ALIASES = {
    "noun": {"noun"},
    "verb": {"verb", "be-verb"},
    "adjective": {"adjective"},
    "adverb": {"adverb"},
    "pronoun": {"pronoun"},
    "determiner": {"determiner"},
    "preposition": {"preposition"},
    "conjunction": {"conjunction"},
    "interjection": {"interjection"},
    "numeral": {"numeral", "number"},
    "modal": {"modal auxiliary", "modal verb", "modal"},
    "particle": {"particle", "infinitive-to"},
}
SPACE_RE = re.compile(r"\s+")
XLSX_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


class CrosscheckError(Exception):
    pass


@dataclass(frozen=True)
class SourceRow:
    row_number: int
    headword: str
    pos: str
    level: str
    core_inventory_1: str | None
    core_inventory_2: str | None
    threshold: str | None

    @property
    def aliases(self) -> tuple[str, ...]:
        """Return conservative lookup aliases while retaining raw headword as authority.

        CEFR-J deliberately stores spelling variants using `/` (for example
        `realize/realise`). We expose those pieces for lookup only; they never become
        independent source records and the raw form is always retained in the report.
        """
        raw = normalize_form(self.headword)
        aliases = {raw}
        if "/" in raw:
            parts = [normalize_form(part) for part in raw.split("/")]
            if 1 < len(parts) <= 6 and all(part and len(part) <= 80 for part in parts):
                aliases.update(parts)
        return tuple(sorted(aliases))


def normalize_form(value: str) -> str:
    return SPACE_RE.sub(" ", value.strip()).casefold()


def normalize_pos(value: str) -> str:
    return SPACE_RE.sub(" ", value.strip()).casefold()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_csv(data: str) -> list[SourceRow]:
    reader = csv.DictReader(io.StringIO(data))
    if reader.fieldnames is None:
        raise CrosscheckError("CEFR-J CSV has no header")
    normalized = {name.strip().casefold(): name for name in reader.fieldnames if name}
    required = {"headword", "pos", "cefr"}
    if not required.issubset(normalized):
        raise CrosscheckError(
            f"CEFR-J CSV requires headword,pos,CEFR; got {reader.fieldnames!r}"
        )

    def value(row: dict[str, str | None], *names: str) -> str | None:
        for name in names:
            original = normalized.get(name.casefold())
            if original is not None:
                raw = row.get(original)
                if raw is not None and raw.strip():
                    return raw.strip()
        return None

    rows: list[SourceRow] = []
    for index, row in enumerate(reader, start=2):
        headword = value(row, "headword")
        pos = value(row, "pos")
        level = value(row, "cefr")
        if not headword or not pos or not level:
            continue
        level = level.upper()
        if level not in LEVEL_TO_RANK:
            continue
        rows.append(
            SourceRow(
                row_number=index,
                headword=headword,
                pos=pos,
                level=level,
                core_inventory_1=value(row, "coreinventory 1", "coreinventory1"),
                core_inventory_2=value(row, "coreinventory 2", "coreinventory2"),
                threshold=value(row, "threshold"),
            )
        )
    if not rows:
        raise CrosscheckError("CEFR-J source contains no usable rows")
    return rows


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        data = archive.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    strings: list[str] = []
    for item in root.findall(f"{XLSX_NS}si"):
        pieces = [node.text or "" for node in item.iter(f"{XLSX_NS}t")]
        strings.append("".join(pieces))
    return strings


def _xlsx_sheet_targets(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    relation_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{PKG_REL_NS}Relationship")
    }
    targets: dict[str, str] = {}
    for sheet in workbook.findall(f".//{XLSX_NS}sheet"):
        name = sheet.attrib.get("name")
        relation_id = sheet.attrib.get(f"{REL_NS}id")
        target = relation_targets.get(relation_id or "")
        if not name or not target:
            continue
        target = target.lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        targets[name] = target
    return targets


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{XLSX_NS}t"))
    value = cell.find(f"{XLSX_NS}v")
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared[int(value.text)]
        except (ValueError, IndexError):
            raise CrosscheckError("invalid XLSX shared-string reference") from None
    return value.text


def _column_index(reference: str) -> int:
    letters = "".join(ch for ch in reference if ch.isalpha()).upper()
    result = 0
    for ch in letters:
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def parse_xlsx_bytes(data: bytes) -> list[SourceRow]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        targets = _xlsx_sheet_targets(archive)
        sheet_name = "ALL_sep" if "ALL_sep" in targets else "ALL" if "ALL" in targets else None
        if sheet_name is None:
            raise CrosscheckError(f"CEFR-J workbook lacks ALL_sep/ALL sheet: {sorted(targets)}")
        shared = _xlsx_shared_strings(archive)
        root = ET.fromstring(archive.read(targets[sheet_name]))
        table: list[list[str]] = []
        row_numbers: list[int] = []
        for row in root.findall(f".//{XLSX_NS}row"):
            values: dict[int, str] = {}
            for cell in row.findall(f"{XLSX_NS}c"):
                reference = cell.attrib.get("r", "")
                if not reference:
                    continue
                values[_column_index(reference)] = _cell_value(cell, shared)
            if values:
                width = max(values) + 1
                table.append([values.get(index, "") for index in range(width)])
                row_numbers.append(int(row.attrib.get("r", len(row_numbers) + 1)))
        if not table:
            raise CrosscheckError("CEFR-J workbook sheet is empty")

    header = [value.strip().casefold() for value in table[0]]
    index_by_name = {name: index for index, name in enumerate(header) if name}
    required = {"headword", "pos", "cefr"}
    if not required.issubset(index_by_name):
        raise CrosscheckError(f"CEFR-J XLSX requires {sorted(required)}, got {header!r}")

    def get(row: list[str], *names: str) -> str | None:
        for name in names:
            index = index_by_name.get(name.casefold())
            if index is not None and index < len(row):
                value = row[index].strip()
                if value:
                    return value
        return None

    rows: list[SourceRow] = []
    for row_number, row in zip(row_numbers[1:], table[1:]):
        headword = get(row, "headword")
        pos = get(row, "pos")
        level = get(row, "cefr")
        if not headword or not pos or not level:
            continue
        level = level.upper()
        if level not in LEVEL_TO_RANK:
            continue
        rows.append(
            SourceRow(
                row_number=row_number,
                headword=headword,
                pos=pos,
                level=level,
                core_inventory_1=get(row, "coreinventory 1", "coreinventory1"),
                core_inventory_2=get(row, "coreinventory 2", "coreinventory2"),
                threshold=get(row, "threshold"),
            )
        )
    if not rows:
        raise CrosscheckError("CEFR-J workbook contains no usable rows")
    return rows


def load_source(path: Path) -> tuple[list[SourceRow], str]:
    suffix = path.suffix.casefold()
    if suffix == ".csv":
        return parse_csv(path.read_text(encoding="utf-8-sig")), "csv"
    if suffix == ".xlsx":
        return parse_xlsx_bytes(path.read_bytes()), "xlsx"
    if suffix == ".zip":
        with zipfile.ZipFile(path) as archive:
            names = sorted(name for name in archive.namelist() if name.casefold().endswith(".xlsx"))
            if len(names) != 1:
                raise CrosscheckError(
                    f"expected exactly one XLSX in CEFR-J ZIP; found {names!r}"
                )
            return parse_xlsx_bytes(archive.read(names[0])), "zip+xlsx"
    raise CrosscheckError("--source must be .csv, .xlsx, or .zip")


def load_pack(path: Path) -> list[dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    concepts = data.get("concepts")
    if not isinstance(concepts, list):
        raise CrosscheckError(f"{path}: missing concepts list")
    result: list[dict[str, object]] = []
    for concept in concepts:
        if isinstance(concept, dict):
            copied = dict(concept)
            copied["_pack"] = path.name
            result.append(copied)
    return result


def source_index(rows: Iterable[SourceRow]) -> dict[str, list[SourceRow]]:
    index: dict[str, list[SourceRow]] = defaultdict(list)
    for row in rows:
        for alias in row.aliases:
            index[alias].append(row)
    return index


def _matching_rows(concept: dict[str, object], index: dict[str, list[SourceRow]]) -> tuple[list[SourceRow], str]:
    form = concept.get("canonicalForm")
    if not isinstance(form, str):
        return [], "invalid-form"
    candidates = list(index.get(normalize_form(form), []))
    concept_type = concept.get("conceptType")
    if concept_type != "word":
        return candidates, "form-only"
    pos = concept.get("partOfSpeech")
    if not isinstance(pos, str):
        return [], "missing-pos"
    allowed = POS_ALIASES.get(normalize_pos(pos), {normalize_pos(pos)})
    pos_matches = [row for row in candidates if normalize_pos(row.pos) in allowed]
    if pos_matches:
        return pos_matches, "form+pos"
    return candidates, "form-pos-mismatch" if candidates else "form+pos"


def crosscheck(
    rows: list[SourceRow],
    concepts: list[dict[str, object]],
    *,
    source_path: Path,
    source_version: str,
    source_format: str,
) -> dict[str, object]:
    index = source_index(rows)
    records: list[dict[str, object]] = []
    counts: Counter[str] = Counter()

    for concept in concepts:
        key = concept.get("canonicalKey")
        form = concept.get("canonicalForm")
        concept_type = concept.get("conceptType")
        band = concept.get("curriculumBand")
        proposed_level = BAND_TO_LEVEL.get(str(band))

        if band == "LINGUA_A0":
            status = "A0_INTERNAL"
            matches: list[SourceRow] = []
            match_mode = "not-applicable"
        elif concept_type not in {"word", "phrase"}:
            status = "NON_LEXICAL_REVIEW"
            matches = []
            match_mode = "not-applicable"
        else:
            matches, match_mode = _matching_rows(concept, index)
            if not matches:
                status = "POS_MISMATCH" if match_mode == "form-pos-mismatch" else "NOT_FOUND"
            else:
                levels = sorted({row.level for row in matches}, key=lambda level: LEVEL_TO_RANK[level])
                if len(levels) > 1:
                    status = "AMBIGUOUS"
                elif proposed_level is None:
                    status = "A0_INTERNAL"
                elif levels[0] == proposed_level:
                    status = "AGREES"
                elif LEVEL_TO_RANK[levels[0]] < LEVEL_TO_RANK[proposed_level]:
                    status = "SOURCE_LOWER"
                else:
                    status = "SOURCE_HIGHER"

        counts[status] += 1
        records.append(
            {
                "canonicalKey": key,
                "canonicalForm": form,
                "conceptType": concept_type,
                "partOfSpeech": concept.get("partOfSpeech"),
                "pack": concept.get("_pack"),
                "proposedBand": band,
                "proposedLevel": proposed_level,
                "status": status,
                "matchMode": match_mode,
                "sourceMatches": [
                    {
                        "rowNumber": row.row_number,
                        "headword": row.headword,
                        "pos": row.pos,
                        "level": row.level,
                        "coreInventory1": row.core_inventory_1,
                        "coreInventory2": row.core_inventory_2,
                        "threshold": row.threshold,
                    }
                    for row in matches
                ],
            }
        )

    return {
        "schemaVersion": "cefrj-crosscheck.v1",
        "mode": "evidence-only",
        "source": {
            "path": str(source_path),
            "version": source_version,
            "format": source_format,
            "sha256": sha256_file(source_path),
            "usableRows": len(rows),
        },
        "packs": sorted({str(c.get("_pack")) for c in concepts}),
        "summary": dict(sorted(counts.items())),
        "records": records,
        "guardrail": "This report never mutates curriculum levels automatically; mismatches and ambiguities require review.",
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--source-version", required=True)
    parser.add_argument("--pack", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        rows, source_format = load_source(args.source)
        concepts = [concept for path in args.pack for concept in load_pack(path)]
        report = crosscheck(
            rows,
            concepts,
            source_path=args.source,
            source_version=args.source_version,
            source_format=source_format,
        )
    except (OSError, json.JSONDecodeError, zipfile.BadZipFile, ET.ParseError, CrosscheckError) as error:
        print(f"CEFR-J CROSSCHECK: FAIL: {error}", file=sys.stderr)
        return 1

    encoded = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    print("CEFR-J CROSSCHECK: PASS")
    print(json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
