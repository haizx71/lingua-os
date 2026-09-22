"""Authenticated FastAPI transport adapters for Language Brain v1."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Security
from pydantic import StringConstraints
from pydantic.json_schema import SkipJsonSchema

from lingua_api.brain.domain import (
    AttributionProjection,
    BrainConceptDetailProjection,
    BrainConceptListItem,
    BrainConceptProjection,
    BrainSummaryProjection,
    ConceptIdentityProjection,
    MemoryProjection,
)
from lingua_api.brain.models import (
    AttributionDto,
    BrainConceptDetailDto,
    BrainConceptListResponseDto,
    BrainConceptResponseDto,
    BrainConceptSummaryDto,
    BrainSummaryDto,
    BrainSummaryResponseDto,
    ConceptDefinitionDto,
    ConceptDetailDto,
    ConceptExampleDto,
    ConceptLearnerProjectionDto,
    ConceptRelationDto,
    ConceptStatusCountsDto,
    EvidenceSummaryDto,
    GrammarSpecificationDto,
    GrammarStructuralSlotDto,
)
from lingua_api.brain.service import BrainApplication
from lingua_api.competence.domain import (
    CompetenceProjection,
    CompetenceScoreProjection,
    ConceptStatus,
)
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import (
    CompetenceScoreDto,
    CompetenceSignalsDto,
    ConceptStatusDto,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ErrorEnvelopeDto,
    MemorySnapshotDto,
    MemoryStateDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
)
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/brain", tags=["Brain"])

RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    404: {"model": ErrorEnvelopeDto, "description": "Profile or concept not found."},
    422: {"model": ErrorEnvelopeDto, "description": "Request validation failed."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
}


@router.get(
    "/summary",
    operation_id="getBrainSummary",
    response_model=BrainSummaryResponseDto,
    responses=RESPONSES,
)
def get_brain_summary(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
) -> BrainSummaryResponseDto:
    application = cast(BrainApplication, request.app.state.brain_application)
    summary = application.get_summary(actor=actor, language_profile_id=language_profile_id)
    return BrainSummaryResponseDto(
        data=_summary(summary), meta=ResponseMetaDto(request_id=request.state.request_id)
    )


@router.get(
    "/concepts",
    operation_id="listBrainConcepts",
    response_model=BrainConceptListResponseDto,
    responses=RESPONSES,
)
def list_brain_concepts(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
    status: Annotated[ConceptStatusDto | SkipJsonSchema[None], Query()] = None,
    query: Annotated[
        Annotated[str, StringConstraints(min_length=1, max_length=120)] | SkipJsonSchema[None],
        Query(),
    ] = None,
    cursor: Annotated[
        Annotated[str, StringConstraints(max_length=512)] | SkipJsonSchema[None], Query()
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BrainConceptListResponseDto:
    application = cast(BrainApplication, request.app.state.brain_application)
    page = application.list_concepts(
        actor=actor,
        language_profile_id=language_profile_id,
        status=None if status is None else ConceptStatus(status.value),
        query=query,
        cursor=cursor,
        limit=limit,
    )
    return BrainConceptListResponseDto(
        data=[_concept_summary(item) for item in page.items],
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(page.items),
        ),
    )


@router.get(
    "/concepts/{conceptId}",
    operation_id="getBrainConcept",
    response_model=BrainConceptResponseDto,
    responses=RESPONSES,
)
def get_brain_concept(
    request: Request,
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> BrainConceptResponseDto:
    application = cast(BrainApplication, request.app.state.brain_application)
    detail = application.get_concept(actor=actor, concept_id=concept_id)
    return BrainConceptResponseDto(
        data=brain_concept_detail_dto(detail),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _summary(value: BrainSummaryProjection) -> BrainSummaryDto:
    counts = {status.value: count for status, count in value.status_counts.items()}
    return BrainSummaryDto(
        language_profile_id=value.language_profile_id,
        status_counts=ConceptStatusCountsDto(total=sum(counts.values()), **counts),
        due_count=value.due_count,
        memory_health=None,
        competence=_competence(value.competence),
        starting_level_estimate=None,
        recent_concepts=[_concept_summary(item) for item in value.recent_concepts],
        calculated_at=value.calculated_at,
    )


def _concept_summary(item: BrainConceptListItem) -> BrainConceptSummaryDto:
    learner = item.learner
    return BrainConceptSummaryDto(
        concept=_identity(item.identity, learner),
        competence=_competence(learner.competence),
        mastery=learner.mastery,
        confidence=learner.confidence,
        memory=None if learner.memory is None else _memory(learner.memory),
        exposure_count=learner.exposure_count,
        last_seen_at=learner.last_seen_at,
    )


def brain_concept_detail_dto(value: BrainConceptDetailProjection) -> BrainConceptDetailDto:
    learner = value.learner
    learner_dto = _learner(learner)
    identity = value.identity
    concept = ConceptDetailDto(
        id=identity.id,
        language_code=identity.language_code,
        canonical_form=identity.canonical_form,
        part_of_speech=identity.part_of_speech,
        level=_level(identity),
        definitions=[
            ConceptDefinitionDto(
                definition=item.definition,
                translation=item.translation,
                language_code=item.language_code,
                order=item.order,
            )
            for item in value.definitions
        ],
        examples=[
            ConceptExampleDto(
                sentence_id=item.sentence_id,
                text=item.text,
                translation=item.translation,
                audio_url=item.audio_url,
            )
            for item in value.examples
        ],
        relations=[
            ConceptRelationDto(
                concept_id=item.concept_id,
                relation_type=item.relation_type,
                canonical_form=item.canonical_form,
            )
            for item in value.relations
        ],
        grammar=None
        if value.grammar is None
        else GrammarSpecificationDto(
            pattern_formula=value.grammar.pattern_formula,
            syntactic_category=value.grammar.syntactic_category,
            pragmatic_function=value.grammar.pragmatic_function,
            vietnamese_explanation=value.grammar.vietnamese_explanation,
            vietnamese_common_traps=value.grammar.vietnamese_common_traps,
            structural_slots=[
                GrammarStructuralSlotDto(
                    label=slot.label,
                    role=slot.role,
                    required=slot.required,
                    examples=list(slot.examples),
                )
                for slot in value.grammar.structural_slots
            ],
        ),
        learner=learner_dto,
        attribution=_attribution(identity.attribution),
    )
    return BrainConceptDetailDto(
        concept=concept,
        status=ConceptStatusDto(learner.status.value),
        competence=_competence(learner.competence),
        mastery=learner.mastery,
        confidence=learner.confidence,
        memory=None if learner.memory is None else _memory(learner.memory),
        evidence=EvidenceSummaryDto(
            exposure_count=value.evidence.exposure_count,
            review_count=value.evidence.review_count,
            last_seen_at=value.evidence.last_seen_at,
            last_reviewed_at=value.evidence.last_reviewed_at,
        ),
    )


def _identity(
    identity: ConceptIdentityProjection, learner: BrainConceptProjection
) -> ConceptSummaryDto:
    return ConceptSummaryDto(
        id=identity.id,
        canonical_form=identity.canonical_form,
        part_of_speech=identity.part_of_speech,
        level=_level(identity),
        status=ConceptStatusDto(learner.status.value),
        is_due=learner.memory is not None and learner.memory.is_due,
    )


def _learner(value: BrainConceptProjection) -> ConceptLearnerProjectionDto:
    return ConceptLearnerProjectionDto(
        status=ConceptStatusDto(value.status.value),
        is_due=value.memory is not None and value.memory.is_due,
        exposure_count=value.exposure_count,
        last_seen_at=value.last_seen_at,
        memory=None if value.memory is None else _memory(value.memory),
        competence=_competence(value.competence),
    )


def _competence(value: CompetenceProjection) -> CompetenceSignalsDto:
    return CompetenceSignalsDto(
        recognition=_score(value.recognition),
        listening=_score(value.listening),
        production=_score(value.production),
    )


def _score(value: CompetenceScoreProjection) -> CompetenceScoreDto:
    return CompetenceScoreDto(
        score=value.score,
        confidence=value.confidence,
        evidence_count=value.evidence_count,
        updated_at=value.updated_at,
    )


def _memory(value: MemoryProjection) -> MemorySnapshotDto:
    return MemorySnapshotDto(
        state=MemoryStateDto(value.state),
        due_at=value.due_at,
        last_reviewed_at=value.last_reviewed_at,
        is_due=value.is_due,
    )


def _level(identity: ConceptIdentityProjection) -> ProficiencyLevelDto | None:
    if identity.level is None:
        return None
    return ProficiencyLevelDto(
        framework_code=identity.level.framework_code,
        code=identity.level.code,
        label=identity.level.label,
    )


def _attribution(value: AttributionProjection | None) -> AttributionDto | None:
    if value is None:
        return None
    return AttributionDto(
        source_name=value.source_name,
        license_code=value.license_code,
        attribution_text=value.attribution_text,
        source_url=value.source_url,
    )
