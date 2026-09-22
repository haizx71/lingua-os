"""Authoritative canonical models for Knowledge System V2 (Waves K2-01, K2-02, and K2-03).

Provides:
1. SQLAlchemy 2.0 Declarative ORM models for database persistence and migrations.
2. Pydantic v2 DTO models for boundary validation and serialization.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# -----------------------------------------------------------------------------
# SQLAlchemy 2.0 Declarative ORM Models
# -----------------------------------------------------------------------------


class CatalogBase(DeclarativeBase):
    """Base declarative class for Knowledge System canonical catalog models."""


# Canonical parent tables referenced by foreign keys
Table("concepts", CatalogBase.metadata, Column("id", PG_UUID(as_uuid=True), primary_key=True))
Table("lexemes", CatalogBase.metadata, Column("id", PG_UUID(as_uuid=True), primary_key=True))
Table("word_senses", CatalogBase.metadata, Column("id", PG_UUID(as_uuid=True), primary_key=True))


class ConceptSense(CatalogBase):
    """Canonical bridge from a pedagogical concept to one word sense."""

    __tablename__ = "concept_senses"

    concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    word_sense_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("word_senses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_primary: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


class ConceptEdge(CatalogBase):
    """Typed semantic or pedagogical relationship between two concepts."""

    __tablename__ = "concept_edges"
    __table_args__ = (
        UniqueConstraint(
            "source_concept_id",
            "target_concept_id",
            "relation_type",
            name="uq_concept_edges_directed",
        ),
        CheckConstraint(
            "source_concept_id <> target_concept_id",
            name="chk_concept_edges_no_self_loop",
        ),
        CheckConstraint(
            "weight >= 0.0 AND weight <= 1.0",
            name="chk_concept_edges_weight",
        ),
        CheckConstraint(
            "jsonb_typeof(metadata) = 'object'",
            name="chk_concept_edges_metadata_object",
        ),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    source_concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        nullable=False,
    )
    relation_type: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    edge_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


class GrammarSpecification(CatalogBase):
    """Structural formula and pedagogical L1 explanation for grammar concepts."""

    __tablename__ = "grammar_specifications"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    pattern_formula: Mapped[str] = mapped_column(Text, nullable=False)
    syntactic_category: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    pragmatic_function: Mapped[str] = mapped_column(Text, nullable=False)
    vietnamese_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    vietnamese_common_traps: Mapped[str | None] = mapped_column(Text, nullable=True)
    structural_slots: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


class PhraseSpecification(CatalogBase):
    """Semi-fixed phrase pattern and compositional slot template for phrase concepts."""

    __tablename__ = "phrase_specifications"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    base_pattern: Mapped[str] = mapped_column(Text, nullable=False)
    headword_concept_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    slot_template: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


class PhoneticTranscription(CatalogBase):
    """Multi-accent canonical phonetic transcription and audio reference for a lexeme."""

    __tablename__ = "phonetic_transcriptions"
    __table_args__ = (
        UniqueConstraint("lexeme_id", "accent_variant", name="uq_phonetic_lexeme_accent"),
        CheckConstraint(
            "accent_variant IN ('en_US', 'en_GB', 'en_AU')",
            name="chk_phonetic_accent_variant",
        ),
        CheckConstraint(
            "audio_source IN ('human_studio', 'high_quality_neural_tts')",
            name="chk_phonetic_audio_source",
        ),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    lexeme_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("lexemes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accent_variant: Mapped[str] = mapped_column(Text, nullable=False)
    ipa: Mapped[str] = mapped_column(Text, nullable=False)
    audio_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


# -----------------------------------------------------------------------------
# Pydantic v2 DTOs
# -----------------------------------------------------------------------------


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class AccentVariant(StrEnum):
    EN_US = "en_US"
    EN_GB = "en_GB"
    EN_AU = "en_AU"


class AudioSource(StrEnum):
    HUMAN_STUDIO = "human_studio"
    HIGH_QUALITY_NEURAL_TTS = "high_quality_neural_tts"


class ConceptEdgeRelation(StrEnum):
    PREREQUISITE_OF = "prerequisite_of"
    PART_OF = "part_of"
    SYNONYM_OF = "synonym_of"
    ANTONYM_OF = "antonym_of"
    COLLOCATES_WITH = "collocates_with"
    INFLECTION_OF = "inflection_of"
    DERIVED_FROM = "derived_from"
    CONFUSABLE_WITH = "confusable_with"
    GRAMMAR_PATTERN_OF = "grammar_pattern_of"
    HYPERNYM_OF = "hypernym_of"
    HYPONYM_OF = "hyponym_of"


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ConceptSenseDto(ApiModel):
    concept_id: UUID
    word_sense_id: UUID
    is_primary: bool = True
    created_at: datetime


class ConceptEdgeDto(ApiModel):
    id: UUID
    source_concept_id: UUID
    target_concept_id: UUID
    relation_type: ConceptEdgeRelation
    weight: float = Field(default=1.0, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class GrammarSpecificationDto(ApiModel):
    id: UUID
    concept_id: UUID
    pattern_formula: str = Field(min_length=1)
    syntactic_category: str = Field(min_length=1)
    pragmatic_function: str = Field(min_length=1)
    vietnamese_explanation: str = Field(min_length=1)
    vietnamese_common_traps: str | None = None
    structural_slots: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class PhraseSpecificationDto(ApiModel):
    id: UUID
    concept_id: UUID
    base_pattern: str = Field(min_length=1)
    headword_concept_id: UUID | None = None
    slot_template: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class PhoneticTranscriptionDto(ApiModel):
    id: UUID
    lexeme_id: UUID
    accent_variant: AccentVariant
    ipa: str = Field(min_length=1)
    audio_uri: str | None = None
    duration_ms: int | None = Field(default=None, ge=0)
    audio_source: AudioSource | None = None
    created_at: datetime
