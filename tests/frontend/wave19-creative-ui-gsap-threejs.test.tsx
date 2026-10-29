import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryItemViewModel, ReaderPassageViewModel } from '@lingua/types';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import { defaultBrainNodes } from '../../apps/web/src/fixtures/brainFixture';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import type { ReviewCardItem } from '../../apps/web/src/fixtures/reviewFixture';
import { TodayDashboard } from '../../apps/web/src/features/today/TodayDashboard';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { ProgressAnalytics } from '../../apps/web/src/features/progress/ProgressAnalytics';
import { ProfileView } from '../../apps/web/src/features/profile/ProfileView';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { OnboardingDiagnostic } from '../../apps/web/src/features/onboarding/OnboardingDiagnostic';

describe('Wave 19 Creative UI, GSAP 60FPS & Three.js 3D Overhaul Test Suite', () => {
  class MockSpeechSynthesisUtterance {
    text: string;
    lang = 'en-US';
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      writable: true,
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    window.localStorage.clear();
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  describe('1. Item #1 & #5: InteractiveReader GSAP Progress Ribbon & Glassmorphic Inspector', () => {
    it('renders reader-gsap-progress-ribbon and inspector-gsap-spring-panel with .lingua-glass-panel when tapping a word', async () => {
      const passage: ReaderPassageViewModel = {
        id: 'passage-w19-test',
        title: 'Vietnamese Coffee Culture',
        level: 'A1',
        wordCount: 8,
        familiarityRate: 75,
        isSaved: false,
        segments: [
          {
            id: 'seg-1',
            order: 0,
            segmentType: 'paragraph',
            text: 'I love drinking coffee in the morning.',
            sentences: [
              {
                id: 'sent-1',
                order: 0,
                text: 'I love drinking coffee in the morning.',
                translationVi: 'Tôi thích uống cà phê vào buổi sáng.',
                tokens: [
                  {
                    raw: 'coffee ',
                    isTarget: true,
                    conceptId: 'concept-coffee-w19',
                    lemma: 'coffee',
                    surfaceText: 'coffee',
                    meaningVi: 'cà phê',
                    explanationEn: 'A dark hot beverage made from roasted beans.',
                    sentenceId: 'sent-1',
                    segmentId: 'seg-1',
                  },
                ],
              },
            ],
          },
        ],
        sentences: [
          {
            id: 'sent-1',
            order: 0,
            text: 'I love drinking coffee in the morning.',
            translationVi: 'Tôi thích uống cà phê vào buổi sáng.',
            tokens: [],
          },
        ],
      };

      render(<InteractiveReader passage={passage} />);

      // Verify GSAP Progress Ribbon is rendered
      const ribbon = screen.getByTestId('reader-gsap-progress-ribbon');
      expect(ribbon).toBeInTheDocument();

      // Tap on target word "coffee"
      const coffeeToken = screen.getByText('coffee');
      fireEvent.click(coffeeToken);

      // Verify spring inspector panel entrance and glassmorphism styling
      const panel = screen.getByTestId('inspector-gsap-spring-panel');
      expect(panel).toBeInTheDocument();
      expect(panel.className).toContain('lingua-glass-panel');
    });
  });

  describe('2. Item #2: LanguageBrainCanvas & ThreeBrainConstellation 3D Mode & Node Selection', () => {
    it('renders brain-threejs-canvas-container, WebGL canvas, 3D orbit status, and handles 3D mode toggling and node click', () => {
      render(<LanguageBrainCanvas nodes={defaultBrainNodes} />);

      // Verify 3D canvas container and Three.js canvas are present
      const container = screen.getByTestId('brain-threejs-canvas-container');
      expect(container).toBeInTheDocument();

      const canvas = screen.getByTestId('brain-threejs-webgl-canvas');
      expect(canvas).toBeInTheDocument();

      const orbitStatus = screen.getByTestId('brain-3d-orbit-status');
      expect(orbitStatus).toBeInTheDocument();
      expect(orbitStatus).toHaveTextContent(/Mạng tinh vân 3D Three.js/i);

      // Click a 3D node
      const firstNodeBtn = screen.getByTestId(`brain-3d-node-${defaultBrainNodes[0].id}`);
      expect(firstNodeBtn).toBeInTheDocument();
      fireEvent.click(firstNodeBtn);

      // Verify 3D toggle button works
      const toggleBtn = screen.getByTestId('brain-3d-mode-toggle');
      expect(toggleBtn).toBeInTheDocument();
      fireEvent.click(toggleBtn);

      // After toggle off, 3D container should be hidden
      expect(screen.queryByTestId('brain-threejs-canvas-container')).not.toBeInTheDocument();

      // Toggle back on
      fireEvent.click(toggleBtn);
      expect(screen.getByTestId('brain-threejs-canvas-container')).toBeInTheDocument();
    });
  });

  describe('3. Item #3: ReviewSession GSAP 3D Perspective Card Stage', () => {
    it('renders review-3d-card-stage with data-gsap-flip-ready="true" and .lingua-3d-perspective', () => {
      const mockCards: ReviewCardItem[] = [
        {
          id: 'card-w19-1',
          conceptId: 'concept-1',
          term: 'resilience',
          meaningVi: 'sự kiên cường, khả năng phục hồi',
          ipa: '/rɪˈzɪl.jəns/',
          pos: 'noun',
          level: 'B2',
          isDue: true,
          dueText: 'Hôm nay',
          state: 'learning',
          intervalDays: 1,
          reps: 2,
          lapses: 0,
          exampleSentenceEn: 'Her resilience helped her overcome difficulties.',
          exampleSentenceVi: 'Sự kiên cường giúp cô ấy vượt qua khó khăn.',
          exerciseMode: 'self_recall',
        },
      ];

      render(<ReviewSession initialCards={mockCards} />);

      const cardStage = screen.getByTestId('review-3d-card-stage');
      expect(cardStage).toBeInTheDocument();
      expect(cardStage.getAttribute('data-gsap-flip-ready')).toBe('true');
      expect(cardStage.className).toContain('lingua-3d-perspective');
    });
  });

  describe('4. Item #4: TodayDashboard Aurora Hero & Bento Stagger Grid', () => {
    it('renders today-aurora-hero (.lingua-aurora-hero) and today-bento-stagger-grid', () => {
      render(<TodayDashboard forcedState="success" />);

      const hero = screen.getByTestId('today-aurora-hero');
      expect(hero).toBeInTheDocument();
      expect(hero.className).toContain('lingua-aurora-hero');

      const bentoGrid = screen.getByTestId('today-bento-stagger-grid');
      expect(bentoGrid).toBeInTheDocument();
    });
  });

  describe('5. Item #6: DictionaryView Glass Search Bar & Soundwave Visualizer', () => {
    it('renders dictionary-glass-search-bar and dictionary-soundwave-visualizer and activates audio on speak', () => {
      render(<DictionaryView forcedState="success" />);

      const searchBar = screen.getByTestId('dictionary-glass-search-bar');
      expect(searchBar).toBeInTheDocument();
      expect(searchBar.className).toContain('lingua-glass-panel');

      const soundwave = screen.getByTestId('dictionary-soundwave-visualizer');
      expect(soundwave).toBeInTheDocument();
      expect(soundwave.getAttribute('data-audio-active')).toBe('false');

      // Click pronunciation audio button
      const audioButtons = screen.getAllByRole('button', { name: /phát âm từ/i });
      expect(audioButtons.length).toBeGreaterThan(0);
      fireEvent.click(audioButtons[0]);

      // Soundwave visualizer should switch to active state
      expect(soundwave.getAttribute('data-audio-active')).toBe('true');
    });
  });

  describe('6. Item #7: LibraryView Glass Filter Dock & Animated Grid', () => {
    it('renders library-glass-filter-dock (.lingua-glass-panel) and library-animated-grid', () => {
      const mockItems: LibraryItemViewModel[] = [
        {
          id: 'item-w19-1',
          itemType: 'concept',
          canonicalForm: 'innovation',
          meaningVi: 'sự đổi mới, sáng kiến',
          level: 'B2',
          status: 'learning',
          createdAt: new Date().toISOString(),
        },
      ];

      render(<LibraryView forcedState="success" initialItems={mockItems} />);

      const filterDock = screen.getByTestId('library-glass-filter-dock');
      expect(filterDock).toBeInTheDocument();
      expect(filterDock.className).toContain('lingua-glass-panel');

      const animatedGrid = screen.getByTestId('library-animated-grid');
      expect(animatedGrid).toBeInTheDocument();
    });
  });

  describe('7. Item #8: ProgressAnalytics 3D Orbital Ring & KPI Strip', () => {
    it('renders progress-3d-orbital-ring and progress-gsap-kpi-strip', () => {
      render(
        <ProgressAnalytics
          initialData={{
            streakDays: 4,
            wordsSolidified: 25,
            history7d: [
              { dayLabel: 'T2', retentionPercent: 90, minutesSpent: 15 },
              { dayLabel: 'T3', retentionPercent: 92, minutesSpent: 30 },
            ],
          }}
        />
      );

      const orbitalRing = screen.getByTestId('progress-3d-orbital-ring');
      expect(orbitalRing).toBeInTheDocument();
      expect(orbitalRing).toHaveTextContent(/Quỹ đạo CEFR/i);

      const kpiStrip = screen.getByTestId('progress-gsap-kpi-strip');
      expect(kpiStrip).toBeInTheDocument();
    });
  });

  describe('8. Item #9: ProfileView Holographic Achievements & Shimmer Badges', () => {
    it('renders profile-holographic-achievements with data-holographic="true" and unlocked card badges', () => {
      render(
        <ProfileView
          initialProfile={{
            name: 'Minh Chau',
            email: 'chau@example.test',
            startingLevelEstimate: 'A1',
            totalConceptsEncountered: 30,
            totalConceptsMastered: 15,
            streakDays: 5,
          }}
        />
      );

      const holoBadge = screen.getByTestId('profile-holographic-achievements');
      expect(holoBadge).toBeInTheDocument();
      expect(holoBadge.getAttribute('data-holographic')).toBe('true');
      expect(holoBadge).toHaveTextContent(/Hiệu ứng Huy hiệu 3D Hologram/i);

      const achievementsGrid = screen.getByTestId('profile-achievements-grid');
      expect(achievementsGrid.getAttribute('data-holographic')).toBe('true');
    });
  });

  describe('9. Item #9: SettingsView Motion Preview Stage', () => {
    it('renders settings-motion-preview-stage and updates data-motion-state when toggling Reduced Motion', () => {
      render(<SettingsView forcedState="success" />);

      const motionStage = screen.getByTestId('settings-motion-preview-stage');
      expect(motionStage).toBeInTheDocument();
      expect(motionStage.getAttribute('data-motion-state')).toBe('active');
      expect(motionStage).toHaveTextContent(/60FPS GSAP/i);

      // Toggle Reduced Motion on
      const motionSwitch = screen.getByRole('switch', { name: /giảm chuyển động/i });
      fireEvent.click(motionSwitch);

      expect(motionStage.getAttribute('data-motion-state')).toBe('reduced');
      expect(motionStage).toHaveTextContent(/Motion: OFF/i);

      // Toggle Reduced Motion off
      fireEvent.click(motionSwitch);
      expect(motionStage.getAttribute('data-motion-state')).toBe('active');
      expect(motionStage).toHaveTextContent(/60FPS GSAP/i);
    });
  });

  describe('10. Item #10: OnboardingDiagnostic GSAP Stage & 3D Celebration Badge', () => {
    it('renders onboarding-gsap-step-stage and onboarding-3d-celebration-badge upon completion', () => {
      render(<OnboardingDiagnostic forcedState="success" />);

      const stage = screen.getByTestId('onboarding-gsap-step-stage');
      expect(stage).toBeInTheDocument();

      // Complete via beginner bypass button
      const bypassBtn = screen.getByTestId('onboarding-beginner-bypass');
      expect(bypassBtn).toBeInTheDocument();
      fireEvent.click(bypassBtn);

      const celebrationBadge = screen.getByTestId('onboarding-3d-celebration-badge');
      expect(celebrationBadge).toBeInTheDocument();
      expect(celebrationBadge).toHaveTextContent(/Khởi tạo thành công không gian học tập 3D cá nhân hóa/i);
    });
  });
});
