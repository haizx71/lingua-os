import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runK2ProtectedAuthUiSignIn,
  type K2ProtectedAuthUiInteractions,
  type K2ProtectedAuthUiResponse,
} from './k2_hosted_runner';

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

async function rejectedError(operation: Promise<void>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected the protected sign-in helper to reject.');
}

afterEach(() => vi.restoreAllMocks());

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
