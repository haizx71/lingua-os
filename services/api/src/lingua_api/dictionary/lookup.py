"""Read-only exact-word lookup over a reviewed, indexed lexical artifact."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import stat
import unicodedata
from contextlib import closing
from pathlib import Path
from typing import Protocol
from urllib.parse import unquote

from pydantic import ValidationError

from lingua_api.dictionary.lookup_models import (
    DictionaryLookupEntryDto,
    DictionaryLookupMatchStatusDto,
    DictionaryLookupResultDto,
)

LOOKUP_PATH = "/v1/dictionary/lookup"
MAX_LOOKUP_SURFACE_CHARS = 80
MAX_LOOKUP_ENTRIES = 8
MAX_LOOKUP_SENSES_PER_ENTRY = 32
MAX_LOOKUP_TOTAL_SENSES = 64
MAX_LOOKUP_RESPONSE_BYTES = 64 * 1024
MAX_LOOKUP_RECORD_BYTES = MAX_LOOKUP_RESPONSE_BYTES
ARTIFACT_FORMAT_VERSION = "1"
NORMALIZATION_VERSION = f"nfkc-casefold-v1+unicode-{unicodedata.unidata_version}"
ARTIFACT_PATH_ENV = "LINGUA_DICTIONARY_LOOKUP_ARTIFACT_PATH"
ARTIFACT_SHA256_ENV = "LINGUA_DICTIONARY_LOOKUP_ARTIFACT_SHA256"
MAX_LOOKUP_REQUEST_BYTES = 1024
_ARTIFACT_HASH_CHUNK_BYTES = 1024 * 1024

# ASCII/curly apostrophes and Unicode hyphen/dash joiners accepted by the Reader tokenizer.
_JOINERS = frozenset("'\u2019\u2010\u2011\u2012\u2013-")
_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")


class DictionaryLookupInputError(ValueError):
    """The supplied surface is not one bounded lexical token."""


class DictionaryLookupUnavailable(Exception):
    """The reviewed lexical artifact is absent, invalid, or unavailable."""


class DictionaryLookupResultTooLarge(DictionaryLookupUnavailable):
    """A complete exact result exceeds the public response bounds."""


class DictionaryLookupProvider(Protocol):
    def lookup(self, normalized_surface: str) -> DictionaryLookupResultDto: ...


def _file_identity(path: Path) -> tuple[int, int, int, int, int, int]:
    metadata = path.stat()
    if not stat.S_ISREG(metadata.st_mode):
        raise DictionaryLookupUnavailable
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
        stat.S_IMODE(metadata.st_mode),
    )


def _stream_sha256(path: Path) -> tuple[str, tuple[int, int, int, int, int, int]]:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as artifact:
            before = _file_identity(path)
            opened_before = _file_identity_from_stat(os.fstat(artifact.fileno()))
            if not _same_cross_api_identity(before, opened_before):
                raise DictionaryLookupUnavailable
            for chunk in iter(lambda: artifact.read(_ARTIFACT_HASH_CHUNK_BYTES), b""):
                digest.update(chunk)
            opened_after = _file_identity_from_stat(os.fstat(artifact.fileno()))
            after = _file_identity(path)
    except OSError as error:
        raise DictionaryLookupUnavailable from error
    if before != after or opened_before != opened_after:
        raise DictionaryLookupUnavailable
    if not _same_cross_api_identity(after, opened_after):
        raise DictionaryLookupUnavailable
    if after[-1] & 0o222:
        raise DictionaryLookupUnavailable
    return digest.hexdigest(), after


def _file_identity_from_stat(
    metadata: os.stat_result,
) -> tuple[int, int, int, int, int, int]:
    if (
        not stat.S_ISREG(metadata.st_mode)
        or metadata.st_dev <= 0
        or metadata.st_ino <= 0
        or metadata.st_size < 0
    ):
        raise DictionaryLookupUnavailable
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_ctime_ns,
        stat.S_IMODE(metadata.st_mode),
    )


def _same_cross_api_identity(
    path_identity: tuple[int, int, int, int, int, int],
    handle_identity: tuple[int, int, int, int, int, int],
) -> bool:
    # Windows path.stat() and fstat() expose different ctime semantics.
    return path_identity[:4] == handle_identity[:4] and path_identity[5] == handle_identity[5]


def normalize_dictionary_surface(surface: str) -> str:
    if not surface or len(surface) > MAX_LOOKUP_SURFACE_CHARS:
        raise DictionaryLookupInputError("surface is outside the supported bounds")
    normalized = unicodedata.normalize("NFKC", surface).casefold()
    if not normalized or len(normalized) > MAX_LOOKUP_SURFACE_CHARS:
        raise DictionaryLookupInputError("surface is outside the supported bounds")

    has_letter = False
    previous_was_joiner = True
    for character in normalized:
        category = unicodedata.category(character)
        if category.startswith("L"):
            has_letter = True
            previous_was_joiner = False
        elif category.startswith("M") and not previous_was_joiner:
            previous_was_joiner = False
        elif character in _JOINERS and not previous_was_joiner:
            previous_was_joiner = True
        else:
            raise DictionaryLookupInputError("surface must contain one lexical word")
    if not has_letter or previous_was_joiner:
        raise DictionaryLookupInputError("surface must contain one lexical word")
    return normalized


class SQLiteDictionaryLookupProvider:
    """Reads a trusted, immutable artifact using exact indexed keys."""

    def __init__(self, artifact_path: Path, expected_sha256: str | None = None) -> None:
        if expected_sha256 is None or not _SHA256_PATTERN.fullmatch(expected_sha256):
            raise DictionaryLookupUnavailable
        self._artifact_path = artifact_path.expanduser().resolve()
        self._expected_sha256 = expected_sha256
        actual_sha256, self._artifact_identity = _stream_sha256(self._artifact_path)
        if actual_sha256 != expected_sha256:
            raise DictionaryLookupUnavailable

    @classmethod
    def from_environment(cls) -> SQLiteDictionaryLookupProvider | None:
        configured_path = os.getenv(ARTIFACT_PATH_ENV, "").strip()
        if not configured_path:
            return None
        expected_sha256 = os.getenv(ARTIFACT_SHA256_ENV, "").strip()
        try:
            return cls(Path(configured_path), expected_sha256=expected_sha256)
        except (DictionaryLookupUnavailable, OSError, ValueError):
            return None

    def lookup(self, normalized_surface: str) -> DictionaryLookupResultDto:
        if normalize_dictionary_surface(normalized_surface) != normalized_surface:
            raise DictionaryLookupInputError("surface must already be normalized")

        try:
            self._assert_artifact_identity()
            with closing(
                sqlite3.connect(self._read_only_uri(), uri=True, timeout=0.25)
            ) as connection:
                self._assert_artifact_identity()
                connection.row_factory = sqlite3.Row
                self._validate_manifest(connection)
                row_index = connection.execute(
                    """
                    SELECT rowid, length(CAST(record_json AS BLOB)) AS record_bytes
                    FROM lexical_entries
                    WHERE normalized_surface = ?
                    ORDER BY entry_order
                    LIMIT ?
                    """,
                    (normalized_surface, MAX_LOOKUP_ENTRIES + 1),
                ).fetchall()
                if len(row_index) > MAX_LOOKUP_ENTRIES:
                    raise DictionaryLookupResultTooLarge
                if not row_index:
                    return DictionaryLookupResultDto(
                        match_status=DictionaryLookupMatchStatusDto.NOT_FOUND, entries=[]
                    )
                if any(int(row["record_bytes"]) > MAX_LOOKUP_RECORD_BYTES for row in row_index):
                    raise DictionaryLookupResultTooLarge
                row_ids = [int(row["rowid"]) for row in row_index]
                placeholders = ", ".join("?" for _ in row_ids)
                rows = connection.execute(
                    f"""
                    SELECT record_json
                    FROM lexical_entries
                    WHERE rowid IN ({placeholders})
                    ORDER BY entry_order
                    """,
                    row_ids,
                ).fetchall()

                entries: list[DictionaryLookupEntryDto] = []
                total_senses = 0
                for row in rows:
                    raw_record = json.loads(row["record_json"])
                    if not isinstance(raw_record, dict):
                        raise DictionaryLookupUnavailable
                    raw_senses = raw_record.get("senses")
                    raw_credits = raw_record.get("attributions")
                    if (
                        isinstance(raw_senses, list)
                        and len(raw_senses) > MAX_LOOKUP_SENSES_PER_ENTRY
                    ):
                        raise DictionaryLookupResultTooLarge
                    if isinstance(raw_credits, list) and len(raw_credits) > 4:
                        raise DictionaryLookupResultTooLarge
                    entry = DictionaryLookupEntryDto.model_validate(raw_record)
                    if normalize_dictionary_surface(entry.matched_surface) != normalized_surface:
                        raise DictionaryLookupUnavailable
                    entries.append(entry)
                    total_senses += len(entry.senses)
                    if total_senses > MAX_LOOKUP_TOTAL_SENSES:
                        raise DictionaryLookupResultTooLarge

                result = DictionaryLookupResultDto(
                    match_status=DictionaryLookupMatchStatusDto.FOUND, entries=entries
                )
                if (
                    len(result.model_dump_json(by_alias=True).encode("utf-8"))
                    > MAX_LOOKUP_RESPONSE_BYTES
                ):
                    raise DictionaryLookupResultTooLarge
                return result
        except (DictionaryLookupInputError, DictionaryLookupResultTooLarge):
            raise
        except (
            OSError,
            sqlite3.Error,
            json.JSONDecodeError,
            ValidationError,
            TypeError,
            KeyError,
        ) as error:
            raise DictionaryLookupUnavailable from error

    def _read_only_uri(self) -> str:
        return f"{self._artifact_path.as_uri()}?mode=ro&immutable=1"

    def _assert_artifact_identity(self) -> None:
        if _file_identity(self._artifact_path) != self._artifact_identity:
            raise DictionaryLookupUnavailable

    @staticmethod
    def _validate_manifest(connection: sqlite3.Connection) -> None:
        metadata_rows = connection.execute("SELECT name, value FROM artifact_manifest").fetchall()
        manifest = {str(row["name"]): str(row["value"]) for row in metadata_rows}
        if (
            manifest.get("artifact_format_version") != ARTIFACT_FORMAT_VERSION
            or manifest.get("normalization_version") != NORMALIZATION_VERSION
            or manifest.get("approval_status") != "approved"
            or not _SHA256_PATTERN.fullmatch(manifest.get("record_manifest_sha256", ""))
        ):
            raise DictionaryLookupUnavailable


class DictionaryLookupAccessLogFilter(logging.Filter):
    """Redacts every query string on the lexical lookup path before Uvicorn formats it."""

    def filter(self, record: logging.LogRecord) -> bool:
        arguments = record.args
        if not isinstance(arguments, tuple) or len(arguments) < 3:
            return True
        request_target = arguments[2]
        if not isinstance(request_target, str):
            return True
        path = request_target.partition("?")[0]
        try:
            decoded_path = unquote(path, errors="strict")
        except UnicodeDecodeError:
            return True
        if decoded_path not in {LOOKUP_PATH, f"{LOOKUP_PATH}/"}:
            return True
        redacted_arguments = list(arguments)
        redacted_arguments[2] = f"{LOOKUP_PATH}?[redacted]"
        record.args = tuple(redacted_arguments)
        return True


def install_dictionary_lookup_access_log_redaction() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, DictionaryLookupAccessLogFilter) for item in access_logger.filters):
        access_logger.addFilter(DictionaryLookupAccessLogFilter())
