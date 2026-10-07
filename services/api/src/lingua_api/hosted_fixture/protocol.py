"""Immutable identities and DTO projection for the K2-09 fixture protocol."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid5

PROTOCOL_VERSION = "k2-09-bridge-fixture.v1"
REPOSITORY_ID = 1367261125
REPOSITORY = "haizx71/lingua-os"
OWNER_ID = 95479547
WORKFLOW_REF = "haizx71/lingua-os/.github/workflows/k2-hosted-acceptance.yml@refs/heads/master"
WORKFLOW_NAME = "K2 Hosted Acceptance"
AUDIENCE = "https://lingua-api-staging.onrender.com/internal/k2-hosted-fixtures"
OIDC_ISSUER = "https://token.actions.githubusercontent.com"
OIDC_JWKS_URL = f"{OIDC_ISSUER}/.well-known/jwks"
RENDER_SERVICE_ID = "srv-daip7vbm8hqs73dp00pg"
RENDER_SERVICE_NAME = "lingua-api-staging"
SUPABASE_PROJECT_REF = "bdmtdvvnbicgkfririjo"
FIXTURE_NAMESPACE = UUID("2d1129db-93ec-4db0-b134-09e4cf4e8e72")
ARTIFACT_SHA256 = "650b0c693b3ae6c1f623b7bbc757fa7f011c3e005dd7c7068133df69b5320b27"
ARTIFACT_RELATIVE_PATH = "database/fixtures/k2_09_schema_guard.v1.json"
GITHUB_API = "https://api.github.com"
GITHUB_REPOSITORY_API = f"{GITHUB_API}/repos/{REPOSITORY}"
GITHUB_CONTENTS_READ_TOKEN_HEADER = "X-GitHub-Read-Token"
ADVISORY_LOCK_KEY = 209136726
TRANSACTION_TIMEOUT_MS = 8000
ACTIVE_TTL_SECONDS = 2 * 60 * 60
TERMINAL_RETENTION_SECONDS = 75 * 24 * 60 * 60
REAPER_BATCH_LIMIT = 10

SOURCE_NAME = "LINGUA First-Party Knowledge Starter"
SOURCE_VERSION = "2026-09-16.v1"
SOURCE_ATTRIBUTION = "LINGUA OS first-party authored knowledge starter"
LICENSE_CODE = "LINGUA-FIRST-PARTY"
LICENSE_NAME = "LINGUA first-party authored content"
TRANSFORM_VERSION = PROTOCOL_VERSION

_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
_HEX_RE = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class RunClaims:
    repository_id: int
    run_id: int
    run_attempt: int
    sha: str
    workflow_sha: str
    jti: str
    issued_at: int
    expires_at: int

    def validate(self) -> None:
        if self.repository_id != REPOSITORY_ID or self.run_id <= 0 or self.run_attempt <= 0:
            raise ValueError("claim identity is invalid")
        if not _SHA_RE.fullmatch(self.sha) or not _SHA_RE.fullmatch(self.workflow_sha):
            raise ValueError("claim SHA is invalid")
        if self.sha != self.workflow_sha:
            raise ValueError("workflow and run SHA differ")
        if not self.jti or len(self.jti) > 256:
            raise ValueError("claim jti is invalid")
        if self.expires_at <= self.issued_at:
            raise ValueError("claim interval is invalid")


@dataclass(frozen=True)
class FixtureIds:
    source_record: UUID
    owner_concept: UUID
    secondary_concept: UUID
    lexeme: UUID
    form: UUID
    sense_one: UUID
    sense_two: UUID
    suffix: str

    @property
    def lemma(self) -> str:
        return f"kfixture{self.suffix}"

    @property
    def inflected_form(self) -> str:
        return f"{self.lemma}s"

    @property
    def source_record_key(self) -> str:
        return f"k2-09-fixture:{self.suffix}"

    @property
    def owner_canonical_key(self) -> str:
        return f"word:k2-09-owner:{self.suffix}"

    @property
    def secondary_canonical_key(self) -> str:
        return f"word:k2-09-secondary:{self.suffix}"


def derive_fixture_ids(claims: RunClaims) -> FixtureIds:
    claims.validate()
    tuple_name = (
        f"{PROTOCOL_VERSION}|{REPOSITORY_ID}|{claims.run_id}|{claims.run_attempt}|{claims.sha}"
    )
    suffix = "".join(
        chr(ord("a") + int(nibble, 16))
        for nibble in hashlib.sha256(tuple_name.encode("ascii")).hexdigest()
    )

    def row_id(slot: str) -> UUID:
        return uuid5(FIXTURE_NAMESPACE, f"{tuple_name}|{slot}")

    return FixtureIds(
        source_record=row_id("source_record"),
        owner_concept=row_id("owner_concept"),
        secondary_concept=row_id("secondary_concept"),
        lexeme=row_id("lexeme"),
        form=row_id("form"),
        sense_one=row_id("sense_1"),
        sense_two=row_id("sense_2"),
        suffix=suffix,
    )


def fixture_payload(ids: FixtureIds, *, source_id: UUID) -> dict[str, list[dict[str, Any]]]:
    """Return the exact deterministic catalog values, excluding timestamps."""
    source_record = {
        "id": str(ids.source_record),
        "source_id": str(source_id),
        "source_record_key": ids.source_record_key,
        "transform_version": TRANSFORM_VERSION,
        "quality_score": "1.0000",
        "review_status": "approved",
        "metadata": {"fixtureProtocol": PROTOCOL_VERSION},
    }
    concepts = [
        {
            "id": str(ids.owner_concept),
            "language_code": "en",
            "concept_type": "word",
            "canonical_key": ids.owner_canonical_key,
            "source_record_id": str(ids.source_record),
        },
        {
            "id": str(ids.secondary_concept),
            "language_code": "en",
            "concept_type": "word",
            "canonical_key": ids.secondary_canonical_key,
            "source_record_id": str(ids.source_record),
        },
    ]
    lexemes = [
        {
            "id": str(ids.lexeme),
            "concept_id": str(ids.owner_concept),
            "language_code": "en",
            "lemma": ids.lemma,
            "normalized_form": ids.lemma,
            "part_of_speech": "noun",
            "source_record_id": str(ids.source_record),
        }
    ]
    forms = [
        {
            "id": str(ids.form),
            "lexeme_id": str(ids.lexeme),
            "form": ids.inflected_form,
            "normalized_form": ids.inflected_form,
            "form_type": "inflection",
            "source_record_id": str(ids.source_record),
        }
    ]
    senses = [
        {
            "id": str(ids.sense_one),
            "lexeme_id": str(ids.lexeme),
            "sense_order": 1,
            "definition": "K2-09 fixture sense one.",
            "definition_language_code": "en",
            "translated_definition": None,
            "translation_language_code": None,
            "source_record_id": str(ids.source_record),
        },
        {
            "id": str(ids.sense_two),
            "lexeme_id": str(ids.lexeme),
            "sense_order": 2,
            "definition": "K2-09 fixture sense two.",
            "definition_language_code": "en",
            "translated_definition": None,
            "translation_language_code": None,
            "source_record_id": str(ids.source_record),
        },
    ]
    bridges = [
        {
            "concept_id": str(ids.owner_concept),
            "word_sense_id": str(ids.sense_one),
            "is_primary": True,
        },
        {
            "concept_id": str(ids.secondary_concept),
            "word_sense_id": str(ids.sense_one),
            "is_primary": False,
        },
        {
            "concept_id": str(ids.owner_concept),
            "word_sense_id": str(ids.sense_two),
            "is_primary": False,
        },
    ]
    return {
        "source_records": [source_record],
        "concepts": concepts,
        "lexemes": lexemes,
        "lexeme_forms": forms,
        "word_senses": senses,
        "concept_senses": bridges,
    }


def source_record_hash(ids: FixtureIds, *, source_id: UUID, license_id: UUID) -> str:
    identity = {
        "source": {
            "id": str(source_id),
            "name": SOURCE_NAME,
            "source_type": "internal",
            "source_version": SOURCE_VERSION,
            "attribution_text": SOURCE_ATTRIBUTION,
        },
        "license": {
            "id": str(license_id),
            "code": LICENSE_CODE,
            "name": LICENSE_NAME,
            "usage_policy": "allowed",
            "attribution_required": False,
        },
        "fixture": fixture_payload(ids, source_id=source_id),
    }
    canonical = json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def success_counts(*, present: bool) -> dict[str, int]:
    if not present:
        return {
            "sourceRecords": 0,
            "concepts": 0,
            "lexemes": 0,
            "forms": 0,
            "senses": 0,
            "bridges": 0,
        }
    return {
        "sourceRecords": 1,
        "concepts": 2,
        "lexemes": 1,
        "forms": 1,
        "senses": 2,
        "bridges": 3,
    }


def fixture_dto(ids: FixtureIds) -> dict[str, Any]:
    return {
        "handles": {
            "ownerConcept": "k2-09-owner",
            "secondaryConcept": "k2-09-secondary",
            "lexeme": "k2-09-lexeme",
        },
        "ids": {
            "ownerConceptId": str(ids.owner_concept),
            "secondaryConceptId": str(ids.secondary_concept),
            "lexemeId": str(ids.lexeme),
        },
        "lemma": ids.lemma,
        "inflectedForm": ids.inflected_form,
    }
