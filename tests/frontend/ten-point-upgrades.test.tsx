import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockApiClient } from '@lingua/types';
import {
  clearQueryCache,
  fetchWithActorCache,
  invalidateActorCacheForClient,
} from '../../apps/web/src/lib/api/queryCache';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import { defaultBrainNodes } from '../../apps/web/src/fixtures/brainFixture';

describe('Ten-Point Upgrades Test Suite', () => {
  beforeEach(() => {
    clearQueryCache();
    window.localStorage.clear();
    delete document.documentElement.dataset.reducedMotion;
  });

  describe('Item #6: Actor-Epoch-Aware Client Query Cache', () => {
    it('deduplicates concurrent requests on the same ApiClient instance and invalidates cleanly on invalidateActorCacheForClient', async () => {
      const client = new MockApiClient();
      let callCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        callCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { value: 'profile-data', callCount };
      });

      // 1. Concurrent requests deduplication
      const [result1, result2] = await Promise.all([
        fetchWithActorCache('learner-profile', '0:actor-1', fetcher, 5000, client),
        fetchWithActorCache('learner-profile', '0:actor-1', fetcher, 5000, client),
      ]);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ value: 'profile-data', callCount: 1 });
      expect(result2).toEqual({ value: 'profile-data', callCount: 1 });

      // 2. Warm cache reuse within TTL
      const result3 = await fetchWithActorCache('learner-profile', '0:actor-1', fetcher, 5000, client);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result3).toEqual({ value: 'profile-data', callCount: 1 });

      // 3. Invalidation for client
      invalidateActorCacheForClient(client, '0:actor-1');
      const result4 = await fetchWithActorCache('learner-profile', '0:actor-1', fetcher, 5000, client);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result4).toEqual({ value: 'profile-data', callCount: 2 });

      // 4. Cache isolation: a separate ApiClient instance does not reuse cached response
      const anotherClient = new MockApiClient();
      const result5 = await fetchWithActorCache('learner-profile', '0:actor-1', fetcher, 5000, anotherClient);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(result5).toEqual({ value: 'profile-data', callCount: 3 });
    });
  });

  describe('Item #4: Durable Local Settings Persistence', () => {
    it('persists newWordsBudgetPerDay, reducedMotion, and audioAutoplay to window.localStorage and restores on remount', async () => {
      const onSave = vi.fn();
      const { unmount } = render(<SettingsView onSaveSettings={onSave} />);

      // Update new words budget to 8
      const budget8Btn = screen.getByRole('button', { name: '8 từ' });
      fireEvent.click(budget8Btn);
      expect(screen.getByText('8 từ mới / ngày')).toBeInTheDocument();

      // Toggle reducedMotion switch
      const motionSwitch = screen.getByRole('switch', { name: 'Giảm chuyển động' });
      fireEvent.click(motionSwitch);
      expect(motionSwitch).toHaveAttribute('aria-checked', 'true');

      // Toggle audioAutoplay switch (default is true, click turns to false)
      const audioSwitch = screen.getByRole('switch', { name: 'Tự động phát âm trong Ôn tập' });
      fireEvent.click(audioSwitch);
      expect(audioSwitch).toHaveAttribute('aria-checked', 'false');

      // Click Save settings
      const saveBtn = screen.getByRole('button', { name: /Lưu cài đặt/i });
      fireEvent.click(saveBtn);

      // Verify localStorage was written under 'lingua-user-settings-v1'
      const storedJson = window.localStorage.getItem('lingua-user-settings-v1');
      expect(storedJson).toBeTruthy();
      const parsed = JSON.parse(storedJson!);
      expect(parsed).toEqual({
        newWordsBudgetPerDay: 8,
        reducedMotion: true,
        audioAutoplay: false,
      });

      // Verify document.documentElement.dataset.reducedMotion
      expect(document.documentElement.dataset.reducedMotion).toBe('true');
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          newWordsBudgetPerDay: 8,
          reducedMotion: true,
          audioAutoplay: false,
        })
      );

      // Remount SettingsView to verify hydration from localStorage
      unmount();
      render(<SettingsView />);

      expect(screen.getByText('8 từ mới / ngày')).toBeInTheDocument();
      const remountedMotionSwitch = screen.getByRole('switch', { name: 'Giảm chuyển động' });
      expect(remountedMotionSwitch).toHaveAttribute('aria-checked', 'true');
      const remountedAudioSwitch = screen.getByRole('switch', { name: 'Tự động phát âm trong Ôn tập' });
      expect(remountedAudioSwitch).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Item #5: Web Speech Audio Playback in DictionaryView', () => {
    it('invokes window.speechSynthesis.speak when speechSynthesis is available', () => {
      const speakMock = vi.fn();
      const cancelMock = vi.fn();
      const mockUtteranceConstructor = vi.fn().mockImplementation(function (this: { text: string; lang: string }, text: string) {
        this.text = text;
        this.lang = '';
      });

      const originalSpeechSynthesis = window.speechSynthesis;
      const originalUtterance = (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance;

      Object.defineProperty(window, 'speechSynthesis', {
        value: { speak: speakMock, cancel: cancelMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: mockUtteranceConstructor,
        writable: true,
        configurable: true,
      });

      try {
        render(<DictionaryView />);
        const audioButtons = screen.getAllByRole('button', { name: /Phát âm từ/i });
        expect(audioButtons.length).toBeGreaterThan(0);

        fireEvent.click(audioButtons[0]!);

        expect(cancelMock).toHaveBeenCalledTimes(1);
        expect(speakMock).toHaveBeenCalledTimes(1);
        expect(mockUtteranceConstructor).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'speechSynthesis', {
          value: originalSpeechSynthesis,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: originalUtterance,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe('Item #7: Knowledge Graph & Remediation Insight in LanguageBrainCanvas', () => {
    it('displays Gợi ý ôn tập trọng tâm with weakest competence recommendation', () => {
      const customNodes = [
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-listen-weak',
          label: 'listening-weak-term',
          lemma: 'listening-weak-term',
          recognitionScore: 85,
          listeningScore: 25,
          productionScore: 65,
        },
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-prod-weak',
          label: 'production-weak-term',
          lemma: 'production-weak-term',
          recognitionScore: 80,
          listeningScore: 70,
          productionScore: 20,
        },
        {
          ...defaultBrainNodes[0]!,
          id: 'concept-rec-weak',
          label: 'recognition-weak-term',
          lemma: 'recognition-weak-term',
          recognitionScore: 15,
          listeningScore: 75,
          productionScore: 60,
        },
      ];

      render(<LanguageBrainCanvas initialNodes={customNodes} />);

      // Select listening weak concept
      fireEvent.click(screen.getByText('listening-weak-term'));
      expect(screen.getByText('Gợi ý ôn tập trọng tâm')).toBeInTheDocument();
      expect(screen.getByText(/Ưu tiên luyện Nghe & Điền từ/i)).toBeInTheDocument();

      // Select production weak concept
      fireEvent.click(screen.getByText('production-weak-term'));
      expect(screen.getByText('Gợi ý ôn tập trọng tâm')).toBeInTheDocument();
      expect(screen.getByText(/Ưu tiên luyện Nhớ chủ động & Gõ từ/i)).toBeInTheDocument();

      // Select recognition weak concept
      fireEvent.click(screen.getByText('recognition-weak-term'));
      expect(screen.getByText('Gợi ý ôn tập trọng tâm')).toBeInTheDocument();
      expect(screen.getByText(/Tiếp tục đọc ngữ cảnh/i)).toBeInTheDocument();
    });
  });
});
