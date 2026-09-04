"""Read-only PostgreSQL candidate and learner overlay queries for Analyze."""

from __future__ import annotations

from uuid import UUID

from lingua_api.brain.store import BrainSnapshot
from lingua_api.catalog.sql import allowed_record_sql
from lingua_api.reader.analyze_policy import CatalogMatchCandidate, candidate_lookup_tokens


class PostgresReaderAnalyzeStore:
    @staticmethod
    def load_candidates(snapshot: BrainSnapshot, *, text: str) -> tuple[CatalogMatchCandidate, ...]:
        tokens = candidate_lookup_tokens(text)
        if not tokens:
            return ()
        rows = snapshot.connection.execute(
            f"""
            WITH input_tokens AS (
                SELECT unnest(%s::text[]) AS token
            ), candidates AS (
                SELECT lexeme.concept_id, lexeme.lemma, lexeme.normalized_form
                FROM input_tokens
                JOIN lexemes AS lexeme
                  ON lexeme.language_code = 'en'
                 AND (lexeme.normalized_form = input_tokens.token
                      OR left(lexeme.normalized_form, char_length(input_tokens.token) + 1)
                         = input_tokens.token || ' ')
                JOIN concepts AS concept ON concept.id = lexeme.concept_id
                WHERE concept.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                UNION
                SELECT lexeme.concept_id, lexeme.lemma, form.normalized_form
                FROM input_tokens
                JOIN lexeme_forms AS form
                  ON form.normalized_form = input_tokens.token
                     OR left(form.normalized_form, char_length(input_tokens.token) + 1)
                        = input_tokens.token || ' '
                JOIN lexemes AS lexeme ON lexeme.id = form.lexeme_id
                JOIN concepts AS concept ON concept.id = lexeme.concept_id
                WHERE lexeme.language_code = 'en'
                  AND concept.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                  AND {allowed_record_sql("form.source_record_id")}
            )
            SELECT DISTINCT concept_id, lemma, normalized_form
            FROM candidates
            ORDER BY normalized_form, concept_id
            """,
            (list(tokens),),
        ).fetchall()
        return tuple(
            CatalogMatchCandidate(
                concept_id=_uuid(row[0]), canonical_form=str(row[1]), normalized_form=str(row[2])
            )
            for row in rows
        )

    @staticmethod
    def load_statuses(
        snapshot: BrainSnapshot, *, profile_id: UUID, concept_ids: tuple[UUID, ...]
    ) -> dict[UUID, str]:
        if not concept_ids:
            return {}
        rows = snapshot.connection.execute(
            """
            SELECT concept_id, status
            FROM user_concept_states
            WHERE user_id = %s AND user_language_id = %s AND language_code = 'en'
              AND competence_parameter_set_id IS NOT NULL
              AND concept_id = ANY(%s::uuid[])
            """,
            (snapshot.actor.id, profile_id, list(concept_ids)),
        ).fetchall()
        return {_uuid(row[0]): str(row[1]) for row in rows}


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
