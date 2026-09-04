import { describe, expect, it, vi } from 'vitest';
import {
  API_ERROR_CODES,
  ERROR_HTTP_STATUS_MAP,
  MockApiClient,
  isApiErrorCode,
  mapApiErrorToUi,
  mockApiResponses,
  mockReviewQueueResponse,
} from '@lingua/types';

describe('TASK-005 adversarial contract boundaries', () => {
  it('never accepts due as a concept status', () => {
    expect(mockReviewQueueResponse.data.every((item) => item.concept.status !== ('due' as never))).toBe(true);
  });

  it('does not leak mutable fixture references between calls', async () => {
    const client = new MockApiClient();
    const first = await client.listReviewQueue();
    const second = await client.listReviewQueue();
    expect(first).not.toBe(second);
    expect(first.data).not.toBe(second.data);
    expect(first).toEqual(second);
    const originalTerm = second.data[0].concept.canonicalForm;
    const originalDue = second.data[0].memory.isDue;
    (first.data[0].concept as { canonicalForm: string }).canonicalForm = 'mutated';
    (first.data[0].memory as { isDue: boolean }).isDue = !originalDue;
    const refetched = await client.listReviewQueue();
    expect(refetched.data[0].concept.canonicalForm).toBe(originalTerm);
    expect(refetched.data[0].memory.isDue).toBe(originalDue);
  });

  it('simulates every catalog error and recovers after injection is cleared', async () => {
    const client = new MockApiClient();
    for (const code of API_ERROR_CODES) {
      client.setForceError(code);
      await expect(client.getTodayPlan()).rejects.toMatchObject({
        code,
        httpStatus: ERROR_HTTP_STATUS_MAP[code],
      });
    }
    client.setForceError(null);
    await expect(client.getTodayPlan()).resolves.toEqual(mockApiResponses.today);
  });

  it('clamps negative latency and honors positive latency without mutating responses', async () => {
    vi.useFakeTimers();
    try {
      const client = new MockApiClient(-100);
      const immediate = Promise.all([client.getTodayPlan(), client.getMe()]);
      await vi.runAllTimersAsync();
      await expect(immediate).resolves.toEqual([mockApiResponses.today, mockApiResponses.me]);

      let settled = false;
      const delayed = client.setLatency(25).getTodayPlan().then((value) => {
        settled = true;
        return value;
      });
      await vi.advanceTimersByTimeAsync(24);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(delayed).resolves.toEqual(mockApiResponses.today);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets injected errors and empty-page controls without shared state leakage', async () => {
    const client = new MockApiClient().setReturnEmpty(true).setForceError('SERVICE_UNAVAILABLE');
    client.resetState();
    await expect(client.getTodayPlan()).resolves.toEqual(mockApiResponses.today);
    await expect(client.listReviewQueue()).resolves.toEqual(mockApiResponses.reviewQueue);
  });

  it('rejects former provisional error codes', () => {
    expect(isApiErrorCode('LEARNING_PLAN_NOT_FOUND')).toBe(false);
    expect(isApiErrorCode('NETWORK_ERROR')).toBe(false);
  });

  it('never surfaces attacker-controlled error messages', () => {
    const state = mapApiErrorToUi({
      error: {
        code: 'VALIDATION_ERROR',
        message: '<script>alert(1)</script>',
        requestId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(state.message).not.toContain('<script>');
  });

  it('keeps library mutations idempotent and ownership-free', async () => {
    const client = new MockApiClient();
    const id = '20000000-0000-4000-8000-000000000001';
    const first = await client.saveConceptToLibrary(id);
    const second = await client.saveConceptToLibrary(id);
    expect(first).toEqual(second);
    expect(first.data).not.toHaveProperty('userId');
  });
});
