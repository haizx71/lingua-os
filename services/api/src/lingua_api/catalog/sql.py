"""Canonical fail-closed provenance predicate shared by catalog read models."""

from __future__ import annotations


def allowed_record_sql(record_id_sql: str) -> str:
    return f"""EXISTS (
        SELECT 1
        FROM source_records AS gate_record
        JOIN data_sources AS gate_source ON gate_source.id = gate_record.source_id
        JOIN licenses AS gate_license ON gate_license.id = gate_source.license_id
        WHERE gate_record.id = {record_id_sql}
          AND gate_record.review_status = 'approved'
          AND gate_record.quality_score IS NOT NULL
          AND gate_license.usage_policy = 'allowed'
          AND (
              NOT gate_license.attribution_required
              OR btrim(gate_source.attribution_text) <> ''
          )
    )"""
