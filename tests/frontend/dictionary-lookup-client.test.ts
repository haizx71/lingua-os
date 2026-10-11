import { describe, expect, it, vi } from 'vitest';
import { HttpApiClient } from '@lingua/types';

const responseBody = {
  data: { surface: 'reader-word-secret', matchStatus: 'not_found', entries: [] },
  meta: { requestId: '00000000-0000-4000-8000-000000000001' },
};

describe('Reader dictionary lookup transport', () => {
  it('posts only the selected surface in the body and never places it in the URL', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = new HttpApiClient({
      baseUrl: 'https://api.example.test/',
      authTokenProvider: async () => 'dictionary-test-token',
      fetchFn,
    });
    const controller = new AbortController();

    await client.lookupDictionaryWord(
      { surface: 'reader-word-secret' },
      { signal: controller.signal },
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [input, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(input)).toBe('https://api.example.test/v1/dictionary/lookup');
    expect(String(input)).not.toContain('reader-word-secret');
    expect(String(input)).not.toContain('?');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ surface: 'reader-word-secret' });
    expect(init?.signal).toBe(controller.signal);
  });
});
