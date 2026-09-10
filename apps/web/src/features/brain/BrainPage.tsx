'use client';

import React, { useMemo } from 'react';
import type { ApiClient } from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import { LanguageBrainCanvas } from './LanguageBrainCanvas';
import { useBrain } from './useBrain';

export interface BrainPageProps {
  readonly apiClient?: ApiClient;
  /** Optional explicit profile selector used by route integration tests and deep links. */
  readonly languageProfileId?: string;
}

export function BrainPage({ apiClient, languageProfileId }: BrainPageProps) {
  const api = useMemo(() => apiClient ?? getApiClient(), [apiClient]);
  const brain = useBrain(api, languageProfileId, Boolean(apiClient) || api.transportKind === 'http');

  return (
    <LanguageBrainCanvas
      contextKey={brain.contextKey}
      nodes={brain.nodes}
      summary={brain.summary}
      state={brain.status}
      error={brain.error}
      detailNode={brain.selectedDetail}
      detailLoading={brain.detailLoading}
      detailError={brain.detailError}
      onSelectConcept={brain.selectConcept}
      onRetry={brain.retry}
    />
  );
}
