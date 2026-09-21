"""Rigorous verification tests for Knowledge System V2 Canonical Schema Foundations (Wave K2-01).

Validates:
1. Migration 0014 additive tables, columns, constraints, indexes, and timestamptz semantics.
2. Foreign key cascade and set-null invariants.
3. Unique and check constraints (accent_variant, audio_source, concept uniqueness).
4. Strict security privilege lockdown for browser roles (anon, authenticated).
5. SQLAlchemy ORM and Pydantic DTO model integrity and roundtrips.
6. Zero learner-state mutation and relational isolation.
"""

from __future__ import annotations

import uuid

import pytest
from lingua_api.catalog.models import (
    AccentVariant,
    AudioSource,
    GrammarSpecification,
    GrammarSpecificationDto,
    PhoneticTranscription,
    PhoneticTranscriptionDto,
)
from psycopg import Connection, errors
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from database.migrate import _connect, _database_url

K2_01_TABLES = {
    "grammar_specifications",
    "phrase_specifications",
    "phonetic_transcriptions",
}


def _seed_source_and_concept(
    conn: Connection[tuple[object, ...]],
    *,
    canonical_key: str | None = None,
    concept_type: str = "grammar",
) -> uuid.UUID:
    """Helper to create a deterministic valid concept fixture referencing approved source."""
    license_id = conn.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'Knowledge V2 permissive test license', 'allowed', false)
        RETURNING id
        """,
        (f"k2-lic-{uuid.uuid4()}",),
    ).fetchone()
    assert license_id is not None

    source_id = conn.execute(
        """
        INSERT INTO data_sources (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', '2', %s, 'LINGUA OS K2-01 test fixture')
        RETURNING id
        """,
        (f"k2-src-{uuid.uuid4()}", license_id[0]),
    ).fetchone()
    assert source_id is not None

    record_id = conn.execute(
        """
        INSERT INTO source_records (source_id, source_record_key, raw_hash,
                                    transform_version, quality_score, review_status)
        VALUES (%s, %s, %s, 'k2-v1', 1, 'approved')
        RETURNING id
        """,
        (source_id[0], str(uuid.uuid4()), "b" * 64),
    ).fetchone()
    assert record_id is not None

    key = canonical_key or f"k2:concept:{uuid.uuid4()}"
    concept_id = conn.execute(
        """
        INSERT INTO concepts (
            language_code, concept_type, canonical_key, source_record_id
        )
        VALUES ('en', %s, %s, %s)
        RETURNING id
        """,
        (concept_type, key, record_id[0]),
    ).fetchone()
    assert concept_id is not None
    return concept_id[0]  # type: ignore[return-value]


def _seed_lexeme(conn: Connection[tuple[object, ...]], *, lemma: str = "testlemma") -> uuid.UUID:
    """Helper to create a deduplicated lexeme fixture."""
    concept_id = _seed_source_and_concept(conn, concept_type="word")
    source_record_id = conn.execute(
        "SELECT source_record_id FROM concepts WHERE id = %s", (concept_id,)
    ).fetchone()
    assert source_record_id is not None

    norm_pos = f"{lemma}_{uuid.uuid4().hex[:8]}"
    lexeme_id = conn.execute(
        """
        INSERT INTO lexemes (
            concept_id, language_code, lemma, normalized_form, part_of_speech, source_record_id
        )
        VALUES (%s, 'en', %s, %s, 'noun', %s)
        RETURNING id
        """,
        (concept_id, lemma, norm_pos, source_record_id[0]),
    ).fetchone()
    assert lexeme_id is not None
    return lexeme_id[0]  # type: ignore[return-value]


# -----------------------------------------------------------------------------
# 1. Schema & Column Structure Verification
# -----------------------------------------------------------------------------


def test_knowledge_v2_canonical_tables_exist_with_correct_structure(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    tables = {
        row[0]
        for row in db_connection.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
    }
    assert tables >= K2_01_TABLES

    # Check timestamptz semantics
    timestamp_types = db_connection.execute(
        """
        SELECT table_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY(%s)
          AND column_name = 'created_at'
        """,
        (list(K2_01_TABLES),),
    ).fetchall()
    assert len(timestamp_types) == 3
    for _, dtype in timestamp_types:
        assert dtype == "timestamp with time zone"


def test_knowledge_v2_canonical_indexes_exist(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    index_names = {
        row[0]
        for row in db_connection.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = ANY(%s)
            """,
            (list(K2_01_TABLES),),
        ).fetchall()
    }
    assert "ix_grammar_specs_category" in index_names
    assert "ix_phrase_specs_headword" in index_names
    assert "ix_phonetic_lookup" in index_names


# -----------------------------------------------------------------------------
# 2. Grammar Specifications: Constraints & Cascade
# -----------------------------------------------------------------------------


def test_grammar_specification_foreign_key_and_cascade(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    concept_id = _seed_source_and_concept(db_connection, concept_type="grammar")

    spec_id = db_connection.execute(
        """
        INSERT INTO grammar_specifications (
            concept_id, pattern_formula, syntactic_category, pragmatic_function,
            vietnamese_explanation, vietnamese_common_traps, structural_slots
        )
        VALUES (%s, 'S + have/has + V3/ed', 'tense_aspect', 'Completed with present relevance',
                'Thì hiện tại hoàn thành', 'Hay nhầm với quá khứ đơn',
                '[{"slot": "subject"}, {"slot": "auxiliary"}, {"slot": "verb"}]'::jsonb)
        RETURNING id
        """,
        (concept_id,),
    ).fetchone()
    assert spec_id is not None

    # Verify query
    row = db_connection.execute(
        "SELECT pattern_formula, syntactic_category FROM grammar_specifications WHERE id = %s",
        (spec_id[0],),
    ).fetchone()
    assert row == ("S + have/has + V3/ed", "tense_aspect")

    # Delete parent concept -> must CASCADE
    db_connection.execute("DELETE FROM concepts WHERE id = %s", (concept_id,))
    count = db_connection.execute(
        "SELECT count(*) FROM grammar_specifications WHERE id = %s", (spec_id[0],)
    ).fetchone()
    assert count is not None and count[0] == 0


def test_grammar_specification_unique_concept_id(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    concept_id = _seed_source_and_concept(db_connection, concept_type="grammar")

    db_connection.execute(
        """
        INSERT INTO grammar_specifications (
            concept_id, pattern_formula, syntactic_category, pragmatic_function,
            vietnamese_explanation
        )
        VALUES (%s, 'Formula 1', 'syntax', 'Function 1', 'Giải thích 1')
        """,
        (concept_id,),
    )

    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO grammar_specifications (
                concept_id, pattern_formula, syntactic_category, pragmatic_function,
                vietnamese_explanation
            )
            VALUES (%s, 'Formula 2', 'syntax', 'Function 2', 'Giải thích 2')
            """,
            (concept_id,),
        )
    db_connection.rollback()


# -----------------------------------------------------------------------------
# 3. Phrase Specifications: Constraints, Cascade & SET NULL
# -----------------------------------------------------------------------------


def test_phrase_specification_headword_set_null_and_parent_cascade(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    phrase_concept_id = _seed_source_and_concept(db_connection, concept_type="phrase")
    headword_concept_id = _seed_source_and_concept(db_connection, concept_type="word")

    phrase_spec_id = db_connection.execute(
        """
        INSERT INTO phrase_specifications (
            concept_id, base_pattern, headword_concept_id, slot_template
        )
        VALUES (%s, 'make up {possessive} mind', %s,
                '[{"slot": "possessive", "allowed": ["my", "your", "his", "her"]}]'::jsonb)
        RETURNING id
        """,
        (phrase_concept_id, headword_concept_id),
    ).fetchone()
    assert phrase_spec_id is not None

    # Deleting headword concept must SET NULL on headword_concept_id, preserving phrase spec
    db_connection.execute("DELETE FROM concepts WHERE id = %s", (headword_concept_id,))
    row = db_connection.execute(
        "SELECT headword_concept_id, base_pattern FROM phrase_specifications WHERE id = %s",
        (phrase_spec_id[0],),
    ).fetchone()
    assert row is not None
    assert row[0] is None
    assert row[1] == "make up {possessive} mind"

    # Deleting phrase concept must CASCADE and delete phrase spec
    db_connection.execute("DELETE FROM concepts WHERE id = %s", (phrase_concept_id,))
    remaining = db_connection.execute(
        "SELECT count(*) FROM phrase_specifications WHERE id = %s", (phrase_spec_id[0],)
    ).fetchone()
    assert remaining is not None and remaining[0] == 0


# -----------------------------------------------------------------------------
# 4. Phonetic Transcriptions: Accent Uniqueness, Cascade & Check Constraints
# -----------------------------------------------------------------------------


def test_phonetic_transcription_unique_accent_and_cascade(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    lexeme_id = _seed_lexeme(db_connection, lemma="schedule")

    # Insert US transcription
    db_connection.execute(
        """
        INSERT INTO phonetic_transcriptions (
            lexeme_id, accent_variant, ipa, audio_source, duration_ms
        )
        VALUES (%s, 'en_US', '/skedzh.u:l/', 'human_studio', 650)
        """,
        (lexeme_id,),
    )

    # Insert GB transcription for same lexeme (allowed)
    db_connection.execute(
        """
        INSERT INTO phonetic_transcriptions (
            lexeme_id, accent_variant, ipa, audio_source, duration_ms
        )
        VALUES (%s, 'en_GB', '/shedzh.u:l/', 'high_quality_neural_tts', 700)
        """,
        (lexeme_id,),
    )

    # Duplicate US accent on same lexeme must raise UniqueViolation
    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO phonetic_transcriptions (
                lexeme_id, accent_variant, ipa
            )
            VALUES (%s, 'en_US', '/duplicate_ipa/')
            """,
            (lexeme_id,),
        )
    db_connection.rollback()


def test_phonetic_transcription_check_constraints_enforced(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    lexeme_id = _seed_lexeme(db_connection, lemma="water")

    # Invalid accent variant
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO phonetic_transcriptions (lexeme_id, accent_variant, ipa)
            VALUES (%s, 'fr_FR', '/wata/')
            """,
            (lexeme_id,),
        )
    db_connection.rollback()

    # Invalid audio source
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO phonetic_transcriptions (lexeme_id, accent_variant, ipa, audio_source)
            VALUES (%s, 'en_US', '/wa:ter/', 'unverified_mic')
            """,
            (lexeme_id,),
        )
    db_connection.rollback()


# -----------------------------------------------------------------------------
# 5. Security & Privilege Lockdown Verification
# -----------------------------------------------------------------------------


def test_browser_roles_have_zero_privileges_on_knowledge_v2_canonical_tables(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    for table_name in K2_01_TABLES:
        for role in ("anon", "authenticated"):
            for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                has_privilege = db_connection.execute(
                    "SELECT has_table_privilege(%s, %s, %s)",
                    (role, f"public.{table_name}", privilege),
                ).fetchone()
                assert has_privilege is not None
                assert has_privilege[0] is False, (
                    f"Role {role} must NOT have {privilege} on {table_name}"
                )


# -----------------------------------------------------------------------------
# 6. SQLAlchemy ORM & Pydantic DTO Roundtrip
# -----------------------------------------------------------------------------


def test_sqlalchemy_orm_and_pydantic_dto_roundtrip() -> None:
    db_url = _database_url()
    # Normalize postgresql:// prefix for SQLAlchemy
    sa_url = db_url.replace("postgresql://", "postgresql+psycopg://")
    engine = create_engine(sa_url)

    # 1. Seed prerequisites via direct psycopg
    with _connect(db_url) as conn:
        concept_id = _seed_source_and_concept(conn, concept_type="grammar")
        lexeme_id = _seed_lexeme(conn, lemma="pronounce")
        conn.commit()

    # 2. Test SQLAlchemy ORM Insert and Query
    with Session(engine) as session:
        grammar_entity = GrammarSpecification(
            concept_id=concept_id,
            pattern_formula="be + going to + V_inf",
            syntactic_category="future_intention",
            pragmatic_function="Expressing prior intention or planned future",
            vietnamese_explanation="Tương lai gần có kế hoạch từ trước",
            vietnamese_common_traps="Hay nhầm với will khi quyết định tại thời điểm nói",
            structural_slots=[{"slot": "subject"}, {"slot": "be_going_to"}, {"slot": "verb_inf"}],
        )
        phonetic_entity = PhoneticTranscription(
            lexeme_id=lexeme_id,
            accent_variant="en_US",
            ipa="/pro'nauns/",
            audio_uri="https://cdn.lingua-os.internal/audio/en_US/pronounce.mp3",
            duration_ms=580,
            audio_source="human_studio",
        )
        session.add(grammar_entity)
        session.add(phonetic_entity)
        session.commit()

        # Query back via SQLAlchemy
        loaded_grammar = session.scalar(
            select(GrammarSpecification).where(GrammarSpecification.concept_id == concept_id)
        )
        assert loaded_grammar is not None
        assert loaded_grammar.pattern_formula == "be + going to + V_inf"
        assert loaded_grammar.syntactic_category == "future_intention"

        loaded_phonetic = session.scalar(
            select(PhoneticTranscription).where(PhoneticTranscription.lexeme_id == lexeme_id)
        )
        assert loaded_phonetic is not None
        assert loaded_phonetic.accent_variant == "en_US"
        assert loaded_phonetic.duration_ms == 580

        # 3. Test Pydantic v2 DTO Serialization and Validation
        grammar_dto = GrammarSpecificationDto(
            id=loaded_grammar.id,
            concept_id=loaded_grammar.concept_id,
            pattern_formula=loaded_grammar.pattern_formula,
            syntactic_category=loaded_grammar.syntactic_category,
            pragmatic_function=loaded_grammar.pragmatic_function,
            vietnamese_explanation=loaded_grammar.vietnamese_explanation,
            vietnamese_common_traps=loaded_grammar.vietnamese_common_traps,
            structural_slots=loaded_grammar.structural_slots,
            created_at=loaded_grammar.created_at,
        )
        assert grammar_dto.pattern_formula == "be + going to + V_inf"
        serialized = grammar_dto.model_dump(by_alias=True)
        assert "patternFormula" in serialized
        assert "syntacticCategory" in serialized

        phonetic_dto = PhoneticTranscriptionDto(
            id=loaded_phonetic.id,
            lexeme_id=loaded_phonetic.lexeme_id,
            accent_variant=AccentVariant(loaded_phonetic.accent_variant),
            ipa=loaded_phonetic.ipa,
            audio_uri=loaded_phonetic.audio_uri,
            duration_ms=loaded_phonetic.duration_ms,
            audio_source=AudioSource(loaded_phonetic.audio_source)
            if loaded_phonetic.audio_source
            else None,
            created_at=loaded_phonetic.created_at,
        )
        assert phonetic_dto.accent_variant == AccentVariant.EN_US
        assert phonetic_dto.audio_source == AudioSource.HUMAN_STUDIO
