from __future__ import annotations

import importlib
import json
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any, cast

import yaml

ROOT = Path(__file__).resolve().parents[3]
OPENAPI_PATH = ROOT / "contracts" / "openapi.yaml"
ENUMS_PATH = ROOT / "contracts" / "enums.json"
ERRORS_PATH = ROOT / "contracts" / "errors.json"

EXPECTED_PATHS = {
    "/v1/admin/content",
    "/v1/admin/content/{contentId}",
    "/v1/admin/content/{contentId}/validate",
    "/v1/admin/content/{contentId}/publish",
    "/v1/admin/content/{contentId}/retire",
    "/v1/me",
    "/v1/me/languages",
    "/v1/me/languages/{languageProfileId}",
    "/v1/today",
    "/v1/today/{planId}/activities/{activityId}/complete",
    "/v1/review/queue",
    "/v1/review/{reviewItemId}/answer",
    "/v1/concepts/{conceptId}",
    "/v1/dictionary/search",
    "/v1/reader/analyze",
    "/v1/reader/exposures",
    "/v1/reader/progress/{contentId}",
    "/v1/reader/save-sentence",
    "/v1/content/recommended",
    "/v1/content/{contentId}",
    "/v1/library/items",
    "/v1/library/concepts/{conceptId}",
    "/v1/library/content/{contentId}",
    "/v1/library/sentences/{sentenceId}",
    "/v1/assessments",
    "/v1/assessments/{assessmentId}",
    "/v1/assessments/{assessmentId}/responses",
    "/v1/brain/summary",
    "/v1/brain/concepts",
    "/v1/brain/concepts/{conceptId}",
    "/v1/progress/overview",
}

PAGINATED_PATHS = {
    "/v1/review/queue",
    "/v1/dictionary/search",
    "/v1/content/recommended",
    "/v1/library/items",
    "/v1/brain/concepts",
}

BOUNDED_GET_PATHS = {
    "/v1/me",
    "/v1/me/languages",
    "/v1/today",
    "/v1/content/{contentId}",
    "/v1/concepts/{conceptId}",
    "/v1/assessments/{assessmentId}",
    "/v1/brain/summary",
    "/v1/brain/concepts/{conceptId}",
    "/v1/progress/overview",
}

HTTP_METHODS = {"get", "put", "post", "delete", "patch", "options", "head", "trace"}


def test_language_profile_child_etag_is_required_opaque_response_metadata() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    profile = schemas["LanguageProfile"]
    assert "etag" in profile["required"]
    token = profile["properties"]["etag"]
    assert token["type"] == "string"
    assert token["minLength"] == 1
    assert token["readOnly"] is True
    for term in ("opaque", "strong", "If-Match", "language-profile"):
        assert term.lower() in token["description"].lower()
    assert "pattern" not in token  # No public hash/revision encoding contract.
    for field in ("revision", "userId", "hash", "hashInputs"):
        assert field not in profile["properties"]
    reference = {"$ref": "#/components/schemas/LanguageProfile"}
    assert schemas["LanguageProfilesResponse"]["properties"]["data"]["items"] == reference
    assert schemas["MeProfile"]["properties"]["languageProfiles"]["items"] == reference
    assert schemas["LanguageProfileResponse"]["properties"]["data"] == reference
    for name in ("CreateLanguageProfileRequest", "UpdateLanguageProfileRequest"):
        assert "etag" not in schemas[name]["properties"]
    collection = spec["paths"]["/v1/me/languages"]["get"]
    assert "ETag" not in collection["responses"]["200"].get("headers", {})


def load_yaml(path: Path) -> dict[str, Any]:
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert isinstance(loaded, dict)
    return loaded


def load_json(path: Path) -> dict[str, Any]:
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(loaded, dict)
    return loaded


def iter_operations(spec: Mapping[str, Any]) -> Iterator[tuple[str, str, Mapping[str, Any]]]:
    for path, path_item in spec["paths"].items():
        for method, operation in path_item.items():
            if method in HTTP_METHODS:
                yield path, method, operation


def local_ref_target(spec: Mapping[str, Any], ref: str) -> Any:
    assert ref.startswith("#/"), f"external or malformed reference: {ref}"
    current: Any = spec
    for raw_part in ref[2:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        assert isinstance(current, Mapping) and part in current, f"unresolved reference: {ref}"
        current = current[part]
    return current


def walk(value: Any) -> Iterator[Any]:
    yield value
    if isinstance(value, Mapping):
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def parameter_names(spec: Mapping[str, Any], path: str, method: str) -> set[tuple[str, str]]:
    raw_parameters = [
        *spec["paths"][path].get("parameters", []),
        *spec["paths"][path][method].get("parameters", []),
    ]
    names: set[tuple[str, str]] = set()
    for parameter in raw_parameters:
        if "$ref" in parameter:
            parameter = local_ref_target(spec, parameter["$ref"])
        names.add((parameter["name"], parameter["in"]))
    return names


def success_schema(spec: Mapping[str, Any], operation: Mapping[str, Any]) -> Mapping[str, Any]:
    response = operation["responses"].get("200") or operation["responses"].get("201")
    assert response is not None
    if "$ref" in response:
        response = local_ref_target(spec, response["$ref"])
    schema = response["content"]["application/json"]["schema"]
    if "$ref" in schema:
        schema = local_ref_target(spec, schema["$ref"])
    return cast(Mapping[str, Any], schema)


def test_openapi_is_nonempty_v32_and_spec_valid() -> None:
    spec = load_yaml(OPENAPI_PATH)

    assert spec["openapi"] == "3.2.0"
    assert set(spec["paths"]) == EXPECTED_PATHS

    validator = importlib.import_module("openapi_spec_validator")
    validator.validate(spec)


def test_operation_ids_are_stable_unique_and_every_operation_is_secured() -> None:
    spec = load_yaml(OPENAPI_PATH)
    operations = list(iter_operations(spec))
    operation_ids = [operation.get("operationId") for _, _, operation in operations]

    assert all(isinstance(operation_id, str) and operation_id for operation_id in operation_ids)
    assert len(operation_ids) == len(set(operation_ids))
    assert spec["security"] == [{"supabaseBearer": []}]
    assert all(operation.get("security", spec["security"]) for _, _, operation in operations)
    assert spec["components"]["securitySchemes"]["supabaseBearer"]["scheme"] == "bearer"
    assert spec["components"]["securitySchemes"]["supabaseBearer"]["bearerFormat"] == "JWT"


def test_all_local_references_resolve_and_no_schema_uses_external_refs() -> None:
    spec = load_yaml(OPENAPI_PATH)
    refs = [node["$ref"] for node in walk(spec) if isinstance(node, Mapping) and "$ref" in node]

    assert refs
    for ref in refs:
        local_ref_target(spec, ref)


def test_success_envelopes_and_reusable_errors_are_consistent() -> None:
    spec = load_yaml(OPENAPI_PATH)

    for path, method, operation in iter_operations(spec):
        schema = success_schema(spec, operation)
        assert {"data", "meta"} <= set(schema["required"]), f"{method.upper()} {path}"
        assert "401" in operation["responses"], f"{method.upper()} {path}"
        assert "422" in operation["responses"], f"{method.upper()} {path}"
        assert "500" in operation["responses"], f"{method.upper()} {path}"
        for status, response in operation["responses"].items():
            if int(status) >= 400:
                assert response.get("$ref", "").startswith("#/components/responses/")

    error_schema = spec["components"]["schemas"]["ErrorEnvelope"]
    assert error_schema["additionalProperties"] is False
    assert set(error_schema["required"]) == {"error"}
    assert set(error_schema["properties"]["error"]["required"]) == {
        "code",
        "message",
        "requestId",
    }


def test_error_registry_matches_openapi_and_covers_required_categories() -> None:
    spec = load_yaml(OPENAPI_PATH)
    registry = load_json(ERRORS_PATH)
    registered = {item["code"]: item["http_status"] for item in registry["errors"]}
    openapi_codes = set(spec["components"]["schemas"]["ErrorCode"]["enum"])

    assert set(registered) == openapi_codes
    assert {
        "VALIDATION_ERROR",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "INVALID_STATE_TRANSITION",
        "RATE_LIMITED",
        "SERVICE_UNAVAILABLE",
        "INTERNAL_ERROR",
    } <= openapi_codes
    assert registered["VALIDATION_ERROR"] == 422
    assert registered["UNAUTHENTICATED"] == 401
    assert registered["FORBIDDEN"] == 403
    assert registered["NOT_FOUND"] == 404
    assert registered["CONFLICT"] == 409
    assert registered["INVALID_STATE_TRANSITION"] == 409
    assert registered["RATE_LIMITED"] == 429
    assert registered["SERVICE_UNAVAILABLE"] == 503
    assert registered["INTERNAL_ERROR"] == 500


def test_enum_registry_is_synchronized_and_concept_status_has_no_due() -> None:
    spec = load_yaml(OPENAPI_PATH)
    registry = load_json(ENUMS_PATH)
    schemas = spec["components"]["schemas"]

    for schema_name, schema in schemas.items():
        registry_key = schema.get("x-enum-registry")
        if registry_key is not None:
            assert schema["enum"] == registry[registry_key], schema_name

    registered_keys = {
        schema["x-enum-registry"] for schema in schemas.values() if "x-enum-registry" in schema
    }
    enum_keys = {key for key, value in registry.items() if isinstance(value, list)}
    assert registered_keys <= enum_keys
    assert enum_keys - registered_keys == {"content_quality_status"}
    assert len(registry["concept_status"]) == 8
    assert "due" not in registry["concept_status"]
    assert registry["concept_status"] == [
        "unseen",
        "discovered",
        "learning",
        "familiar",
        "active",
        "mastered",
        "weak",
        "forgotten",
    ]


def test_brain_concepts_expose_nullable_mastery_and_aggregate_confidence() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]

    for schema_name in ("BrainConceptSummary", "BrainConceptDetail"):
        schema = schemas[schema_name]
        assert {"mastery", "confidence"} <= set(schema["required"])
        assert schema["properties"]["competence"]["$ref"] == (
            "#/components/schemas/CompetenceSignals"
        )

        mastery_variants = schema["properties"]["mastery"]["oneOf"]
        numeric_mastery = next(
            variant for variant in mastery_variants if variant.get("type") == "number"
        )
        assert numeric_mastery["minimum"] == 0
        assert numeric_mastery["maximum"] == 1
        assert any(variant.get("type") == "null" for variant in mastery_variants)

        confidence = schema["properties"]["confidence"]
        assert confidence == {"type": "number", "minimum": 0, "maximum": 1}


def test_brain_competence_preserves_dimension_score_and_confidence_zero_state() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    signals = schemas["CompetenceSignals"]
    score = schemas["CompetenceScore"]

    assert set(signals["required"]) == {"recognition", "listening", "production"}
    assert all(
        signals["properties"][dimension]["$ref"] == "#/components/schemas/CompetenceScore"
        for dimension in signals["required"]
    )
    assert {"score", "confidence", "evidenceCount"} <= set(score["required"])
    assert score["properties"]["score"] == {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
    }
    assert score["properties"]["confidence"] == {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
    }
    assert score["properties"]["evidenceCount"] == {"type": "integer", "minimum": 0}
    assert score["properties"]["score"]["minimum"] <= 0.5 <= score["properties"]["score"]["maximum"]
    assert score["properties"]["confidence"]["minimum"] == 0

    forbidden = {
        "positiveMass",
        "negativeMass",
        "alpha",
        "beta",
        "projectionLineage",
        "stateVersion",
    }
    for schema_name in ("CompetenceScore", "BrainConceptSummary", "BrainConceptDetail"):
        assert forbidden.isdisjoint(schemas[schema_name]["properties"])


def test_brain_summary_allows_undefined_memory_health_without_a_fake_default() -> None:
    spec = load_yaml(OPENAPI_PATH)
    summary = spec["components"]["schemas"]["BrainSummary"]

    assert "memoryHealth" in summary["required"]
    variants = summary["properties"]["memoryHealth"]["oneOf"]
    numeric = next(variant for variant in variants if variant.get("type") == "number")
    assert numeric == {"type": "number", "minimum": 0, "maximum": 1}
    assert any(variant.get("type") == "null" for variant in variants)
    assert all("default" not in variant for variant in variants)


def test_brain_get_contract_is_read_only_and_existence_hiding() -> None:
    spec = load_yaml(OPENAPI_PATH)
    brain_paths = (
        "/v1/brain/summary",
        "/v1/brain/concepts",
        "/v1/brain/concepts/{conceptId}",
    )

    for path in brain_paths:
        operation = spec["paths"][path]["get"]
        assert "requestBody" not in operation
        assert "404" in operation["responses"]
        assert operation["responses"]["404"]["$ref"] == "#/components/responses/NotFound"
        description = operation["description"].lower()
        assert "read-only" in description
        assert "does not mutate" in description

    for path in ("/v1/brain/summary", "/v1/brain/concepts"):
        description = spec["paths"][path]["get"]["description"].lower()
        assert "missing" in description
        assert "not owned" in description
        assert "404" in description


def test_brain_collection_uses_opaque_keyset_cursor_and_bounded_order() -> None:
    spec = load_yaml(OPENAPI_PATH)
    operation = spec["paths"]["/v1/brain/concepts"]["get"]
    description = " ".join(operation["description"].lower().replace("`", "").split())
    limit = local_ref_target(spec, "#/components/parameters/Limit")
    cursor = local_ref_target(spec, "#/components/parameters/Cursor")

    assert "opaque" in description
    assert "keyset" in description
    assert "canonical key" in description
    assert "concept id" in description
    assert limit["schema"]["maximum"] == 100
    assert "opaque" in cursor["description"].lower()


def test_wire_ids_timestamps_and_ownership_are_consistent() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]

    for schema_name, schema in schemas.items():
        for node in walk(schema):
            if not isinstance(node, Mapping):
                continue
            properties = node.get("properties", {})
            for property_name, property_schema in properties.items():
                assert "_" not in property_name, (
                    f"snake_case wire field: {schema_name}.{property_name}"
                )
                if property_name == "id" or property_name.endswith("Id"):
                    assert property_schema.get("type") == "string", (
                        f"non-string ID: {schema_name}.{property_name}"
                    )
                    assert property_schema.get("format") == "uuid", (
                        f"non-UUID ID: {schema_name}.{property_name}"
                    )
                if property_name.endswith("At"):
                    alternatives = property_schema.get("oneOf")
                    if alternatives is not None:
                        timestamp = next(
                            (
                                candidate
                                for candidate in alternatives
                                if candidate.get("type") == "string"
                            ),
                            None,
                        )
                        assert timestamp is not None, (
                            f"non-string timestamp: {schema_name}.{property_name}"
                        )
                        assert timestamp.get("format") == "date-time", (
                            f"non-RFC3339 timestamp: {schema_name}.{property_name}"
                        )
                        assert any(candidate.get("type") == "null" for candidate in alternatives), (
                            f"invalid nullable timestamp: {schema_name}.{property_name}"
                        )
                    else:
                        assert property_schema.get("type") == "string", (
                            f"non-string timestamp: {schema_name}.{property_name}"
                        )
                        assert property_schema.get("format") == "date-time", (
                            f"non-RFC3339 timestamp: {schema_name}.{property_name}"
                        )

    serialized = json.dumps(spec)
    assert '"userId"' not in serialized
    assert '"request_id"' not in serialized
    assert '"user_id"' not in serialized


def test_cursor_pagination_is_only_on_growing_collections() -> None:
    spec = load_yaml(OPENAPI_PATH)

    for path in PAGINATED_PATHS:
        names = parameter_names(spec, path, "get")
        assert {("cursor", "query"), ("limit", "query")} <= names, path
        schema = success_schema(spec, spec["paths"][path]["get"])
        assert schema["properties"]["meta"]["$ref"] == "#/components/schemas/CursorResponseMeta"

    for path in BOUNDED_GET_PATHS:
        names = parameter_names(spec, path, "get")
        assert ("cursor", "query") not in names, path
        assert ("limit", "query") not in names, path


def test_contract_does_not_expose_raw_database_or_post_mvp_surfaces() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schema_names = set(spec["components"]["schemas"])
    raw_table_names = {
        "Users",
        "LearnerProfiles",
        "UserLanguages",
        "UserConceptStates",
        "UserSkillStates",
        "FsrsStates",
        "ReviewEvents",
        "LearningEvents",
        "ExposureEvents",
        "SourceRecords",
        "ContentMetrics",
        "TodayPlanActivities",
        "AssessmentResponses",
    }

    assert schema_names.isdisjoint(raw_table_names)
    assert "/health" not in spec["paths"]
    forbidden_path_fragments = {
        "tutor",
        "speech",
        "pronunciation",
        "forced-alignment",
        "neo4j",
        "graph",
        "chinese",
        "japanese",
    }
    assert all(
        fragment not in path.lower()
        for path in spec["paths"]
        for fragment in forbidden_path_fragments
    )


def test_review_contract_models_one_memory_lineage_and_separate_competence() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    queue_item = schemas["ReviewQueueItem"]
    answer_result = schemas["ReviewAnswerResult"]
    memory = schemas["MemorySnapshot"]

    assert queue_item["properties"]["memory"]["$ref"] == "#/components/schemas/MemorySnapshot"
    assert answer_result["properties"]["memory"]["$ref"] == "#/components/schemas/MemorySnapshot"
    assert queue_item["properties"]["competence"]["$ref"] == (
        "#/components/schemas/CompetenceSignals"
    )
    assert answer_result["properties"]["competence"]["$ref"] == (
        "#/components/schemas/CompetenceSignals"
    )
    assert not ({"recognition", "listening", "production"} & set(memory["properties"]))
    assert not (
        {"recognitionDueAt", "listeningDueAt", "productionDueAt"} & set(memory["properties"])
    )
    assert not (
        {"difficulty", "stability", "retrievability", "fsrsParams"} & set(memory["properties"])
    )


def test_concept_part_of_speech_is_optional_nullable_for_non_lexical_concepts() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]

    for schema_name in ("ConceptSummary", "ConceptDetail"):
        schema = schemas[schema_name]
        assert "partOfSpeech" not in schema["required"]
        variants = schema["properties"]["partOfSpeech"]["oneOf"]
        assert {variant.get("$ref") for variant in variants if "$ref" in variant} == {
            "#/components/schemas/PartOfSpeech"
        }
        assert any(variant.get("type") == "null" for variant in variants)

    concept_summary_consumers = {
        "ReviewQueueItem": schemas["ReviewQueueItem"]["properties"]["concept"],
        "DictionarySearchResponse": schemas["DictionarySearchResponse"]["properties"]["data"][
            "items"
        ],
        "SavedConceptItem": schemas["SavedConceptItem"]["properties"]["concept"],
        "BrainConceptSummary": schemas["BrainConceptSummary"]["properties"]["concept"],
    }
    assert all(
        reference["$ref"] == "#/components/schemas/ConceptSummary"
        for reference in concept_summary_consumers.values()
    )
    concept_detail_consumers = {
        "ConceptResponse": schemas["ConceptResponse"]["properties"]["data"],
        "BrainConceptDetail": schemas["BrainConceptDetail"]["properties"]["concept"],
    }
    assert all(
        reference["$ref"] == "#/components/schemas/ConceptDetail"
        for reference in concept_detail_consumers.values()
    )
    assert "partOfSpeech" not in schemas["SentenceConceptAnnotation"]["properties"]
    assert "partOfSpeech" not in schemas["TodayActivity"]["properties"]


def test_critical_mutations_are_retry_safe_and_concurrent_edits_are_guarded() -> None:
    spec = load_yaml(OPENAPI_PATH)
    idempotent_mutations = {
        ("/v1/today/{planId}/activities/{activityId}/complete", "post"),
        ("/v1/review/{reviewItemId}/answer", "post"),
        ("/v1/reader/exposures", "post"),
        ("/v1/reader/progress/{contentId}", "put"),
        ("/v1/reader/save-sentence", "post"),
        ("/v1/assessments", "post"),
        ("/v1/assessments/{assessmentId}/responses", "post"),
    }
    guarded_patches = {
        ("/v1/me", "patch"),
        ("/v1/me/languages/{languageProfileId}", "patch"),
    }

    for path, method in idempotent_mutations:
        operation = spec["paths"][path][method]
        names = parameter_names(spec, path, method)
        assert ("Idempotency-Key", "header") in names
        parameter = next(
            parameter
            for parameter in operation["parameters"]
            if local_ref_target(spec, parameter["$ref"])["name"] == "Idempotency-Key"
        )
        assert local_ref_target(spec, parameter["$ref"])["required"] is True

    for path, method in guarded_patches:
        assert ("If-Match", "header") in parameter_names(spec, path, method)


def test_reader_exposure_contract_uses_authoritative_catalog_identity_only() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    operation = spec["paths"]["/v1/reader/exposures"]["post"]

    assert operation["operationId"] == "recordReaderExposure"
    assert ("Idempotency-Key", "header") in parameter_names(spec, "/v1/reader/exposures", "post")
    request = operation["requestBody"]["content"]["application/json"]["schema"]
    assert request["$ref"] == "#/components/schemas/ReaderExposureRequest"
    variants = schemas["ReaderExposureRequest"]["oneOf"]
    assert {variant["$ref"] for variant in variants} == {
        "#/components/schemas/ReaderReadExposureRequest",
        "#/components/schemas/ReaderListenExposureRequest",
        "#/components/schemas/ReaderLookupExposureRequest",
    }

    forbidden = {
        "userId",
        "conceptId",
        "conceptIds",
        "competence",
        "mastery",
        "confidence",
        "fsrsState",
        "evidenceWeight",
        "projectionVersion",
    }
    for schema_name in (
        "ReaderReadExposureRequest",
        "ReaderListenExposureRequest",
        "ReaderLookupExposureRequest",
    ):
        assert schemas[schema_name]["additionalProperties"] is False
        assert forbidden.isdisjoint(schemas[schema_name]["properties"])

    for schema_name in ("ReaderReadExposureRequest", "ReaderListenExposureRequest"):
        assert {"languageProfileId", "contentId", "segmentId", "exposureType"} == set(
            schemas[schema_name]["required"]
        )
    assert {
        "languageProfileId",
        "contentId",
        "segmentId",
        "sentenceId",
        "startOffset",
        "endOffset",
        "exposureType",
    } == set(schemas["ReaderLookupExposureRequest"]["required"])
    lookup_properties = schemas["ReaderLookupExposureRequest"]["properties"]
    assert "utf-16" in lookup_properties["startOffset"]["description"].lower()
    assert "exclusive" in lookup_properties["endOffset"]["description"].lower()
    assert "greater than startoffset" in lookup_properties["endOffset"]["description"].lower()

    result = schemas["ReaderExposureResult"]
    assert set(result["required"]) == {
        "exposureId",
        "contentId",
        "segmentId",
        "exposureType",
        "acceptedConceptCount",
        "occurredAt",
        "recordedAt",
    }
    assert forbidden.isdisjoint(result["properties"])
    description = operation["description"].lower()
    assert "same actor" in description
    assert "fingerprint" in description
    assert "published" in description
    assert "distinct concept" in description


def test_reader_progress_is_a_distinct_retry_safe_segment_projection() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    operation = spec["paths"]["/v1/reader/progress/{contentId}"]["put"]

    assert operation["operationId"] == "updateReaderProgress"
    assert ("Idempotency-Key", "header") in parameter_names(
        spec, "/v1/reader/progress/{contentId}", "put"
    )
    request_ref = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
    assert request_ref == "#/components/schemas/UpdateReaderProgressRequest"
    request = schemas["UpdateReaderProgressRequest"]
    assert request["additionalProperties"] is False
    assert set(request["required"]) == {
        "languageProfileId",
        "currentSegmentId",
        "isCompleted",
    }
    assert set(request["properties"]) == set(request["required"])

    progress = schemas["ReadingProgress"]
    assert set(progress["required"]) == {
        "contentId",
        "currentSegmentId",
        "furthestSegmentId",
        "progressPercent",
        "isCompleted",
        "startedAt",
        "lastOpenedAt",
    }
    assert "completedAt" in progress["properties"]
    assert {
        "competence",
        "mastery",
        "memory",
        "fsrsState",
        "evidenceWeight",
    }.isdisjoint(progress["properties"])
    assert schemas["ContentSummary"]["properties"]["readingProgress"]["$ref"] == (
        "#/components/schemas/ReadingProgress"
    )
    description = operation["description"].lower()
    assert "never regresses" in description
    assert "reopening" in description
    assert "competence" in description
    assert "/v1/reader/exposures" not in json.dumps(operation)


def test_reader_save_sentence_is_catalog_only_and_server_resolves_concepts() -> None:
    spec = load_yaml(OPENAPI_PATH)
    operation = spec["paths"]["/v1/reader/save-sentence"]["post"]
    request = spec["components"]["schemas"]["SaveSentenceRequest"]

    assert request["additionalProperties"] is False
    assert set(request["required"]) == {"sentenceId"}
    assert set(request["properties"]) == {"sentenceId"}
    serialized = json.dumps(operation).lower()
    assert "catalog" in serialized
    assert "published" in serialized
    assert "server" in serialized and "concept" in serialized
    assert "already saved" in serialized
    assert ("Idempotency-Key", "header") in parameter_names(
        spec, "/v1/reader/save-sentence", "post"
    )


def test_content_contract_states_publication_and_attribution_boundary() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    content_summary = schemas["ContentSummary"]
    attribution = schemas["Attribution"]
    serialized_paths = json.dumps(spec["paths"]).lower()

    assert "qualitystatus" not in json.dumps(content_summary).lower()
    assert {"sourceName", "licenseCode", "attributionText"} <= set(attribution["properties"])
    assert "published" in serialized_paths
    assert "provenance" in serialized_paths


def test_starting_level_is_an_estimate_with_evidence_not_certification() -> None:
    spec = load_yaml(OPENAPI_PATH)
    estimate = spec["components"]["schemas"]["StartingLevelEstimate"]
    properties = set(estimate["properties"])

    assert {
        "level",
        "confidence",
        "confidenceBand",
        "assessedSkills",
        "evidenceCount",
        "methodVersion",
    } <= properties
    serialized = json.dumps(estimate).lower()
    assert "estimate" in serialized
    assert "certification" not in serialized
    assert "irt" not in serialized


def test_starting_level_answer_union_is_exclusive_and_server_authoritative() -> None:
    spec = load_yaml(OPENAPI_PATH)
    request = spec["components"]["schemas"]["SubmitAssessmentResponseRequest"]

    assert "anyOf" not in request
    assert len(request["oneOf"]) == 2
    selected, skipped = request["oneOf"]
    assert set(selected["required"]) == {"itemId", "selectedOptionId", "responseTimeMs"}
    assert set(selected["properties"]) == {
        "itemId",
        "selectedOptionId",
        "responseTimeMs",
    }
    assert selected["additionalProperties"] is False
    assert set(skipped["required"]) == {"itemId", "skipped", "responseTimeMs"}
    assert set(skipped["properties"]) == {"itemId", "skipped", "responseTimeMs"}
    assert skipped["properties"]["skipped"]["const"] is True
    assert skipped["additionalProperties"] is False

    serialized = json.dumps(request).lower()
    for forbidden in ("correct", "score", "estimatedlevel", "confidence"):
        assert forbidden not in serialized


def test_starting_level_start_distinguishes_create_resume_and_exact_replay() -> None:
    spec = load_yaml(OPENAPI_PATH)
    operation = spec["paths"]["/v1/assessments"]["post"]

    assert {"200", "201"} <= set(operation["responses"])
    assert success_schema(spec, {"responses": {"200": operation["responses"]["200"]}}) == (
        success_schema(spec, {"responses": {"201": operation["responses"]["201"]}})
    )
    assert ("Idempotency-Key", "header") in parameter_names(spec, "/v1/assessments", "post")
    description = " ".join(operation["description"].lower().replace("`", "").split())
    for phrase in (
        "201",
        "new attempt",
        "200",
        "existing",
        "one in_progress",
        "exact replay",
        "idempotency_key_reused",
        "no retake",
    ):
        assert phrase in description


def test_starting_level_contract_freezes_policy_scale_confidence_and_length() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    estimate = schemas["StartingLevelEstimate"]
    band = schemas["StartingLevelBand"]
    progress = schemas["AssessmentProgress"]
    session = schemas["AssessmentSession"]

    assert schemas["StartingLevelBandCode"]["enum"] == ["A0", "A1", "A2", "B1"]
    assert band["properties"]["code"]["$ref"].endswith("/StartingLevelBandCode")
    assert "lingua-defined pre-a1" in json.dumps(band).lower()
    assert estimate["properties"]["confidence"]["maximum"] == 0.85
    assert estimate["properties"]["confidence"]["multipleOf"] == 0.01
    assert estimate["properties"]["methodVersion"]["const"] == ("starting-level-heuristic-v1")
    assert session["properties"]["methodVersion"]["const"] == ("starting-level-heuristic-v1")
    assert progress["properties"]["answeredCount"]["maximum"] == 16
    assert progress["properties"]["minimumItemCount"]["const"] == 8
    assert progress["properties"]["maximumItemCount"]["const"] == 16
    assert "completedAt" in session["required"]
    assert {entry.get("type") for entry in session["properties"]["completedAt"]["oneOf"]} == {
        "string",
        "null",
    }


def test_starting_level_questions_expose_domains_but_no_answer_or_scoring_authority() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    item = schemas["AssessmentItem"]
    option = schemas["AssessmentOption"]

    assert schemas["AssessmentDomain"]["enum"] == [
        "vocabulary_recognition",
        "grammar_in_context",
        "reading_comprehension",
        "listening_comprehension",
    ]
    assert "domain" in item["required"]
    assert item["properties"]["domain"]["$ref"] == ("#/components/schemas/AssessmentDomain")
    assert item["properties"]["options"]["minItems"] == 4
    assert item["properties"]["options"]["maxItems"] == 4
    assert set(option["properties"]) == {"id", "text"}
    serialized = json.dumps(item).lower()
    for forbidden in ("correctoption", "answerkey", "difficulty", "boundarymargin"):
        assert forbidden not in serialized


def test_starting_level_contract_has_no_retake_and_remains_optional_and_isolated() -> None:
    spec = load_yaml(OPENAPI_PATH)

    assert not any("retake" in path for path in spec["paths"])
    language_profile = spec["components"]["schemas"]["LanguageProfile"]
    starting_estimate = language_profile["properties"]["startingLevelEstimate"]
    assert any(entry.get("type") == "null" for entry in starting_estimate["oneOf"])
    today = json.dumps(spec["paths"]["/v1/today"]).lower()
    for forbidden in ("assessment", "starting level", "startinglevel"):
        assert forbidden not in today


def test_starting_level_contract_freezes_ownership_lifecycle_and_listening() -> None:
    spec = load_yaml(OPENAPI_PATH)
    paths = spec["paths"]
    schemas = spec["components"]["schemas"]

    get_description = " ".join(
        paths["/v1/assessments/{assessmentId}"]["get"]["description"].lower().split()
    )
    assert "missing assessment" in get_description
    assert "not owned" in get_description
    assert "same 404" in get_description
    assert "archived" in get_description
    assert "readable" in get_description

    answer = paths["/v1/assessments/{assessmentId}/responses"]["post"]
    assert ("Idempotency-Key", "header") in parameter_names(
        spec, "/v1/assessments/{assessmentId}/responses", "post"
    )
    answer_description = " ".join(answer["description"].lower().split())
    for phrase in (
        "current item",
        "sole authority",
        "exact idempotency-key replay",
        "idempotency_key_reused",
        "invalid_state_transition",
        "same 404",
    ):
        assert phrase in answer_description

    item = schemas["AssessmentItem"]
    listening_rule = item["allOf"][0]
    assert listening_rule["if"]["properties"]["domain"]["const"] == ("listening_comprehension")
    assert listening_rule["then"]["required"] == ["audioUrl"]

    estimate = schemas["StartingLevelEstimate"]
    assert estimate["properties"]["assessedSkills"]["items"]["enum"] == [
        "recognition",
        "listening",
    ]
    assert estimate["properties"]["evidenceCount"]["minimum"] == 6
    assert schemas["AssessmentStatus"]["enum"] == [
        "in_progress",
        "completed",
        "abandoned",
    ]


def test_profile_bootstrap_contract_is_minimal_nullable_and_cache_safe() -> None:
    spec = load_yaml(OPENAPI_PATH)
    me = spec["components"]["schemas"]["MeProfile"]
    operation = spec["paths"]["/v1/me"]["get"]
    response = operation["responses"]["200"]

    assert {"email", "timeZone"} <= set(me["required"])
    assert set(me["properties"]["email"]["type"]) == {"string", "null"}
    assert me["properties"]["email"]["format"] == "email"
    assert set(me["properties"]["timeZone"]["type"]) == {"string", "null"}

    cache_header = response["headers"]["Cache-Control"]
    cache_header = local_ref_target(spec, cache_header["$ref"])
    assert cache_header["schema"]["const"] == "private, no-store"

    description = " ".join(operation["description"].lower().replace("`", "").split())
    for phrase in (
        "only bootstrap",
        "public.users",
        "learner_profiles",
        "one transaction",
        "concurrent",
        "does not create a language profile",
    ):
        assert phrase in description
    assert "403" in operation["responses"]
    assert not any("bootstrap" in path and path != "/v1/me" for path in spec["paths"])


def test_profile_contract_freezes_pair_readiness_and_retry_semantics() -> None:
    spec = load_yaml(OPENAPI_PATH)
    schemas = spec["components"]["schemas"]
    create = spec["paths"]["/v1/me/languages"]["post"]
    create_request = schemas["CreateLanguageProfileRequest"]

    assert set(create_request["required"]) == {
        "targetLanguageCode",
        "nativeLanguageCode",
        "goal",
        "dailyMinutes",
    }
    assert create_request["properties"]["targetLanguageCode"]["allOf"][1]["const"] == "en"
    assert create_request["properties"]["nativeLanguageCode"]["allOf"][1]["const"] == "vi"
    assert create_request["properties"]["dailyMinutes"]["minimum"] == 5
    assert create_request["properties"]["dailyMinutes"]["maximum"] == 180
    assert create_request["properties"]["goal"]["$ref"] == ("#/components/schemas/LearningGoal")
    assert ("Idempotency-Key", "header") in parameter_names(spec, "/v1/me/languages", "post")

    description = " ".join(create["description"].lower().replace("`", "").split())
    for phrase in (
        "valid iana timezone",
        "exact replay",
        "original data",
        "original etag",
        "idempotency_key_reused",
        "starting level",
        "not required",
    ):
        assert phrase in description

    serialized = json.dumps(spec)
    assert "onboardingComplete" not in serialized
    assert '"userId"' not in serialized
    for forbidden in ("password", "refreshToken", "sessionToken"):
        assert forbidden not in serialized


def test_profile_preconditions_resource_hiding_and_downstream_no_bootstrap_are_explicit() -> None:
    spec = load_yaml(OPENAPI_PATH)
    guarded = (
        ("/v1/me", "patch"),
        ("/v1/me/languages/{languageProfileId}", "patch"),
    )
    for path, method in guarded:
        operation = spec["paths"][path][method]
        assert ("If-Match", "header") in parameter_names(spec, path, method)
        assert operation["responses"]["412"]["$ref"] == (
            "#/components/responses/PreconditionFailed"
        )
        description = " ".join(operation["description"].lower().split())
        assert "missing" in description
        assert "stale" in description
        assert "412" in description

    hidden = spec["paths"]["/v1/me/languages/{languageProfileId}"]["patch"]
    assert hidden["responses"]["404"]["$ref"] == "#/components/responses/NotFound"
    hidden_description = " ".join(hidden["description"].lower().split())
    assert "missing" in hidden_description
    assert "not owned" in hidden_description
    assert "before" in hidden_description and "etag" in hidden_description

    bootstrap_required = {
        ("/v1/me", "patch"),
        ("/v1/me/languages", "get"),
        ("/v1/me/languages", "post"),
        ("/v1/review/queue", "get"),
        ("/v1/dictionary/search", "get"),
        ("/v1/reader/analyze", "post"),
        ("/v1/content/recommended", "get"),
        ("/v1/library/items", "get"),
        ("/v1/assessments", "post"),
    }
    for path, method in bootstrap_required:
        assert spec["paths"][path][method]["responses"]["404"]["$ref"] == (
            "#/components/responses/NotFound"
        )

    top_level_policy = " ".join(spec["info"]["description"].lower().replace("`", "").split())
    assert "no operation other than get /v1/me" in top_level_policy
    assert "404 not_found" in top_level_policy


def test_today_contract_distinguishes_missing_profile_from_timezone_not_ready() -> None:
    spec = load_yaml(OPENAPI_PATH)
    operation = spec["paths"]["/v1/today"]["get"]

    assert operation["responses"]["404"]["$ref"] == "#/components/responses/NotFound"
    assert operation["responses"]["409"]["$ref"] == (
        "#/components/responses/InvalidStateTransition"
    )
    description = " ".join(operation["description"].lower().split())
    assert "timezone" in description
    assert "409" in description
    assert "no plan" in description
    assert "server" in description and "fallback" in description
