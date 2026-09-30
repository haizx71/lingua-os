export type K2LanguageProfileRecord = Readonly<Record<string, unknown>>;
export type K2HostedRunMode = 'acceptance' | 'janitor' | 'cleanup-current';
export type K2HostedWaveSelector = 'K2-07' | 'K2-08-DUE-ONLY';

export function resolveK2HostedRunMode(value: string | undefined): K2HostedRunMode {
  const mode = value ?? 'acceptance';
  if (mode === 'acceptance' || mode === 'janitor' || mode === 'cleanup-current') return mode;
  throw new Error('K2 hosted acceptance run mode is invalid; no hosted actor was created.');
}

export function resolveK2HostedWaveSelector(value: string | undefined): K2HostedWaveSelector {
  if (value === undefined || value === 'K2-07') return 'K2-07';
  if (value === 'K2-08-DUE-ONLY') return value;
  throw new Error('K2 hosted acceptance wave selector is invalid; no hosted actor was created.');
}

/** Parses the array-shaped `{ data: [...] }` profile-list contract without retaining payload text. */
export function parseK2LanguageProfileList(payload: unknown): readonly K2LanguageProfileRecord[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('data' in payload)) {
    throw new Error('K2 hosted acceptance language profile list was invalid.');
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('K2 hosted acceptance language profile list was invalid.');
  }
  return data as readonly K2LanguageProfileRecord[];
}
