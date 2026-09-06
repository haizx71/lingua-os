import { describe, it, expect } from 'vitest';
import {
  runPhaseBLearningLoop,
  FRLL_ANCHOR_CONCEPT_ID,
  FRLL_ANCHOR_LEMMA,
  parseMeResponse,
  parseDictionarySearchResponse,
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

  describe('Contract Response Parsers', () => {
    it('correctly parses frozen OpenAPI/FastAPI MeResponse without nested user object', () => {
      const canonicalFastApiResponse = {
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'learner@example.com',
          displayName: 'Test Learner',
          interfaceLanguageCode: 'en',
          timeZone: 'Asia/Ho_Chi_Minh',
          languageProfiles: [],
          createdAt: '2026-09-06T00:00:00Z',
          updatedAt: '2026-09-06T00:00:00Z',
        },
        meta: {
          requestId: '990e8400-e29b-41d4-a716-446655440000',
        },
      };

      const parsed = parseMeResponse(canonicalFastApiResponse);
      expect(parsed.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(parsed.email).toBe('learner@example.com');
      expect(parsed.displayName).toBe('Test Learner');
      expect(parsed.interfaceLanguageCode).toBe('en');
      expect(parsed.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(parsed.languageProfiles).toEqual([]);
    });

    it('throws descriptive error if /v1/me payload is missing data or id', () => {
      expect(() => parseMeResponse({})).toThrow('Invalid /v1/me response: missing data envelope');
      expect(() => parseMeResponse({ data: {} })).toThrow('Invalid /v1/me response: missing or invalid data.id');
    });

    it('correctly parses frozen DictionarySearchResponse with data as array', () => {
      const canonicalSearchResponse = {
        data: [
          {
            id: '7f110000-0000-4000-8000-000000000004',
            canonicalForm: 'frll-anchor',
            lemma: 'frll-anchor',
            pos: 'noun',
            cefrLevel: 'A1',
            frequencyRank: 1,
            shortGloss: 'Deterministic test anchor concept',
            status: 'unseen',
          },
        ],
        meta: {
          requestId: '990e8400-e29b-41d4-a716-446655440000',
          nextCursor: null,
          hasMore: false,
          pageSize: 1,
        },
      };

      const items = parseDictionarySearchResponse(canonicalSearchResponse);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('7f110000-0000-4000-8000-000000000004');
      expect(items[0].lemma).toBe('frll-anchor');
    });
  });
});
