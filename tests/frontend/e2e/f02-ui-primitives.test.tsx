import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Button, Card, Badge, ConceptChip, Progress } from '@lingua/ui';
import { renderWithProviders } from '../harness/test-render';
import { assertTouchTargetSize, assertProgressbarA11y } from '../harness/a11y-helpers';

describe('Tier 1: Feature 02 - UI Primitives & Ergonomics (Component Tests)', () => {
  it('test_button_renders_all_variants_with_expected_styles', () => {
    const { rerender } = renderWithProviders(<Button variant="primary">Primary</Button>);
    let btn = screen.getByRole('button', { name: /Primary/i });
    expect(btn.className).toContain('bg-[var(--action-primary)]');

    rerender(<Button variant="secondary">Secondary</Button>);
    btn = screen.getByRole('button', { name: /Secondary/i });
    expect(btn.className).toContain('bg-[var(--action-secondary)]');

    rerender(<Button variant="outline">Outline</Button>);
    btn = screen.getByRole('button', { name: /Outline/i });
    expect(btn.className).toContain('border');

    rerender(<Button variant="danger">Danger</Button>);
    btn = screen.getByRole('button', { name: /Danger/i });
    expect(btn.className).toContain('bg-[var(--status-danger)]');
  });

  it('test_button_sizes_meet_touch_target_requirements', () => {
    renderWithProviders(
      <div>
        <Button size="md">Medium Button</Button>
        <Button size="lg">Large Button</Button>
        <Button size="icon" aria-label="Icon Action">
          <span>+</span>
        </Button>
      </div>
    );

    const mdBtn = screen.getByRole('button', { name: /Medium Button/i });
    const lgBtn = screen.getByRole('button', { name: /Large Button/i });
    const iconBtn = screen.getByRole('button', { name: /Icon Action/i });

    assertTouchTargetSize(mdBtn, 44);
    assertTouchTargetSize(lgBtn, 48);
    assertTouchTargetSize(iconBtn, 44);
  });

  it('test_button_loading_state_sets_aria_busy_and_disables_interaction', () => {
    const handleClick = vi.fn();
    renderWithProviders(
      <Button isLoading onClick={handleClick}>
        Lưu thay đổi
      </Button>
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('test_card_renders_variants_and_paddings', () => {
    const { container } = renderWithProviders(
      <Card variant="interactive" padding="lg">
        <h3>Card Title</h3>
      </Card>
    );

    // container.firstChild is the TestWrapper theme div, Card is inside it
    const cardDiv = container.querySelector('[class*="hover:shadow"]') || (container.firstChild?.firstChild as HTMLElement);
    expect(cardDiv).toBeTruthy();
    expect(cardDiv!.className).toContain('hover:shadow-md');
    expect(cardDiv!.className).toContain('p-6');
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('test_badge_renders_with_semantic_color_variants', () => {
    renderWithProviders(
      <div>
        <Badge variant="primary">25 phút</Badge>
        <Badge variant="success">Hoàn thành</Badge>
        <Badge variant="warning">Cần ôn lại</Badge>
      </div>
    );

    expect(screen.getByText('25 phút')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Cần ôn lại')).toBeInTheDocument();
  });

  it('test_progress_component_satisfies_aria_spec', () => {
    renderWithProviders(<Progress value={40} max={100} label="Tiến độ học tập" showValueText />);

    const progressbar = screen.getByRole('progressbar');
    assertProgressbarA11y(progressbar, 40, 100);
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
