import { describe, it, expect } from 'vitest';
import {
  runPhaseBLearningLoop,
  FRLL_ANCHOR_CONCEPT_ID,
  FRLL_ANCHOR_LEMMA,
} from './phase_b_runner';

describe('Phase B Runner Static Invariants & Fail-Closed Behavior', () => {
  it('defines stable anchor concept ID and lemma consistently with seed catalog', () => {
    expect(FRLL_ANCHOR_CONCEPT_ID).toBe('7f110000-0000-4000-8000-000000000004');
    expect(FRLL_ANCHOR_LEMMA).toBe('frll-anchor');
  });

  it('fails closed when external Supabase credentials are not present in process environment', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(runPhaseBLearningLoop()).rejects.toThrow('SUPABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
      if (originalSecret !== undefined) process.env.SUPABASE_SECRET_KEY = originalSecret;
      if (originalServiceRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });
});
