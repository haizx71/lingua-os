import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLearnerProfile,
  runK2ProtectedAuthUiSignIn,
  type K2ProtectedAuthUiInteractions,
  type K2ProtectedAuthUiResponse,
} from './k2_hosted_runner';
import type { K2AuthenticatedActor, K2HostedConfig } from './k2_hosted_actors';

const actor = {
  id: 'fake-actor-id-marker',
  email: 'fake-email-marker@example.invalid',
  password: 'fake-password-marker',
} as const;
const privateMarkers = [actor.email, actor.password, 'fake-session-marker'];
const genericFailure =
  'K2 hosted acceptance browser sign-in failed; sensitive browser details were suppressed.';

function validResponse(): K2ProtectedAuthUiResponse {
  return {
    status: () => 200,
    json: async () => ({ user: { id: actor.id } }),
  };
}

function interactions(
  overrides: Partial<K2ProtectedAuthUiInteractions> = {},
): K2ProtectedAuthUiInteractions {
  return {
    fillEmail: vi.fn(async (_value: string) => {}),
    fillPassword: vi.fn(async (_value: string) => {}),
    clickSubmit: vi.fn(async () => {}),
    waitForSignInResponse: vi.fn(async () => validResponse()),
    waitForDestination: vi.fn(async () => {}),
    ...overrides,
  };
}

async function rejectedError(operation: Promise<unknown>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected the protected sign-in helper to reject.');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createLearnerProfile', () => {
  const config = {
    apiOrigin: 'https://staging.example.test',
    githubSha: 'accepted-source-sha-marker',
  } as K2HostedConfig;
  const session: K2AuthenticatedActor = {
    userId: 'fake-actor-id-marker',
    accessToken: 'fake-access-token-marker',
  };

  const observerSession: K2AuthenticatedActor = {
    userId: 'fake-observer-id-marker',
    accessToken: 'fake-observer-access-token-marker',
  };

  it('persists each actor timezone with that actor bootstrap ETag before creating either language profile', async () => {
    const actors = [
      {
        label: 'primary',
        session,
        bootstrapEtag: '"primary-bootstrap"',
        profileId: 'fake-primary-language-profile-marker',
      },
      {
        label: 'observer',
        session: observerSession,
        bootstrapEtag: '"observer-bootstrap"',
        profileId: 'fake-observer-language-profile-marker',
      },
    ] as const;
    const observed: Array<{
      actor: string;
      route: string;
      method: string;
      headers: Headers;
      body: unknown;
    }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const actor = actors.find(item => headers.get('authorization') === `Bearer ${item.session.accessToken}`);
      if (!actor) return apiResponse(401, { error: { code: 'UNEXPECTED_TEST_ACTOR' } });
      observed.push({ actor: actor.label, route, method, headers, body });

      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: actor.session.userId, timeZone: null } }, {
          etag: actor.bootstrapEtag,
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: actor.session.userId, timeZone: 'Asia/Ho_Chi_Minh' } }, {
          etag: `${actor.bootstrapEtag}-updated`,
        });
      }
      if (route === '/v1/me/languages' && method === 'GET') {
        return apiResponse(200, { data: [] });
      }
      if (route === '/v1/me/languages' && method === 'POST') {
        return apiResponse(201, { data: { id: actor.profileId } });
      }
      return apiResponse(500, { error: { code: 'UNEXPECTED_TEST_REQUEST' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    for (const actor of actors) {
      await expect(createLearnerProfile(config, actor.session)).resolves.toBe(actor.profileId);
    }

    expect(observed.map(({ actor, method, route }) => [actor, method, route])).toEqual([
      ['primary', 'GET', '/v1/me'],
      ['primary', 'PATCH', '/v1/me'],
      ['primary', 'GET', '/v1/me/languages'],
      ['primary', 'POST', '/v1/me/languages'],
      ['observer', 'GET', '/v1/me'],
      ['observer', 'PATCH', '/v1/me'],
      ['observer', 'GET', '/v1/me/languages'],
      ['observer', 'POST', '/v1/me/languages'],
    ]);
    for (const actor of actors) {
      const actorCalls = observed.filter(call => call.actor === actor.label);
      expect(actorCalls[1]?.headers.get('if-match')).toBe(actor.bootstrapEtag);
      expect(actorCalls[1]?.body).toEqual({ timeZone: 'Asia/Ho_Chi_Minh' });
      expect(actorCalls.filter(call => call.method !== 'PATCH')
        .every(call => call.headers.get('if-match') === null)).toBe(true);
    }
  });

  it('stops before profile requests when bootstrap did not supply a usable ETag', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      return apiResponse(200, { data: { id: session.userId, timeZone: null } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe('K2 hosted acceptance learner profile ETag was missing.');
    expect(observed).toEqual([{ method: 'GET', route: '/v1/me' }]);
  });

  it.each([
    ['a stale ETag response', 412],
    ['another API failure', 503],
  ])('stops before language creation after %s and suppresses response details', async (_case, status) => {
    const etag = '"fake-current-profile-version"';
    const responseMarker = 'fake-private-response-marker';
    const observed: Array<{ method: string; route: string; headers: Headers }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      observed.push({ route, method, headers });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, { etag });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(status, { privateDetail: responseMarker });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe(`K2 hosted acceptance staging API returned HTTP ${status}.`);
    expect(error.message).not.toContain(responseMarker);
    expect(error.message).not.toContain(session.userId);
    expect(error.message).not.toContain(session.accessToken);
    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
    ]);
    expect(observed[1]?.headers.get('if-match')).toBe(etag);
    expect(log).not.toHaveBeenCalled();
  });

  it('does not accept an unexpected timezone response before creating a profile', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-profile-version"',
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-updated-profile-version"',
        });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createLearnerProfile(config, session))
      .rejects.toThrow('K2 hosted acceptance learner timezone was not persisted.');

    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
    ]);
  });

  it('continues to require HTTP 201 for language profile creation', async () => {
    const observed: Array<{ method: string; route: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = new URL(input.toString()).pathname;
      const method = init?.method ?? 'GET';
      observed.push({ route, method });
      if (route === '/v1/me' && method === 'GET') {
        return apiResponse(200, { data: { id: session.userId, timeZone: null } }, {
          etag: '"fake-profile-version"',
        });
      }
      if (route === '/v1/me' && method === 'PATCH') {
        return apiResponse(200, { data: { id: session.userId, timeZone: 'Asia/Ho_Chi_Minh' } }, {
          etag: '"fake-updated-profile-version"',
        });
      }
      if (route === '/v1/me/languages' && method === 'GET') return apiResponse(200, { data: [] });
      if (route === '/v1/me/languages' && method === 'POST') {
        return apiResponse(409, { privateDetail: 'fake-private-conflict-marker' });
      }
      return apiResponse(500, {});
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await rejectedError(createLearnerProfile(config, session));

    expect(error.message).toBe('K2 hosted acceptance staging API returned HTTP 409.');
    expect(error.message).not.toContain('fake-private-conflict-marker');
    expect(observed.map(({ method, route }) => [method, route])).toEqual([
      ['GET', '/v1/me'],
      ['PATCH', '/v1/me'],
      ['GET', '/v1/me/languages'],
      ['POST', '/v1/me/languages'],
    ]);
  });
});

function apiResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-lingua-source-sha': 'accepted-source-sha-marker',
      ...headers,
    },
  });
}

describe('runK2ProtectedAuthUiSignIn', () => {
  it('preserves the normal sign-in identity check and destination wait', async () => {
    const steps = interactions();

    await runK2ProtectedAuthUiSignIn(actor, steps);

    expect(steps.waitForSignInResponse).toHaveBeenCalledOnce();
    expect(steps.fillEmail).toHaveBeenCalledWith(actor.email);
    expect(steps.fillPassword).toHaveBeenCalledWith(actor.password);
    expect(steps.clickSubmit).toHaveBeenCalledOnce();
    expect(steps.waitForDestination).toHaveBeenCalledOnce();
  });

  it.each([
    ['a non-200 response', { status: () => 403, json: async () => ({ user: { id: actor.id } }) }],
    ['an unexpected actor identity', { status: () => 200, json: async () => ({ user: { id: 'other-actor-marker' } }) }],
  ])('stops before navigation for %s', async (_case, response) => {
    const steps = interactions({ waitForSignInResponse: vi.fn(async () => response) });

    await expect(runK2ProtectedAuthUiSignIn(actor, steps)).rejects.toThrow(genericFailure);
    expect(steps.waitForDestination).not.toHaveBeenCalled();
  });

  const injectedFailureCases: ReadonlyArray<readonly [string, () => Partial<K2ProtectedAuthUiInteractions>]> = [
    ['email fill', () => ({
      fillEmail: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['password fill', () => ({
      fillPassword: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['submit click', () => ({
      clickSubmit: vi.fn(async () => { throw new Error(`email=${actor.email}; password=${actor.password}`); }),
    })],
    ['response wait', () => ({
      waitForSignInResponse: vi.fn(async () => {
        throw new Error(`email=${actor.email}; password=${actor.password}; fake-session-marker`);
      }),
    })],
    ['destination wait', () => ({
      waitForDestination: vi.fn(async () => {
        throw new Error(`email=${actor.email}; password=${actor.password}; fake-session-marker`);
      }),
    })],
  ];

  it.each(injectedFailureCases)('suppresses raw Playwright details from %s failures', async (_stage, makeOverrides) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = await rejectedError(runK2ProtectedAuthUiSignIn(actor, interactions(makeOverrides())));
    const reportedText = `${error.message}\n${error.stack ?? ''}`;

    expect(error.message).toBe(genericFailure);
    expect(error).not.toHaveProperty('cause');
    for (const marker of privateMarkers) expect(reportedText).not.toContain(marker);
    expect(log).not.toHaveBeenCalled();
  });

  it('consumes a late response-wait rejection when an earlier credential fill fails', async () => {
    let rejectResponse!: (reason: Error) => void;
    const responseWait = new Promise<K2ProtectedAuthUiResponse>((_resolve, reject) => {
      rejectResponse = reject;
    });
    const steps = interactions({
      fillEmail: vi.fn(async () => { throw new Error(`fill failed for ${actor.email}`); }),
      waitForSignInResponse: vi.fn(() => responseWait),
    });

    const error = await rejectedError(runK2ProtectedAuthUiSignIn(actor, steps));
    rejectResponse(new Error(`late response failure: ${actor.password}; fake-session-marker`));
    await Promise.resolve();
    await Promise.resolve();

    expect(error.message).toBe(genericFailure);
    expect(error).not.toHaveProperty('cause');
    expect(steps.fillPassword).not.toHaveBeenCalled();
    expect(steps.clickSubmit).not.toHaveBeenCalled();
  });
});
