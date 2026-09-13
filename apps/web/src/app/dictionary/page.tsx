'use client';

import React from 'react';
import { DictionaryView } from '../../features/dictionary/DictionaryView';
import { getApiClient } from '../../lib/api/client';

export default function DictionaryPage() {
  const apiClient = getApiClient();
  return apiClient.transportKind === 'mock'
    ? <DictionaryView apiClient={apiClient} />
    : <DictionaryView apiClient={apiClient} initialConcepts={[]} />;
}
