"""Read-only recursive queries for the Knowledge V2 concept graph."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from psycopg import Connection

GRAPH_RELATION_TYPES = frozenset(
    {
        "prerequisite_of",
        "part_of",
        "synonym_of",
        "antonym_of",
        "collocates_with",
        "inflection_of",
        "derived_from",
        "confusable_with",
        "grammar_pattern_of",
        "hypernym_of",
        "hyponym_of",
    }
)

DAG_RELATION_TYPES = frozenset({"prerequisite_of", "part_of", "hypernym_of", "derived_from"})

MAX_PREREQUISITE_DEPTH = 4


@dataclass(frozen=True)
class PrerequisitePath:
    """One bounded prerequisite ancestor path segment."""

    required_concept_id: UUID
    dependent_concept_id: UUID
    depth: int


_PREREQUISITE_ANCESTORS_SQL = """
WITH RECURSIVE prerequisite_path(
    required_concept_id,
    dependent_concept_id,
    depth
) AS (
    SELECT
        edge.source_concept_id,
        edge.target_concept_id,
        1
    FROM public.concept_edges AS edge
    WHERE edge.target_concept_id = %s
      AND edge.relation_type = 'prerequisite_of'

    UNION

    SELECT
        edge.source_concept_id,
        edge.target_concept_id,
        path.depth + 1
    FROM public.concept_edges AS edge
    JOIN prerequisite_path AS path
      ON edge.target_concept_id = path.required_concept_id
    WHERE edge.relation_type = 'prerequisite_of'
      AND path.depth < %s
)
SELECT required_concept_id, dependent_concept_id, depth
FROM prerequisite_path
ORDER BY depth DESC, required_concept_id;
"""

_PREREQUISITE_DESCENDANTS_SQL = """
WITH RECURSIVE prerequisite_path(
    source_concept_id,
    target_concept_id,
    depth
) AS (
    SELECT
        edge.source_concept_id,
        edge.target_concept_id,
        1
    FROM public.concept_edges AS edge
    WHERE edge.source_concept_id = %s
      AND edge.relation_type = 'prerequisite_of'

    UNION

    SELECT
        edge.source_concept_id,
        edge.target_concept_id,
        path.depth + 1
    FROM public.concept_edges AS edge
    JOIN prerequisite_path AS path
      ON edge.source_concept_id = path.target_concept_id
    WHERE edge.relation_type = 'prerequisite_of'
      AND path.depth < %s
)
SELECT source_concept_id, target_concept_id, depth
FROM prerequisite_path
ORDER BY depth, target_concept_id;
"""


def _bounded_depth(max_depth: int) -> int:
    if not 1 <= max_depth <= MAX_PREREQUISITE_DEPTH:
        raise ValueError(f"max_depth must be between 1 and {MAX_PREREQUISITE_DEPTH}")
    return max_depth


def _as_uuid(value: object) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def fetch_prerequisite_ancestors(
    connection: Connection[tuple[object, ...]],
    target_concept_id: UUID,
    *,
    max_depth: int = MAX_PREREQUISITE_DEPTH,
) -> tuple[PrerequisitePath, ...]:
    """Return prerequisite ancestors, deepest first, with a bounded recursive CTE."""

    depth = _bounded_depth(max_depth)
    rows = connection.execute(_PREREQUISITE_ANCESTORS_SQL, (target_concept_id, depth)).fetchall()
    return tuple(
        PrerequisitePath(
            required_concept_id=_as_uuid(row[0]),
            dependent_concept_id=_as_uuid(row[1]),
            depth=int(str(row[2])),
        )
        for row in rows
    )


def fetch_prerequisite_descendants(
    connection: Connection[tuple[object, ...]],
    source_concept_id: UUID,
    *,
    max_depth: int = MAX_PREREQUISITE_DEPTH,
) -> tuple[PrerequisitePath, ...]:
    """Return dependent concepts, nearest first, with a bounded recursive CTE."""

    depth = _bounded_depth(max_depth)
    rows = connection.execute(
        _PREREQUISITE_DESCENDANTS_SQL,
        (source_concept_id, depth),
    ).fetchall()
    return tuple(
        PrerequisitePath(
            required_concept_id=_as_uuid(row[0]),
            dependent_concept_id=_as_uuid(row[1]),
            depth=int(str(row[2])),
        )
        for row in rows
    )
