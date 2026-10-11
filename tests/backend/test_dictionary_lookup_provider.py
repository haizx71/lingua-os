from __future__ import annotations

import json
import os
import sqlite3
from hashlib import sha256
from pathlib import Path

import pytest
from lingua_api.dictionary.lookup import (
    ARTIFACT_FORMAT_VERSION,
    ARTIFACT_PATH_ENV,
    ARTIFACT_SHA256_ENV,
    MAX_LOOKUP_RECORD_BYTES,
    MAX_LOOKUP_TOTAL_SENSES,
    NORMALIZATION_VERSION,
    DictionaryLookupResultTooLarge,
    DictionaryLookupUnavailable,
    SQLiteDictionaryLookupProvider,
)


def _record(surface: str, sense_count: int = 1) -> dict[str, object]:
    return {
        "matched_surface": surface,
        "part_of_speech": "noun",
        "senses": [
            {"sense_order": order, "gloss_vi": f"nghĩa {order}"}
            for order in range(1, sense_count + 1)
        ],
        "attributions": [
            {
                "source_name": "First-party synthetic test data",
                "source_url": "https://example.test/dictionary/tea",
                "license_code": "CC0-1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                "attribution_text": "Synthetic test record; no external source used.",
                "change_notice": "Authored for a local provider test.",
            }
        ],
    }


def _write_artifact(
    path: Path,
    records: list[tuple[str, int, dict[str, object]]],
    *,
    approval_status: str = "approved",
) -> None:
    connection = sqlite3.connect(path)
    try:
        with connection:
            connection.execute(
                "CREATE TABLE artifact_manifest (name TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            connection.execute(
                """CREATE TABLE lexical_entries (
                    normalized_surface TEXT NOT NULL,
                    entry_order INTEGER NOT NULL,
                    record_json TEXT NOT NULL,
                    PRIMARY KEY (normalized_surface, entry_order)
                )"""
            )
            connection.execute(
                "CREATE INDEX lexical_entries_surface_idx ON lexical_entries(normalized_surface)"
            )
            connection.executemany(
                "INSERT INTO artifact_manifest(name, value) VALUES (?, ?)",
                [
                    ("artifact_format_version", ARTIFACT_FORMAT_VERSION),
                    ("normalization_version", NORMALIZATION_VERSION),
                    ("approval_status", approval_status),
                    ("record_manifest_sha256", "a" * 64),
                ],
            )
            connection.executemany(
                """INSERT INTO lexical_entries(normalized_surface, entry_order, record_json)
                   VALUES (?, ?, ?)""",
                [
                    (surface, order, json.dumps(record, ensure_ascii=False))
                    for surface, order, record in records
                ],
            )
    finally:
        connection.close()
    path.chmod(0o444)


def _provider(path: Path) -> SQLiteDictionaryLookupProvider:
    return SQLiteDictionaryLookupProvider(
        path, expected_sha256=sha256(path.read_bytes()).hexdigest()
    )


def test_provider_reads_exact_indexed_rows_without_mutating_artifact(tmp_path: Path) -> None:
    artifact = tmp_path / "reviewed-test.sqlite3"
    _write_artifact(
        artifact,
        [
            ("café", 1, _record("café", sense_count=2)),
            ("teacup", 1, _record("teacup")),
        ],
    )
    before = sha256(artifact.read_bytes()).hexdigest()
    provider = _provider(artifact)

    exact = provider.lookup("café")
    prefix_only = provider.lookup("tea")

    assert exact.match_status == "found"
    assert [sense.gloss_vi for sense in exact.entries[0].senses] == ["nghĩa 1", "nghĩa 2"]
    assert prefix_only.match_status == "not_found"
    assert prefix_only.entries == []
    assert sha256(artifact.read_bytes()).hexdigest() == before


def test_provider_rejects_artifact_without_approval_status(tmp_path: Path) -> None:
    artifact = tmp_path / "held-test.sqlite3"
    _write_artifact(artifact, [("tea", 1, _record("tea"))], approval_status="held")

    with pytest.raises(DictionaryLookupUnavailable):
        _provider(artifact).lookup("tea")


def test_provider_fails_closed_instead_of_truncating_total_senses(tmp_path: Path) -> None:
    artifact = tmp_path / "oversized-test.sqlite3"
    first_count = 32
    second_count = 32
    last_count = MAX_LOOKUP_TOTAL_SENSES - first_count - second_count + 1
    _write_artifact(
        artifact,
        [
            ("tea", 1, _record("tea", sense_count=first_count)),
            ("tea", 2, _record("tea", sense_count=second_count)),
            ("tea", 3, _record("tea", sense_count=last_count)),
        ],
    )

    with pytest.raises(DictionaryLookupResultTooLarge):
        _provider(artifact).lookup("tea")


def test_provider_rejects_oversized_raw_record_before_json_parsing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact = tmp_path / "oversized-record-test.sqlite3"
    record = _record("tea")
    record["padding"] = "x" * (MAX_LOOKUP_RECORD_BYTES + 1)
    _write_artifact(artifact, [("tea", 1, record)])

    def unexpected_json_parse(_: str) -> object:
        pytest.fail("oversized record must be rejected before Python JSON parsing")

    monkeypatch.setattr("lingua_api.dictionary.lookup.json.loads", unexpected_json_parse)
    with pytest.raises(DictionaryLookupResultTooLarge):
        _provider(artifact).lookup("tea")


def test_provider_requires_a_separately_trusted_artifact_digest(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact = tmp_path / "trusted-test.sqlite3"
    _write_artifact(artifact, [("tea", 1, _record("tea"))])
    monkeypatch.setenv(ARTIFACT_PATH_ENV, str(artifact))

    monkeypatch.delenv(ARTIFACT_SHA256_ENV, raising=False)
    assert SQLiteDictionaryLookupProvider.from_environment() is None

    # The artifact's own manifest contains this self-asserted value; it is not trust.
    monkeypatch.setenv(ARTIFACT_SHA256_ENV, "a" * 64)
    assert SQLiteDictionaryLookupProvider.from_environment() is None

    expected_sha256 = sha256(artifact.read_bytes()).hexdigest()
    monkeypatch.setenv(ARTIFACT_SHA256_ENV, expected_sha256)
    provider = SQLiteDictionaryLookupProvider.from_environment()

    assert provider is not None
    assert provider.lookup("tea").match_status == "found"


def test_provider_rejects_artifact_identity_change_after_startup(tmp_path: Path) -> None:
    artifact = tmp_path / "replaceable-test.sqlite3"
    replacement = tmp_path / "replacement-test.sqlite3"
    _write_artifact(artifact, [("tea", 1, _record("tea"))])
    _write_artifact(replacement, [("coffee", 1, _record("coffee"))])
    provider = _provider(artifact)

    artifact.chmod(0o644)
    os.replace(replacement, artifact)

    with pytest.raises(DictionaryLookupUnavailable):
        provider.lookup("tea")


def test_provider_does_not_rehash_the_artifact_per_lookup(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact = tmp_path / "no-per-request-hash.sqlite3"
    _write_artifact(artifact, [("tea", 1, _record("tea"))])
    provider = _provider(artifact)

    def unexpected_hash(_path: Path) -> tuple[str, tuple[int, int, int, int, int, int]]:
        pytest.fail("the complete artifact must not be hashed for each request")

    monkeypatch.setattr("lingua_api.dictionary.lookup._stream_sha256", unexpected_hash)

    assert provider.lookup("tea").match_status == "found"
