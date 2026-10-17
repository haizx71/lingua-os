'use client';

import React from 'react';
import { getApiClient } from '../../lib/api/client';
import { LibraryView } from '../../features/library/LibraryView';

export default function LibraryPage() {
  return <LibraryView apiClient={getApiClient()} />;
}
