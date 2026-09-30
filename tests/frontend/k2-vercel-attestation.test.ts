import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../apps/web/src/app/api/k2-vercel-attestation/route';
import { createK2VercelOperationalAttestation } from '../../apps/web/src/app/api/k2-vercel-attestation/operational-attestation';

const VALID_ENVIRONMENT = {
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'lingua-os-n1wbhg1v5-haizx71-6910.vercel.app',
  VERCEL_DEPLOYMENT_ID: 'dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3',
  VERCEL_ENV: 'production',
  VERCEL_GIT_REPO_OWNER: 'haizx71',
  VERCEL_GIT_REPO_SLUG: 'lingua-os',
};

afterEach(() => vi.unstubAllEnvs());

describe('K2 Vercel operational attestation', () => {
  it('returns only Vercel-managed deployment facts and the code-owned canonical origin', () => {
    const attestation = createK2VercelOperationalAttestation({
      ...VALID_ENVIRONMENT,
      SUPABASE_SECRET_KEY: 'never-return-this-secret-marker',
      CANONICAL_WEB_ORIGIN: 'https://lingua-os-web-mocha.vercel.app/',
    });

    expect(attestation).toEqual({
      schemaVersion: 1,
      sourceSha: 'a'.repeat(40),
      deploymentOrigin: 'https://lingua-os-n1wbhg1v5-haizx71-6910.vercel.app',
      deploymentId: 'dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3',
      environment: 'production',
      repositoryOwner: 'haizx71',
      repositorySlug: 'lingua-os',
      canonicalOrigin: 'https://lingua-os-web-mocha.vercel.app',
    });
    expect(JSON.stringify(attestation)).not.toContain('never-return-this-secret-marker');
  });

  it.each([
    ['source SHA', { VERCEL_GIT_COMMIT_SHA: undefined }],
    ['generated deployment URL', { VERCEL_URL: undefined }],
    ['deployment ID', { VERCEL_DEPLOYMENT_ID: undefined }],
    ['Vercel environment', { VERCEL_ENV: undefined }],
    ['repository owner', { VERCEL_GIT_REPO_OWNER: undefined }],
    ['repository slug', { VERCEL_GIT_REPO_SLUG: undefined }],
  ])('fails closed when the Vercel-managed %s is missing', (_name, omitted) => {
    expect(createK2VercelOperationalAttestation({ ...VALID_ENVIRONMENT, ...omitted })).toBeNull();
  });

  it.each([
    ['malformed SHA', { VERCEL_GIT_COMMIT_SHA: 'not-a-commit' }],
    ['non-immutable URL', { VERCEL_URL: 'lingua-os-web-mocha.vercel.app' }],
    ['malformed deployment ID', { VERCEL_DEPLOYMENT_ID: 'deployment' }],
    ['preview deployment', { VERCEL_ENV: 'preview' }],
    ['wrong repository owner', { VERCEL_GIT_REPO_OWNER: 'attacker' }],
    ['wrong repository', { VERCEL_GIT_REPO_SLUG: 'other-repo' }],
    ['different canonical origin', { CANONICAL_WEB_ORIGIN: 'https://other.example' }],
    ['malformed canonical origin', { CANONICAL_WEB_ORIGIN: 'https://user@lingua-os-web-mocha.vercel.app' }],
  ])('fails closed for a %s', (_name, changed) => {
    expect(createK2VercelOperationalAttestation({ ...VALID_ENVIRONMENT, ...changed })).toBeNull();
  });

  it('serves a dynamic, private no-store response with no environment dump', async () => {
    for (const [name, value] of Object.entries(VALID_ENVIRONMENT)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv('SUPABASE_SECRET_KEY', 'never-return-this-secret-marker');
    vi.stubEnv('CANONICAL_WEB_ORIGIN', 'https://lingua-os-web-mocha.vercel.app');

    const response = GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(JSON.stringify(body)).not.toContain('never-return-this-secret-marker');
    expect(JSON.stringify(body)).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('returns no-store failure when required deployment metadata is unavailable', async () => {
    const response = GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(body).toEqual({ error: 'Operational deployment attestation is unavailable.' });
  });
});
