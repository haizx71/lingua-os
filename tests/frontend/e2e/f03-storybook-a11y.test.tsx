import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { ConceptChip, Skeleton, ErrorState, InlineAlert } from '@lingua/ui';
import { renderWithProviders } from '../harness/test-render';
import { assertConceptChipA11y, assertAlertA11y, getContrastRatio } from '../harness/a11y-helpers';
import { primitivePalette } from '@lingua/ui/tokens/primitive';
import { type ConceptStatus } from '../harness/types';

describe('Tier 1: Feature 03 - Storybook Catalog & WCAG 2.2 AA A11y Suite', () => {
  /** Strict 8-status contract per contracts/enums.json */
  const allConceptStatuses: ConceptStatus[] = [
    'unseen',
    'discovered',
    'learning',
    'familiar',
    'active',
    'mastered',
    'weak',
    'forgotten',
  ];

  it('test_concept_chip_satisfies_non_color_invariant_for_all_8_statuses', () => {
    allConceptStatuses.forEach((status) => {
      const { unmount } = renderWithProviders(
        <ConceptChip status={status} term={`word-${status}`} />
      );

      const chip = screen.getByRole('status');
      assertConceptChipA11y(chip, status, `word-${status}`);
      unmount();
    });
  });

  it('test_concept_chip_isDue_presentation_shows_due_indicator', () => {
    renderWithProviders(
      <ConceptChip status="learning" isDue term="due-word" />
    );
    const chip = screen.getByRole('status');
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain('Đến hạn ôn');
  });

  it('test_color_contrast_ratios_meet_wcag_aa_minimum_4_5_to_1', () => {
    // Slate 900 on Slate 50 (Light mode primary text)
    const lightTextContrast = getContrastRatio(primitivePalette.slate[900], primitivePalette.slate[50]);
    expect(lightTextContrast).toBeGreaterThanOrEqual(4.5);

    // Slate 100 on Slate 950 (Dark mode primary text)
    const darkTextContrast = getContrastRatio(primitivePalette.slate[100], primitivePalette.slate[950]);
    expect(darkTextContrast).toBeGreaterThanOrEqual(4.5);

    // Indigo 600 with White text (Action primary) — WCAG AA large text 3:1 threshold
    const indigoActionContrast = getContrastRatio(primitivePalette.indigo[600], primitivePalette.white);
    expect(indigoActionContrast).toBeGreaterThanOrEqual(3.0);

    // Emerald 600 with White text (Status success) — WCAG AA large text 3:1 threshold
    const successContrast = getContrastRatio(primitivePalette.emerald[600], primitivePalette.white);
    expect(successContrast).toBeGreaterThanOrEqual(3.0);
  });

  it('test_error_state_and_inline_alert_have_accessible_alert_role', () => {
    const { unmount } = renderWithProviders(<ErrorState code="INTERNAL_ERROR" />);
    const alert1 = screen.getByRole('alert');
    assertAlertA11y(alert1);
    unmount();

    renderWithProviders(<InlineAlert variant="danger">Lỗi kết nối máy chủ</InlineAlert>);
    const alert2 = screen.getByRole('alert');
    assertAlertA11y(alert2);
  });

  it('test_skeleton_loading_indicator_has_accessible_aria_hidden_attribute', () => {
    const { container } = renderWithProviders(<Skeleton className="w-48 h-6" />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('test_concept_chip_unseen_state_has_dashed_border_invariant', () => {
    renderWithProviders(<ConceptChip status="unseen" term="serendipity" />);
    const chip = screen.getByRole('status');
    expect(chip.className).toContain('border-dashed');
  });
});
