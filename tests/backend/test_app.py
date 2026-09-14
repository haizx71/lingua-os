from fastapi.testclient import TestClient
from lingua_api.main import app

client = TestClient(app)


def test_health_reports_the_api_is_ready() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "lingua-api",
        "status": "ok",
        "version": "0.1.0",
    }


def test_application_publishes_only_the_authorized_implemented_endpoints() -> None:
    published_paths = set(app.openapi()["paths"])

    assert published_paths == {
        "/v1/admin/content",
        "/v1/admin/content/{contentId}",
        "/v1/admin/content/{contentId}/validate",
        "/v1/admin/content/{contentId}/publish",
        "/v1/admin/content/{contentId}/retire",
        "/v1/admin/concepts/search",
        "/v1/admin/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}",
        "/v1/me",
        "/v1/me/languages",
        "/v1/me/languages/{languageProfileId}",
        "/v1/review/queue",
        "/v1/review/{reviewItemId}/answer",
        "/v1/content/recommended",
        "/v1/content/{contentId}",
        "/v1/reader/exposures",
        "/v1/reader/progress/{contentId}",
        "/v1/reader/save-sentence",
        "/v1/today",
        "/v1/today/{planId}/activities/{activityId}/complete",
        "/v1/brain/summary",
        "/v1/brain/concepts",
        "/v1/brain/concepts/{conceptId}",
        "/v1/concepts/{conceptId}",
        "/v1/dictionary/search",
        "/v1/reader/analyze",
        "/v1/assessments",
        "/v1/assessments/{assessmentId}",
        "/v1/assessments/{assessmentId}/responses",
        "/v1/library/items",
        "/v1/library/concepts/{conceptId}",
        "/v1/library/content/{contentId}",
        "/v1/library/sentences/{sentenceId}",
    }
    assert "/health" not in published_paths


def test_admin_runtime_metadata_preserves_the_owner_content_contract() -> None:
    generated = app.openapi()
    operations = (
        (
            "/v1/admin/concepts/search",
            "get",
            "searchAdminConcepts",
            {"200", "401", "403", "422", "500"},
        ),
        ("/v1/admin/content", "get", "listAdminContent", {"200", "401", "403", "422", "500"}),
        (
            "/v1/admin/content",
            "post",
            "createAdminContent",
            {"201", "401", "403", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}",
            "get",
            "getAdminContent",
            {"200", "401", "403", "404", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}",
            "patch",
            "updateAdminContent",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}/validate",
            "post",
            "validateAdminContent",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}/publish",
            "post",
            "publishAdminContent",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}/retire",
            "post",
            "retireAdminContent",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}",
            "put",
            "putAdminSentenceConcept",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
        (
            "/v1/admin/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}",
            "delete",
            "deleteAdminSentenceConcept",
            {"200", "401", "403", "404", "409", "422", "500"},
        ),
    )
    for path, method, operation_id, responses in operations:
        operation = generated["paths"][path][method]
        assert operation["operationId"] == operation_id
        assert set(operation["responses"]) == responses
        assert operation["security"] == [{"bearerAuth": []}]


def test_profile_runtime_metadata_preserves_the_five_frozen_operations() -> None:
    generated = app.openapi()
    operations = (
        ("/v1/me", "get", "getMe", {"200", "401", "403", "422", "500"}),
        (
            "/v1/me",
            "patch",
            "updateMe",
            {"200", "401", "403", "404", "412", "422", "500"},
        ),
        (
            "/v1/me/languages",
            "get",
            "listMyLanguageProfiles",
            {"200", "401", "404", "422", "500"},
        ),
        (
            "/v1/me/languages",
            "post",
            "createMyLanguageProfile",
            {"201", "401", "404", "409", "422", "500"},
        ),
        (
            "/v1/me/languages/{languageProfileId}",
            "patch",
            "updateMyLanguageProfile",
            {"200", "401", "403", "404", "412", "422", "500"},
        ),
    )

    for path, method, operation_id, responses in operations:
        operation = generated["paths"][path][method]
        assert operation["operationId"] == operation_id
        assert set(operation["responses"]) == responses
        assert operation["security"] == [{"bearerAuth": []}]

    get_headers = generated["paths"]["/v1/me"]["get"]["responses"]["200"]["headers"]
    assert {"ETag", "Cache-Control"} <= set(get_headers)
    for path in ("/v1/me", "/v1/me/languages/{languageProfileId}"):
        parameters = generated["paths"][path]["patch"]["parameters"]
        assert any(
            item["name"] == "If-Match" and item["in"] == "header" and item["required"] is True
            for item in parameters
        )


def test_brain_runtime_metadata_preserves_the_frozen_contract() -> None:
    generated = app.openapi()
    operations = (
        ("/v1/brain/summary", "getBrainSummary"),
        ("/v1/brain/concepts", "listBrainConcepts"),
        ("/v1/brain/concepts/{conceptId}", "getBrainConcept"),
    )
    for path, operation_id in operations:
        operation = generated["paths"][path]["get"]
        assert operation["operationId"] == operation_id
        assert set(operation["responses"]) == {"200", "401", "404", "422", "500"}
        assert operation["security"] == [{"bearerAuth": []}]

    schemas = generated["components"]["schemas"]
    assert {"mastery", "confidence"} <= set(schemas["BrainConceptSummaryDto"]["required"])
    assert {"mastery", "confidence", "memory"} <= set(schemas["BrainConceptDetailDto"]["required"])
    assert {"memoryHealth", "startingLevelEstimate"} <= set(schemas["BrainSummaryDto"]["required"])
