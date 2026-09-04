import { describe, expect, it } from 'vitest';
import {
  evaluateProductReadiness,
  isLanguageProfileReady,
  isValidIanaTimeZone,
  mockApiResponses,
  type LanguageProfileDto,
} from '@lingua/types';

describe('Authoritative 6-point product readiness predicate (DEF-01)', () => {
  const baseProfile: LanguageProfileDto = {
    ...mockApiResponses.languageProfile.data,
    nativeLanguageCode: 'vi',
    targetLanguageCode: 'en',
    status: 'active',
    goal: 'communication',
    dailyMinutes: 25,
    startingLevelEstimate: null,
  };

  it('active vi->en + timezone + valid goal + dailyMinutes = 5 => READY', () => {
    const profile = { ...baseProfile, dailyMinutes: 5 };
    expect(isLanguageProfileReady(profile)).toBe(true);

    const result = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [profile],
    });
    expect(result.isReady).toBe(true);
    expect(result.activeLanguageProfileId).toBe(profile.id);
  });

  it('active vi->en + timezone + valid goal + dailyMinutes = 180 => READY', () => {
    const profile = { ...baseProfile, dailyMinutes: 180 };
    expect(isLanguageProfileReady(profile)).toBe(true);

    const result = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [profile],
    });
    expect(result.isReady).toBe(true);
    expect(result.activeLanguageProfileId).toBe(profile.id);
  });

  it('missing or invalid goal => NOT READY', () => {
    const missingGoal = { ...baseProfile, goal: undefined as unknown as LanguageProfileDto['goal'] };
    const invalidGoal = { ...baseProfile, goal: 'invalid-goal' as unknown as LanguageProfileDto['goal'] };

    expect(isLanguageProfileReady(missingGoal)).toBe(false);
    expect(isLanguageProfileReady(invalidGoal)).toBe(false);

    const evalMissing = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [missingGoal],
    });
    expect(evalMissing.isReady).toBe(false);

    const evalInvalid = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [invalidGoal],
    });
    expect(evalInvalid.isReady).toBe(false);
  });

  it('missing dailyMinutes if runtime payload can represent it => NOT READY', () => {
    const missingMinutes = { ...baseProfile, dailyMinutes: undefined as unknown as number };
    expect(isLanguageProfileReady(missingMinutes)).toBe(false);

    const evalResult = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [missingMinutes],
    });
    expect(evalResult.isReady).toBe(false);
  });

  it('dailyMinutes < 5 => NOT READY', () => {
    const profile = { ...baseProfile, dailyMinutes: 4 };
    expect(isLanguageProfileReady(profile)).toBe(false);

    const evalResult = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [profile],
    });
    expect(evalResult.isReady).toBe(false);
  });

  it('dailyMinutes > 180 => NOT READY', () => {
    const profile = { ...baseProfile, dailyMinutes: 181 };
    expect(isLanguageProfileReady(profile)).toBe(false);

    const evalResult = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [profile],
    });
    expect(evalResult.isReady).toBe(false);
  });

  it('startingLevelEstimate = null with all mandatory fields valid => READY', () => {
    const profile = { ...baseProfile, startingLevelEstimate: null };
    expect(isLanguageProfileReady(profile)).toBe(true);

    const evalResult = evaluateProductReadiness({
      actorId: '00000000-0000-4000-8000-000000000001',
      meProfile: { id: '00000000-0000-4000-8000-000000000001', timeZone: 'Asia/Ho_Chi_Minh' },
      languageProfiles: [profile],
    });
    expect(evalResult.isReady).toBe(true);
    expect(evalResult.activeLanguageProfileId).toBe(profile.id);
  });

  it('validates IANA timezone correctly', () => {
    expect(isValidIanaTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidIanaTimeZone('UTC')).toBe(true);
    expect(isValidIanaTimeZone('America/New_York')).toBe(true);
    expect(isValidIanaTimeZone('')).toBe(false);
    expect(isValidIanaTimeZone('   ')).toBe(false);
    expect(isValidIanaTimeZone('Not/A_Real_Timezone_123')).toBe(false);
    expect(isValidIanaTimeZone(null)).toBe(false);
    expect(isValidIanaTimeZone(undefined)).toBe(false);
  });
});
