import { describe, expect, it } from 'vitest';
import {
  assertK2CreatedLanguageProfileReadback,
  parseK2LanguageProfileList,
  resolveK2HostedRunMode,
  resolveK2HostedWaveSelector,
} from './k2_hosted_acceptance_helpers';

describe('K2 hosted acceptance response shapes', () => {
  const profile = {
    id: '00000000-0000-4000-8000-000000000001',
    etag: '"opaque-child-etag"',
    targetLanguageCode: 'en',
    nativeLanguageCode: 'vi',
    goal: 'communication',
    dailyMinutes: 15,
    targetLevel: null,
    startingLevelEstimate: null,
    status: 'active',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T00:00:00Z',
  } as const;

  it('accepts the array-shaped fresh profile-list contract', () => {
    const meta = { requestId: '00000000-0000-4000-8000-000000000002', apiVersion: '1.0' };
    expect(parseK2LanguageProfileList({ data: [], meta })).toEqual([]);
    expect(parseK2LanguageProfileList({ data: [profile], meta })).toHaveLength(1);
  });

  it('fails closed on object-shaped or malformed profile lists', () => {
    expect(() => parseK2LanguageProfileList({ data: { items: [] } })).toThrow('profile list was invalid');
    expect(() => parseK2LanguageProfileList({ data: null })).toThrow('profile list was invalid');
    expect(() => parseK2LanguageProfileList(null)).toThrow('profile list was invalid');
  });

  it('validates the frozen profile DTO and requires full exact list readback', () => {
    const created = { data: profile, meta: { requestId: '00000000-0000-4000-8000-000000000002', apiVersion: '1.0' } };
    const listed = { data: [profile], meta: { requestId: '00000000-0000-4000-8000-000000000003', apiVersion: '1.0' } };
    expect(assertK2CreatedLanguageProfileReadback(created, listed)).toBe(profile.id);
    expect(() => assertK2CreatedLanguageProfileReadback(created, {
      ...listed,
      data: [{ ...profile, goal: 'work' }],
    })).toThrow('did not match the complete fresh profile list');
    expect(() => assertK2CreatedLanguageProfileReadback(created, {
      ...listed,
      data: [{ ...profile, unexpected: 'field' }],
    })).toThrow('language profile list was invalid');
    expect(() => assertK2CreatedLanguageProfileReadback(created, {
      ...listed,
      data: [{ id: profile.id }],
    })).toThrow('language profile list was invalid');
    expect(parseK2LanguageProfileList({ data: [{ id: profile.id }] })).toHaveLength(1);
  });

  it('rejects unknown modes instead of allowing an all-skipped green run', () => {
    expect(resolveK2HostedRunMode('acceptance')).toBe('acceptance');
    expect(resolveK2HostedRunMode('janitor')).toBe('janitor');
    expect(resolveK2HostedRunMode('cleanup-current')).toBe('cleanup-current');
    expect(resolveK2HostedRunMode('fixture-reap')).toBe('fixture-reap');
    expect(resolveK2HostedRunMode('reader-recovery')).toBe('reader-recovery');
    expect(() => resolveK2HostedRunMode('typo')).toThrow('run mode is invalid');
  });

  it('accepts only the implemented K2 waves and the fixed Reader pilot selector', () => {
    expect(resolveK2HostedWaveSelector(undefined)).toBe('K2-07');
    expect(resolveK2HostedWaveSelector('PILOT-READER')).toBe('PILOT-READER');
    expect(resolveK2HostedWaveSelector('K2-07')).toBe('K2-07');
    expect(resolveK2HostedWaveSelector('K2-08-DUE-ONLY')).toBe('K2-08-DUE-ONLY');
    expect(resolveK2HostedWaveSelector('K2-08')).toBe('K2-08');
    expect(resolveK2HostedWaveSelector('K2-09')).toBe('K2-09');
    expect(resolveK2HostedWaveSelector('K2-10')).toBe('K2-10');
    for (const unsupported of ['k2-08-due-only', 'typo']) {
      expect(() => resolveK2HostedWaveSelector(unsupported)).toThrow('wave selector is invalid');
    }
  });
});
