export type PersistenceDisposition = 'LOCAL_ONLY' | 'DEFERRED' | 'NOT_YET_PERSISTED';

/** Explicitly documents UI features that are absent from the authoritative API contract. */
export const PERSISTENCE_GAPS = Object.freeze({
  theme: 'LOCAL_ONLY',
  reducedMotion: 'LOCAL_ONLY',
  audioAutoplay: 'LOCAL_ONLY',
  playbackSpeed: 'LOCAL_ONLY',
  savedSentenceNotes: 'NOT_YET_PERSISTED',
  reminderPreferences: 'DEFERRED',
  newConceptBudget: 'DEFERRED',
  dataExport: 'DEFERRED',
  accountDeletion: 'DEFERRED',
} as const satisfies Record<string, PersistenceDisposition>);
