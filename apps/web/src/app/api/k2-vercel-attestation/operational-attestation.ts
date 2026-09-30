import { DEFAULT_CANONICAL_WEB_ORIGIN } from '../../../lib/routing/canonical-host';

const IMMUTABLE_DEPLOYMENT_HOST = /^lingua-os-[a-z0-9]{8,}-haizx71-[0-9]+\.vercel\.app$/;
const SOURCE_SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;

export interface K2VercelOperationalAttestation {
  readonly schemaVersion: 1;
  readonly sourceSha: string;
  readonly deploymentOrigin: string;
  readonly deploymentId: string;
  readonly environment: 'production';
  readonly repositoryOwner: 'haizx71';
  readonly repositorySlug: 'lingua-os';
  readonly canonicalOrigin: string;
}

type AttestationEnvironment = Readonly<Record<string, string | undefined>>;

function effectiveCanonicalOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return DEFAULT_CANONICAL_WEB_ORIGIN;

  try {
    const candidate = new URL(raw.trim());
    if (
      candidate.protocol !== 'https:' ||
      candidate.username ||
      candidate.password ||
      (candidate.pathname !== '' && candidate.pathname !== '/') ||
      candidate.search ||
      candidate.hash ||
      candidate.port
    ) return null;

    return candidate.origin === DEFAULT_CANONICAL_WEB_ORIGIN ? candidate.origin : null;
  } catch {
    return null;
  }
}

function immutableDeploymentOrigin(raw: string | undefined): string | null {
  if (!raw || raw.trim() !== raw || !IMMUTABLE_DEPLOYMENT_HOST.test(raw)) return null;

  try {
    const candidate = new URL(`https://${raw}`);
    if (
      candidate.hostname !== raw ||
      candidate.origin !== `https://${raw}` ||
      candidate.pathname !== '/'
    ) return null;
    return candidate.origin;
  } catch {
    return null;
  }
}

export function createK2VercelOperationalAttestation(
  environment: AttestationEnvironment = process.env,
): K2VercelOperationalAttestation | null {
  const sourceSha = environment.VERCEL_GIT_COMMIT_SHA;
  const deploymentOrigin = immutableDeploymentOrigin(environment.VERCEL_URL);
  const deploymentId = environment.VERCEL_DEPLOYMENT_ID;
  const canonicalOrigin = effectiveCanonicalOrigin(environment.CANONICAL_WEB_ORIGIN);

  if (
    !sourceSha || !SOURCE_SHA.test(sourceSha) ||
    !deploymentOrigin ||
    !deploymentId || !DEPLOYMENT_ID.test(deploymentId) ||
    environment.VERCEL_ENV !== 'production' ||
    environment.VERCEL_GIT_REPO_OWNER !== 'haizx71' ||
    environment.VERCEL_GIT_REPO_SLUG !== 'lingua-os' ||
    canonicalOrigin !== DEFAULT_CANONICAL_WEB_ORIGIN
  ) return null;

  return {
    schemaVersion: 1,
    sourceSha,
    deploymentOrigin,
    deploymentId,
    environment: 'production',
    repositoryOwner: 'haizx71',
    repositorySlug: 'lingua-os',
    canonicalOrigin,
  };
}
