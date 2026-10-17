"""Deterministic integrity validator for the LINGUA OS Bilingual Reader Content Pack v1."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

PACK_PATH = (
    Path(__file__).resolve().parent
    / "staging"
    / "pilot-reader-vi-pack-v1"
    / "bilingual_content_pack.v1.json"
)
ALLOWED_LEVELS = {"A0", "A1", "A2", "B1"}


def validate_bilingual_pack(path: Path = PACK_PATH) -> dict[str, Any]:
    raw_bytes = path.read_bytes()
    pack_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    payload = json.loads(raw_bytes.decode("utf-8"))

    if payload.get("schema_version") != "lingua.pilot.bilingual-reader-pack.v1":
        raise ValueError("Invalid bilingual pack schema_version")
    if payload.get("language") != "en" or payload.get("translation_language") != "vi":
        raise ValueError("Invalid bilingual pack language pair")

    provenance = payload.get("provenance", {})
    for field in (
        "authorName",
        "sourceName",
        "sourceVersion",
        "licenseCode",
        "attributionText",
        "rightsStatement",
    ):
        value = provenance.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Missing provenance field: {field}")

    articles = payload.get("articles")
    if not isinstance(articles, list) or len(articles) < 3:
        raise ValueError("Bilingual pack must contain at least 3 graded articles")

    seen_ids: set[str] = set()
    total_sentences = 0
    levels_covered: set[str] = set()

    for article in articles:
        article_id = article.get("article_id")
        if not isinstance(article_id, str) or not article_id.strip() or article_id in seen_ids:
            raise ValueError(f"Invalid or duplicate article_id: {article_id}")
        seen_ids.add(article_id)

        level = article.get("level")
        if level not in ALLOWED_LEVELS:
            raise ValueError(f"Unsupported CEFR level: {level}")
        levels_covered.add(str(level))

        sentences = article.get("sentences")
        if not isinstance(sentences, list) or not sentences:
            raise ValueError(f"Article {article_id} has no sentences")

        for expected_ordinal, sentence in enumerate(sentences, start=1):
            if sentence.get("ordinal") != expected_ordinal:
                raise ValueError(
                    f"Article {article_id} sentence ordinal mismatch at {expected_ordinal}"
                )
            en = sentence.get("english")
            vi = sentence.get("vietnamese")
            if not isinstance(en, str) or not en.strip():
                raise ValueError(f"Article {article_id} ordinal {expected_ordinal} empty English")
            if not isinstance(vi, str) or not vi.strip():
                raise ValueError(
                    f"Article {article_id} ordinal {expected_ordinal} empty Vietnamese"
                )
            concepts = sentence.get("concepts")
            if not isinstance(concepts, list) or not concepts:
                raise ValueError(
                    f"Article {article_id} ordinal {expected_ordinal} missing target concepts"
                )
            total_sentences += 1

    return {
        "pack_id": payload["pack_id"],
        "pack_sha256": pack_sha256,
        "article_count": len(articles),
        "total_sentences": total_sentences,
        "levels_covered": sorted(levels_covered),
    }


if __name__ == "__main__":
    summary = validate_bilingual_pack()
    print(json.dumps(summary, indent=2, ensure_ascii=False))
