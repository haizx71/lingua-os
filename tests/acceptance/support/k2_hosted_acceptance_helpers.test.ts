import { describe, expect, it } from 'vitest';
import { parseK2LanguageProfileList, resolveK2HostedRunMode } from './k2_hosted_acceptance_helpers';

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
});
