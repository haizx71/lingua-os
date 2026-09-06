import { describe, it, expect } from 'vitest';
import { captureLearnerDigestFromPostgres } from './postgres_probe_client';

describe('Postgres Probe Client', () => {
  it('fails closed when DATABASE_URL is missing', async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      await expect(
        captureLearnerDigestFromPostgres(
          '00000000-0000-4000-8000-000000000001',
          '7f110000-0000-4000-8000-000000000004',
          { databaseUrl: '' }
        )
      ).rejects.toThrow('DATABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
    }
  });
});
