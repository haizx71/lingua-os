#!/usr/bin/env python3
"""Deterministic Audio Pronunciation Asset Manifest & SQL Generator for Knowledge System V2.

Generates canonical audio asset descriptors for all 830 lexical phonetic transcriptions
(415 concepts across en-US and en-GB) and all 96 Reader sentences (en-US), producing exactly
926 deterministic audio asset descriptors with UUIDv5 IDs, canonical storage paths,
and idempotent SQL for PostgreSQL migrations.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent
CATALOG_PATH = ROOT / "v2" / "compiled_catalog_candidate.v2.json"
PHONETICS_PATH = ROOT / "v2" / "phonetic_transcriptions.v2.json"
PACK_PATH = ROOT / "staging" / "pilot-reader-vi-pack-v1" / "bilingual_content_pack.v2.json"
OUTPUT_MANIFEST_PATH = ROOT / "v2" / "audio_assets_manifest.v2.json"

NS = uuid.UUID("4b47b8d6-0d44-4dc7-91c2-3d97f56e6040")


def stable_id(kind: str, key: str) -> str:
    """Generate a deterministic UUIDv5 identifier for a given entity kind and key."""
    return str(uuid.uuid5(NS, f"{kind}:{key}"))


def sql_quote(val: Any) -> str:
    """Safely format and quote a value for PostgreSQL literal insertion."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"


def build_audio_manifest_v2(base_dir: Path | None = None) -> dict[str, Any]:
    """Deterministically compile audio asset descriptors for lexical and sentence items."""
    b_dir = base_dir or ROOT
    c_path = b_dir / "v2" / "compiled_catalog_candidate.v2.json"
    p_path = b_dir / "v2" / "phonetic_transcriptions.v2.json"
    pack_path = b_dir / "staging" / "pilot-reader-vi-pack-v1" / "bilingual_content_pack.v2.json"

    catalog_data = json.loads(c_path.read_text(encoding="utf-8"))
    phonetics_data = json.loads(p_path.read_text(encoding="utf-8"))
    pack_data = json.loads(pack_path.read_text(encoding="utf-8"))

    # Build phonetic IPA lookup
    ipa_lookup: dict[tuple[str, str], str] = {}
    for profile in phonetics_data.get("profiles", []):
        ck = profile["conceptCanonicalKey"]
        for tr in profile.get("transcriptions", []):
            variant = tr.get("accentVariant", "").replace("_", "-")
            ipa_lookup[(ck, variant)] = tr["ipa"]
            # Also keep underscore variant
            ipa_lookup[(ck, tr.get("accentVariant", ""))] = tr["ipa"]

    assets: list[dict[str, Any]] = []

    # 1. 830 Lexical audio descriptors (415 concepts x 2 accents: en-US, en-GB)
    sorted_concepts = sorted(catalog_data["concepts"], key=lambda c: str(c["canonicalKey"]))

    for concept in sorted_concepts:
        ck = concept["canonicalKey"]
        concept_id = stable_id("concept", ck)
        transcript = concept.get("canonicalForm") or ck.split(":")[1]

        for accent in ("en-US", "en-GB"):
            storage_path = f"audio/v2/lexemes/{concept_id}/{accent}.mp3"
            audio_asset_id = stable_id("audio_asset", storage_path)
            storage_uri = f"https://audio.lingua-os.internal/{storage_path}"
            ipa = ipa_lookup.get((ck, accent))

            duration_ms = 1200
            content_key_raw = f"lexeme:{concept_id}:{accent}:{transcript}:{ipa}"
            content_sha256 = hashlib.sha256(content_key_raw.encode("utf-8")).hexdigest()

            voice_name = "neural-en-us-1" if accent == "en-US" else "neural-en-gb-1"
            speaker_metadata = {
                "accent": accent,
                "voice": voice_name,
                "engine": "lingua-neural-tts",
                "format": "mp3",
                "sample_rate_hz": 44100,
            }

            assets.append(
                {
                    "audio_asset_id": audio_asset_id,
                    "asset_type": "lexeme",
                    "concept_id": concept_id,
                    "concept_key": ck,
                    "sentence_id": None,
                    "article_id": None,
                    "accent": accent,
                    "language_code": "en",
                    "storage_path": storage_path,
                    "storage_uri": storage_uri,
                    "mime_type": "audio/mpeg",
                    "duration_ms": duration_ms,
                    "transcript": transcript,
                    "ipa": ipa,
                    "content_sha256": content_sha256,
                    "speaker_metadata": speaker_metadata,
                }
            )

    # 2. 96 Sentence audio descriptors (12 articles x 8 sentences, en-US)
    for article in pack_data["articles"]:
        art_id = article["article_id"]
        for sent in article["sentences"]:
            ordinal = sent["ordinal"]
            sentence_id = stable_id("sentence", f"{art_id}:{ordinal}")
            storage_path = f"audio/v2/sentences/{sentence_id}.mp3"
            audio_asset_id = stable_id("audio_asset", storage_path)
            storage_uri = f"https://audio.lingua-os.internal/{storage_path}"
            english_text = sent["english"]
            accent = "en-US"

            # Compute realistic speech duration (~350ms per token, min 1500ms)
            word_count = len(english_text.strip().split())
            duration_ms = max(1500, word_count * 350)

            content_key_raw = f"sentence:{sentence_id}:{english_text}"
            content_sha256 = hashlib.sha256(content_key_raw.encode("utf-8")).hexdigest()

            speaker_metadata = {
                "accent": accent,
                "voice": "neural-en-us-reader-1",
                "engine": "lingua-neural-tts",
                "format": "mp3",
                "sample_rate_hz": 44100,
                "article_id": art_id,
                "ordinal": ordinal,
            }

            assets.append(
                {
                    "audio_asset_id": audio_asset_id,
                    "asset_type": "sentence",
                    "concept_id": None,
                    "concept_key": None,
                    "sentence_id": sentence_id,
                    "article_id": art_id,
                    "accent": accent,
                    "language_code": "en",
                    "storage_path": storage_path,
                    "storage_uri": storage_uri,
                    "mime_type": "audio/mpeg",
                    "duration_ms": duration_ms,
                    "transcript": english_text,
                    "ipa": None,
                    "content_sha256": content_sha256,
                    "speaker_metadata": speaker_metadata,
                }
            )

    # Validate exact counts
    total_assets = len(assets)
    lexical_count = sum(1 for a in assets if a["asset_type"] == "lexeme")
    sentence_count = sum(1 for a in assets if a["asset_type"] == "sentence")
    us_count = sum(1 for a in assets if a["accent"] == "en-US")
    gb_count = sum(1 for a in assets if a["accent"] == "en-GB")

    if lexical_count != 830 or sentence_count != 96 or total_assets != 926:
        raise ValueError(
            f"Asset count mismatch: expected 830 lexical + 96 sentence = 926 total, "
            f"got {lexical_count} + {sentence_count} = {total_assets}"
        )

    canonical_serialized = json.dumps(assets, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest_sha256 = hashlib.sha256(canonical_serialized).hexdigest()

    return {
        "schemaVersion": "lingua.audio-assets-manifest.v2",
        "manifestReleaseId": "lingua-audio-manifest-a0-b1-v2.0.0",
        "updatedAt": "2026-10-15T00:00:00Z",
        "counts": {
            "totalAudioAssets": total_assets,
            "lexicalAudioAssets": lexical_count,
            "sentenceAudioAssets": sentence_count,
            "byAccent": {
                "en-US": us_count,
                "en-GB": gb_count,
            },
        },
        "provenance": {
            "authorName": "LINGUA OS Audio Engineering",
            "sourceName": "LINGUA OS Canonical Audio Assets V2 (A0-B1)",
            "licenseCode": "LINGUA-FIRST-PARTY-1.0",
            "storageBaseUri": "https://audio.lingua-os.internal",
        },
        "assets": assets,
        "manifestSha256": manifest_sha256,
    }


def generate_media_assets_sql(
    base_dir: Path | None = None, table_name: str = "media_assets"
) -> str:
    """Generate idempotent SQL inserting all 926 audio asset descriptors matching migration 0001."""
    manifest = build_audio_manifest_v2(base_dir)
    assets = manifest["assets"]
    source_record_id = "21000000-0000-4000-8000-000000000001"
    fixed_timestamp = "2026-10-15T00:00:00Z"

    cols = (
        "id, language_code, storage_uri, duration_ms, "
        "speaker_metadata, source_record_id, created_at"
    )
    lines: list[str] = [
        "-- LINGUA OS Audio/Media Assets SQL Apply Plan",
        f"-- Total Assets: {len(assets)} (830 Lexical + 96 Sentence)",
        "-- Columns match database/migrations/0001_core_schema_v1.up.sql",
        "",
        "BEGIN;",
        "",
    ]

    if table_name == "public.audio_assets":
        audio_src_id = stable_id("data_source", "lingua:audio:v2")
        lic_id = "10000000-0000-4000-8000-000000000001"
        lines.extend(
            [
                "-- Provenance (licenses, data_sources, source_records)",
                (
                    "INSERT INTO public.licenses "
                    "(id, code, name, usage_policy, attribution_required, created_at)"
                ),
                (
                    f"VALUES ('{lic_id}', 'LINGUA-FIRST-PARTY', "
                    f"'LINGUA OS First-Party Content', 'allowed', false, '{fixed_timestamp}')"
                ),
                "ON CONFLICT (id) DO NOTHING;",
                "",
                (
                    "INSERT INTO public.data_sources "
                    "(id, name, source_type, source_version, source_url, "
                    "license_id, attribution_text, created_at)"
                ),
                (
                    f"VALUES ('{audio_src_id}', "
                    f"'LINGUA OS Canonical Audio Assets V2 (A0-B1)', "
                    f"'internal', 'v2.0.0', 'https://audio.lingua-os.internal', "
                    f"'{lic_id}', 'Synthetic LINGUA OS first-party audio.', '{fixed_timestamp}')"
                ),
                "ON CONFLICT (id) DO NOTHING;",
                "",
                (
                    "INSERT INTO public.source_records "
                    "(id, source_id, source_record_key, raw_hash, transform_version, "
                    "quality_score, review_status, imported_at, reviewed_at, metadata)"
                ),
                (
                    f"VALUES ('{source_record_id}', '{audio_src_id}', "
                    f"'lingua-canonical-audio-v2', repeat('0', 64), 'audio-manifest-v2', "
                    f"1.0, 'approved', '{fixed_timestamp}', '{fixed_timestamp}', "
                    f'\'{{"asset_type": "audio"}}\'::jsonb)'
                ),
                "ON CONFLICT (id) DO NOTHING;",
                "",
            ]
        )

    lines.extend(
        [
            f"INSERT INTO {table_name} ({cols})",
            "VALUES",
        ]
    )

    value_rows: list[str] = []
    for asset in assets:
        aid = asset["audio_asset_id"]
        lang = asset["language_code"]
        uri = asset["storage_uri"]
        dur = asset["duration_ms"]
        meta = json.dumps(asset["speaker_metadata"], separators=(",", ":"))
        row = (
            f"    ('{aid}', '{lang}', {sql_quote(uri)}, {dur}, "
            f"{sql_quote(meta)}::jsonb, '{source_record_id}', '{fixed_timestamp}')"
        )
        value_rows.append(row)

    lines.append(",\n".join(value_rows))
    lines.extend(
        [
            "ON CONFLICT (id) DO UPDATE SET",
            "    storage_uri = EXCLUDED.storage_uri,",
            "    duration_ms = EXCLUDED.duration_ms,",
            "    speaker_metadata = EXCLUDED.speaker_metadata;",
            "",
            "COMMIT;",
            "",
        ]
    )

    return "\n".join(lines)


def generate_audio_assets_sql(base_dir: Path | None = None) -> str:
    """Generate idempotent SQL targeting the real public.audio_assets table."""
    return generate_media_assets_sql(base_dir, table_name="public.audio_assets")


def main() -> None:
    print("Building audio assets manifest v2...")
    manifest = build_audio_manifest_v2()
    counts = manifest["counts"]
    us_cnt = counts["byAccent"]["en-US"]
    gb_cnt = counts["byAccent"]["en-GB"]
    print(
        f"Generated {counts['totalAudioAssets']} assets: "
        f"{counts['lexicalAudioAssets']} lexical ({us_cnt} en-US, {gb_cnt} en-GB), "
        f"{counts['sentenceAudioAssets']} sentences."
    )
    OUTPUT_MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Successfully wrote manifest to {OUTPUT_MANIFEST_PATH}")


if __name__ == "__main__":
    main()
