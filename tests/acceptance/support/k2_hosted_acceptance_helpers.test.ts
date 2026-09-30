import { describe, expect, it } from 'vitest';
import {
  parseK2LanguageProfileList,
  resolveK2HostedRunMode,
  resolveK2HostedWaveSelector,
} from './k2_hosted_acceptance_helpers';

describe('K2 hosted acceptance response shapes', () => {
  it('accepts the array-shaped fresh profile-list contract', () => {
    expect(parseK2LanguageProfileList({ data: [], meta: { requestId: 'safe-test-id' } })).toEqual([]);
    expect(parseK2LanguageProfileList({ data: [{ id: 'safe-test-id' }], meta: {} })).toHaveLength(1);
  });

  it('fails closed on object-shaped or malformed profile lists', () => {
    expect(() => parseK2LanguageProfileList({ data: { items: [] } })).toThrow('profile list was invalid');
    expect(() => parseK2LanguageProfileList({ data: null })).toThrow('profile list was invalid');
    expect(() => parseK2LanguageProfileList(null)).toThrow('profile list was invalid');
  });

  it('rejects unknown modes instead of allowing an all-skipped green run', () => {
    expect(resolveK2HostedRunMode('acceptance')).toBe('acceptance');
    expect(resolveK2HostedRunMode('janitor')).toBe('janitor');
    expect(resolveK2HostedRunMode('cleanup-current')).toBe('cleanup-current');
    expect(() => resolveK2HostedRunMode('typo')).toThrow('run mode is invalid');
  });

  it('accepts only the implemented K2-07 and explicitly bounded K2-08 due-only selectors', () => {
    expect(resolveK2HostedWaveSelector(undefined)).toBe('K2-07');
    expect(resolveK2HostedWaveSelector('K2-07')).toBe('K2-07');
    expect(resolveK2HostedWaveSelector('K2-08-DUE-ONLY')).toBe('K2-08-DUE-ONLY');
    for (const unsupported of ['K2-08', 'K2-09', 'K2-10', 'k2-08-due-only', 'typo']) {
      expect(() => resolveK2HostedWaveSelector(unsupported)).toThrow('wave selector is invalid');
    }
  });
});
