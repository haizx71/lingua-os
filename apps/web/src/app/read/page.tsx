import React from 'react';
import { InteractiveReader } from '../../features/read/InteractiveReader';

interface ReadPageProps {
  readonly searchParams: Promise<{ readonly contentId?: string | string[] }>;
}

export default async function ReadPage({ searchParams }: ReadPageProps) {
  const params = await searchParams;
  const value = params.contentId;
  const requestedContentId = value === undefined ? undefined : Array.isArray(value) ? null : value;
  return <InteractiveReader requestedContentId={requestedContentId} />;
}
