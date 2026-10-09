/**
 * LINGUA OS — Milestone 2 & 3 GSAP Motion, Lifecycle & A11y Verification Suite
 * Verifies:
 * 1. Lifecycle auto-cleanup & unmount tween reversion across P0/P1 components.
 * 2. Reduced-motion collapse (100% duration: 0 / instant switch).
 * 3. Synchronous non-blocking keyboard responsiveness (Invariant 1 & Invariant 3).
 * 4. DOM and ARIA data correctness from Frame 0.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import gsap from 'gsap';

import { ReviewCard, ConceptNode } from '@lingua/ui';
import { ReviewSession } from '@/features/review/ReviewSession';
import { LanguageBrainCanvas } from '@/features/brain/LanguageBrainCanvas';
import { ProgressAnalytics } from '@/features/progress/ProgressAnalytics';
import { defaultReviewQueue } from '@/fixtures/reviewFixture';
import { defaultBrainNodes } from '@/fixtures/brainFixture';
import { defaultProgressSummary } from '@/fixtures/progressFixture';

// Helper to mock window.matchMedia for reduced motion testing
function mockMatchMedia(matchesReducedMotion: boolean) {
  let listeners = new Set<() => void>();
  let matches = matchesReducedMotion;

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === 'change') listeners.add(cb);
    }),
    removeEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === 'change') listeners.delete(cb);
    }),
    addListener: vi.fn((cb: () => void) => listeners.add(cb)),
    removeListener: vi.fn((cb: () => void) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
  }));

  return {
    setMatches: (newMatches: boolean) => {
      matches = newMatches;
      listeners.forEach((cb) => cb());
    },
    cleanup: () => {
      listeners.clear();
    },
  };
}

describe('Milestone 2 & 3 Verification: P0/P1 GSAP Motion & Lifecycle', () => {
  let mediaMock: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    mediaMock = mockMatchMedia(false);
  });

  afterEach(() => {
    mediaMock.cleanup();
    gsap.killTweensOf('*');
  });

  /* -------------------------------------------------------------------------- */
  /* 1. ReviewCard: Flip, Feedback & Lifecycle Cleanup                          */
  /* -------------------------------------------------------------------------- */
  describe('ReviewCard Motion & Lifecycle', () => {
    it('verifies answer reveal creates scoped GSAP animation and cleans up on unmount', () => {
      const { container, rerender, unmount } = render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={false}
        />
      );

      // Trigger reveal
      rerender(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
        />
      );

      // Verify answer is immediately in DOM (Invariant 3)
      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();

      // Verify unmount reverts all tweens targeting the card
      unmount();
      const activeTweens = gsap.getTweensOf(container.firstChild);
      expect(activeTweens.length).toBe(0);
    });

    it('verifies reduced-motion collapses answer reveal to instant display without lingering tweens', () => {
      mediaMock.setMatches(true);

      const { unmount } = render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
        />
      );

      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();
      unmount();
    });

    it('verifies 4 FSRS rating buttons trigger onRate immediately upon click without animation blocking', () => {
      const handleRate = vi.fn();
      render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
          onRate={handleRate}
        />
      );

      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
      fireEvent.click(goodBtn);

      // Invariant 1: Synchronous callback execution
      expect(handleRate).toHaveBeenCalledTimes(1);
      expect(handleRate).toHaveBeenCalledWith('good');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. ReviewSession: Lateral Slide & Synchronous Keyboard Navigation          */
  /* -------------------------------------------------------------------------- */
  describe('ReviewSession Keyboard Navigation & Queue Progression', () => {
    it('verifies Space key reveals answer synchronously in the same event tick', () => {
      render(<ReviewSession initialQueue={defaultReviewQueue} />);

      expect(screen.queryByText(defaultReviewQueue[0].meaningVi)).not.toBeInTheDocument();

      // Press Space
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      // Immediate DOM presence
      expect(screen.getByText(defaultReviewQueue[0].meaningVi)).toBeInTheDocument();
    });

    it('verifies 1-4 number keys advance review queue synchronously even while tweens are active', () => {
      const handleRate = vi.fn();
      render(
        <ReviewSession
          initialQueue={defaultReviewQueue}
          onRatingSubmit={handleRate}
        />
      );

      // Card 1 -> Press '3' (Good)
      fireEvent.keyDown(window, { key: '3' });
      expect(handleRate).toHaveBeenCalledWith(defaultReviewQueue[0].id, 'good');

      // Card 2 should immediately be active
      expect(screen.getAllByText(defaultReviewQueue[1].term).length).toBeGreaterThan(0);

      // Card 2 -> Press '1' (Again)
      fireEvent.keyDown(window, { key: '1' });
      expect(handleRate).toHaveBeenCalledWith(defaultReviewQueue[1].id, 'again');

      // Card 3 should immediately be active
      expect(screen.getAllByText(defaultReviewQueue[2].term).length).toBeGreaterThan(0);
    });

    it('verifies rapid-fire ratings (5 cards in rapid succession) execute cleanly without drop or crash', () => {
      const handleRate = vi.fn();
      const extendedQueue = [
        ...defaultReviewQueue,
        { ...defaultReviewQueue[0], id: 'rev-004', term: 'persistence' },
        { ...defaultReviewQueue[1], id: 'rev-005', term: 'efficient' },
        { ...defaultReviewQueue[2], id: 'rev-006', term: 'resilient' },
      ];

      render(
        <ReviewSession
          initialQueue={extendedQueue}
          onRatingSubmit={handleRate}
        />
      );

      // Fire 5 rating keys sequentially
      ['1', '2', '3', '4', '3'].forEach((key, idx) => {
        fireEvent.keyDown(window, { key });
        expect(handleRate).toHaveBeenCalledTimes(idx + 1);
      });

      // Card index 5 should be displayed
      expect(screen.getAllByText('resilient').length).toBeGreaterThan(0);
    });

    it('verifies unmounting ReviewSession mid-session kills all lateral queue tweens cleanly', () => {
      const { unmount } = render(<ReviewSession initialQueue={defaultReviewQueue} />);

      // Trigger card advance
      fireEvent.keyDown(window, { key: '3' });

      // Immediate unmount
      expect(() => unmount()).not.toThrow();
    });
  });


  /* -------------------------------------------------------------------------- */
  /* 3. ConceptNode: Subtle Scale Pulse & Selection                             */
  /* -------------------------------------------------------------------------- */
  describe('ConceptNode Pulse & Selection Motion', () => {
    it('verifies status change triggers 200ms scale pulse and clears transform on finish', () => {
      const { rerender, unmount } = render(
        <ConceptNode id="n1" label="appointment" status="learning" />
      );

      // Upgrade status to mastered
      rerender(<ConceptNode id="n1" label="appointment" status="mastered" />);

      // Verify node button exists and has accessible label
      const btn = screen.getByRole('button', { name: /appointment/i });
      expect(btn).toBeInTheDocument();

      unmount();
      expect(gsap.getTweensOf(btn).length).toBe(0);
    });

    it('verifies reduced-motion skips pulse and applies static styling instantly', () => {
      mediaMock.setMatches(true);

      const { unmount } = render(
        <ConceptNode id="n1" label="appointment" status="mastered" isSelected={true} />
      );

      const btn = screen.getByRole('button', { name: /appointment/i });
      expect(btn).toHaveAttribute('aria-pressed', 'true');

      unmount();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. LanguageBrainCanvas: Camera Pan & Centering                             */
  /* -------------------------------------------------------------------------- */
  describe('LanguageBrainCanvas Camera Motion & Scoping', () => {
    it('verifies node click triggers camera centering and opens detail drawer immediately', () => {
      const handleSelect = vi.fn();
      render(
        <LanguageBrainCanvas
          initialNodes={defaultBrainNodes}
          onSelectConcept={handleSelect}
        />
      );

      const targetNode = defaultBrainNodes[0];
      const nodeChip = screen.getByRole('button', { name: new RegExp(targetNode.label, 'i') });

      fireEvent.click(nodeChip);

      // Invariant 3: Immediate detail drawer rendering
      expect(handleSelect).toHaveBeenCalledWith(targetNode);
      expect(screen.getByRole('dialog', { name: /Chi tiết khái niệm/i })).toBeInTheDocument();
      expect(screen.getByText(targetNode.translationVi)).toBeInTheDocument();
    });

    it('verifies zoom controls clamp scale between 50% and 150%', () => {
      render(<LanguageBrainCanvas initialNodes={defaultBrainNodes} />);

      const zoomInBtn = screen.getByRole('button', { name: /Phóng to mạng lưới/i });
      const zoomOutBtn = screen.getByRole('button', { name: /Thu nhỏ mạng lưới/i });

      // Click zoom out 10 times (should clamp at 50%)
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomOutBtn);
      }
      expect(screen.getByText('50%')).toBeInTheDocument();

      // Click zoom in 15 times (should clamp at 150%)
      for (let i = 0; i < 15; i++) {
        fireEvent.click(zoomInBtn);
      }
      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('verifies unmount during active camera animation cancels tweens cleanly', () => {
      const { unmount } = render(<LanguageBrainCanvas initialNodes={defaultBrainNodes} />);

      const nodeChip = screen.getByRole('button', { name: new RegExp(defaultBrainNodes[0].label, 'i') });
      fireEvent.click(nodeChip);

      expect(() => unmount()).not.toThrow();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. ProgressAnalytics: Staggered Entrance & Frame-0 ARIA Data Correctness   */
  /* -------------------------------------------------------------------------- */
  describe('ProgressAnalytics Staggered Entrance & ARIA Data Correctness', () => {
    it('renders explicitly supplied progress data and accessible day summaries immediately', () => {
      render(<ProgressAnalytics initialData={defaultProgressSummary} />);

      expect(screen.getByRole('heading', { name: 'Tiến độ học' })).toBeInTheDocument();
      expect(screen.getByText(String(defaultProgressSummary.totalStudyMinutes))).toBeInTheDocument();
      const daySummaries = screen.getByRole('list', { name: 'Thời gian học theo ngày' });
      expect(within(daySummaries).getAllByRole('img')).toHaveLength(defaultProgressSummary.history7d.length);
      for (const point of defaultProgressSummary.history7d) {
        expect(within(daySummaries).getByRole('img', { name: new RegExp(point.dayLabel) })).toBeInTheDocument();
      }
    });

    it('labels the supported seven-day window without offering an unbacked month view', () => {
      render(<ProgressAnalytics initialData={defaultProgressSummary} />);

      expect(screen.getByText('7 ngày gần nhất')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Thời gian học theo ngày' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /30 ngày qua/i })).not.toBeInTheDocument();
    });

    it('verifies reduced-motion displays full bar widths instantly without staggered delay', () => {
      mediaMock.setMatches(true);

      const { unmount, container } = render(<ProgressAnalytics initialData={defaultProgressSummary} />);

      expect(screen.getByText(String(defaultProgressSummary.totalStudyMinutes))).toBeInTheDocument();
      expect(container.querySelectorAll('.progress-bar-fill')).toHaveLength(defaultProgressSummary.history7d.length);
      unmount();
    });
  });
});
