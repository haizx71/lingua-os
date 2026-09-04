import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapOnboardingAssessmentToViewModel,
  mapOnboardingLanguageProfileToViewModel,
  mapOnboardingProfileToViewModel,
  mockApiResponses,
} from '@lingua/types';

const root = path.resolve(process.cwd());
const onboardingSource = readFileSync(path.join(root, 'apps/web/src/features/onboarding/LiveOnboardingFlow.tsx'), 'utf8');
const authSource = readFileSync(path.join(root, 'apps/web/src/features/auth/AuthEntry.tsx'), 'utf8');

describe('TASK-017 frontend boundary invariants', () => {
  it('keeps product transport behind ApiClient and avoids direct Supabase table access', () => {
    expect(onboardingSource).not.toMatch(/\bfetch\s*\(/);
    expect(onboardingSource).not.toContain('.from(');
    expect(onboardingSource).not.toMatch(/type\s+\w+Dto\b/);
    expect(authSource).not.toContain('.from(');
  });

  it('renders server-owned assessment state without implementing scoring or placement rules', () => {
    expect(onboardingSource).not.toMatch(/\b(?:score|difficulty|stability|retrievability|mastery)\b/i);
    expect(onboardingSource).not.toMatch(/3\s*\/\s*4|6\s*\/\s*8|8\s*\/\s*12|confidence\s*=/i);
    expect(onboardingSource).not.toContain('getTodayPlan');
  });

  it('keeps assessment submissions strict and idempotent at the UI boundary', () => {
    expect(onboardingSource).toContain("'Idempotency-Key'");
    expect(onboardingSource).toContain('selectedOptionId');
    expect(onboardingSource).toContain('skipped: true');
    expect(onboardingSource).toContain("submittedAssessment.status");
  });

  it('maps authoritative DTOs into onboarding view models before presentation', () => {
    const profile = mapOnboardingProfileToViewModel(mockApiResponses.me.data);
    const language = mapOnboardingLanguageProfileToViewModel(mockApiResponses.languageProfile.data);
    const assessment = mapOnboardingAssessmentToViewModel(mockApiResponses.assessment.data);

    expect(profile).toEqual(expect.objectContaining({ displayName: expect.anything(), timeZone: expect.anything() }));
    expect(language).toEqual(expect.objectContaining({ id: mockApiResponses.languageProfile.data.id, status: mockApiResponses.languageProfile.data.status }));
    expect(assessment).toEqual(expect.objectContaining({ id: mockApiResponses.assessment.data.id, currentItem: expect.anything() }));
  });

  it('preserves an opaque child ETag without leaking internal ownership or revisions into the view model', () => {
    const dto = { ...mockApiResponses.languageProfile.data, etag: '"opaque!child/token"', revision: 17, userId: 'private-owner' };
    const view = mapOnboardingLanguageProfileToViewModel(dto);
    expect(view).toHaveProperty('etag', dto.etag);
    expect(view).not.toHaveProperty('revision');
    expect(view).not.toHaveProperty('userId');
    expect(view).not.toBe(dto);
  });

  it('never derives, parses, or substitutes parent tokens for child mutation ETags', () => {
    expect(onboardingSource).not.toMatch(/createHash|subtle\.digest|sha256|JSON\.stringify|\.split\(/);
    expect(onboardingSource).not.toContain('`language-profile:');
    expect(onboardingSource).toContain('archivedLanguageProfile.etag');
    expect(onboardingSource).not.toContain('setLanguageProfile(response.data)');
  });
});
