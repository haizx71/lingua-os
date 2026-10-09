import { describe, expect, it } from 'vitest';
import { verifiedK2BrowserActorToken } from './browser_actor_switch';

const actorA = '00000000-0000-4000-8000-000000000101';
const actorB = '00000000-0000-4000-8000-000000000102';
const accessToken = 'header.payload.signature';

describe('K2 browser Auth actor binding', () => {
  it('accepts only a session whose local and Auth-verified identities both match the factory actor', () => {
    expect(verifiedK2BrowserActorToken({
      sessionUserId: actorA, verifiedUserId: actorA, accessToken,
    }, actorA)).toBe(accessToken);
  });

  it('rejects forged local session identity when Auth verifies a different actor', () => {
    expect(verifiedK2BrowserActorToken({
      sessionUserId: actorA, verifiedUserId: actorB, accessToken,
    }, actorA)).toBeNull();
  });

  it('rejects a session for another actor and malformed token-shaped values', () => {
    expect(verifiedK2BrowserActorToken({
      sessionUserId: actorB, verifiedUserId: actorB, accessToken,
    }, actorA)).toBeNull();
    expect(verifiedK2BrowserActorToken({
      sessionUserId: actorA, verifiedUserId: actorA, accessToken: 'not-a-jwt',
    }, actorA)).toBeNull();
    expect(verifiedK2BrowserActorToken({ sessionUserId: actorA, verifiedUserId: actorA }, actorA)).toBeNull();
  });
});
