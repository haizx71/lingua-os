import { describe, expect, it } from 'vitest';
import { mockBrainSummaryResponse, mockTodayPlanResponse } from '../../../packages/types/src/api/mock-fixtures';
import { parseBrainSummaryResponse } from './phase_e_runner';
import { parseTodayPlanResponse } from './phase_c_runner';
import { validateContract } from './contract_validation';

describe('F1 raw contract attacks', () => {
  it.each(['memoryHealth', 'calculatedAt', 'recentConcepts', 'startingLevelEstimate'])('rejects missing Brain %s', field => {
    const raw = JSON.parse(JSON.stringify(mockBrainSummaryResponse));
    delete raw.data[field];
    expect(() => parseBrainSummaryResponse(raw)).toThrow();
  });
  it('rejects retained instead of familiar', () => {
    const raw = JSON.parse(JSON.stringify(mockBrainSummaryResponse));
    raw.data.statusCounts.retained = raw.data.statusCounts.familiar;
    delete raw.data.statusCounts.familiar;
    expect(() => parseBrainSummaryResponse(raw)).toThrow();
  });
  it('rejects missing Today targetMinutes rather than defaulting', () => {
    const raw = JSON.parse(JSON.stringify(mockTodayPlanResponse));
    delete raw.data.targetMinutes;
    expect(() => parseTodayPlanResponse(raw)).toThrow();
  });
  it('validates frozen fixtures without mutating them', () => {
    const raw = JSON.parse(JSON.stringify(mockBrainSummaryResponse));
    const before = JSON.stringify(raw);
    expect(validateContract('BrainSummaryResponse', raw)).toBe(raw);
    expect(JSON.stringify(raw)).toBe(before);
    validateContract('TodayPlanResponse', mockTodayPlanResponse);
  });
});
