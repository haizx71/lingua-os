import { isDeepStrictEqual } from 'node:util';
import type { components } from '../../../packages/types/src/generated/openapi';
import { validateContract } from './contract_validation';

export type K2LanguageProfileRecord = Readonly<Record<string, unknown>>;
type K2LanguageProfileDto = components['schemas']['LanguageProfile'];
export type K2HostedRunMode =
  | 'acceptance' | 'janitor' | 'cleanup-current' | 'fixture-reap' | 'reader-recovery';
export type K2HostedWaveSelector = 'PILOT-READER' | 'K2-07' | 'K2-08-DUE-ONLY' | 'K2-08' | 'K2-09' | 'K2-10';

export function resolveK2HostedRunMode(value: string | undefined): K2HostedRunMode {
  const mode = value ?? 'acceptance';
  if (
    mode === 'acceptance' || mode === 'janitor' || mode === 'cleanup-current' ||
    mode === 'fixture-reap' || mode === 'reader-recovery'
  ) return mode;
  throw new Error('K2 hosted acceptance run mode is invalid; no hosted actor was created.');
}

export function resolveK2HostedWaveSelector(value: string | undefined): K2HostedWaveSelector {
  if (value === 'PILOT-READER') return value;
  if (value === undefined || value === 'K2-07') return 'K2-07';
  if (value === 'K2-08-DUE-ONLY' || value === 'K2-08' || value === 'K2-09' || value === 'K2-10') return value;
  throw new Error('K2 hosted acceptance wave selector is invalid; no hosted actor was created.');
}

/** Preserves the established array-shape check used by K2-07/08/09. */
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

/** Proves profile creation by full DTO equality with the subsequent normal-JWT list read. */
export function assertK2CreatedLanguageProfileReadback(
  createdPayload: unknown,
  listPayload: unknown,
): string {
  let created: K2LanguageProfileDto;
  try {
    created = validateContract('LanguageProfileResponse', createdPayload).data;
  } catch {
    throw new Error('K2 hosted acceptance created language profile response was invalid.');
  }
  let listed: readonly K2LanguageProfileDto[];
  try {
    listed = validateContract('LanguageProfilesResponse', listPayload).data;
  } catch {
    throw new Error('K2 hosted acceptance language profile list was invalid.');
  }
  if (listed.length !== 1 || !isDeepStrictEqual(listed[0], created)) {
    throw new Error('K2 hosted acceptance created language profile did not match the complete fresh profile list.');
  }
  return created.id;
}
