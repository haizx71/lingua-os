import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  MockApiClient,
  mockLanguageProfileResponse,
  mockMeResponse,
  type ApiClient,
} from '@lingua/types';
import { SettingsView } from '../../apps/web/src/features/settings/SettingsView';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import { defaultBrainNodes } from '../../apps/web/src/fixtures/brainFixture';

describe('Settings Live Persistence & Brain Forgotten Filter Follow-ups', () => {
  it('persists dailyMinutes through PATCH /v1/me/languages/{id} with child If-Match ETag when live', async () => {
    const getMe = vi.fn().mockResolvedValue(mockMeResponse);
    const updateMyLanguageProfile = vi.fn().mockResolvedValue({
      ...mockLanguageProfileResponse,
      data: {
        ...mockLanguageProfileResponse.data,
        dailyMinutes: 45,
        etag: '"lp-rev-2"',
      },
    });
    const client: ApiClient = Object.assign(new MockApiClient(), {
      transportKind: 'http' as const,
      getMe,
      updateMyLanguageProfile,
    });

    render(<SettingsView apiClient={client} />);
    await waitFor(() => {
      expect(getMe).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '45 phút' }));
    fireEvent.click(screen.getByRole('button', { name: /Lưu cài đặt/i }));

    await waitFor(() => {
      expect(updateMyLanguageProfile).toHaveBeenCalledWith({
        languageProfileId: mockMeResponse.data.languageProfiles[0]?.id,
        body: { dailyMinutes: 45 },
        headers: { 'If-Match': mockMeResponse.data.languageProfiles[0]?.etag },
      });
    });
    expect(await screen.findByText(/đã được đồng bộ lên máy chủ/i)).toBeInTheDocument();
  });

  it('provides a dedicated Đã quên (forgotten) filter chip on LanguageBrainCanvas', () => {
    const nodes = [
      ...defaultBrainNodes,
      {
        ...defaultBrainNodes[0],
        id: '00000000-0000-4000-8000-000000000999',
        label: 'postpone',
        lemma: 'postpone',
        status: 'forgotten' as const,
      },
    ];

    render(<LanguageBrainCanvas initialNodes={nodes} />);
    const forgottenChip = screen.getByRole('button', { name: 'Đã quên' });
    fireEvent.click(forgottenChip);

    expect(screen.getByText('postpone')).toBeInTheDocument();
  });
});
