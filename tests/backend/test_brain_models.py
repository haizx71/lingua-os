from uuid import uuid4

from lingua_api.brain.models import (
    ConceptDefinitionDto,
    ConceptExampleDto,
    GrammarSpecificationDto,
    GrammarStructuralSlotDto,
)


def test_optional_bounded_brain_text_accepts_absent_catalog_values() -> None:
    definition = ConceptDefinitionDto(
        definition="exist or live",
        translation=None,
        language_code="en",
        order=1,
    )
    example = ConceptExampleDto(
        sentence_id=uuid4(),
        text="I want to be ready.",
        translation=None,
        audio_url=None,
    )
    grammar = GrammarSpecificationDto(
        pattern_formula="S + be + complement",
        syntactic_category="copular_clause",
        pragmatic_function="Describe identity or state.",
        vietnamese_explanation="Dùng be để mô tả danh tính hoặc trạng thái.",
        vietnamese_common_traps=None,
        structural_slots=[
            GrammarStructuralSlotDto(
                label="S",
                role="subject",
                required=True,
                examples=["I"],
            )
        ],
    )

    assert definition.translation is None
    assert example.translation is None
    assert grammar.vietnamese_common_traps is None
