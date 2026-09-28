import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type YamlMap = Record<string, unknown>;
interface WorkflowStep extends YamlMap {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly env?: YamlMap;
}

function asMap(value: unknown, label: string): YamlMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a mapping`);
  }
  return value as YamlMap;
}

function stepsFor(job: YamlMap): readonly WorkflowStep[] {
  if (!Array.isArray(job.steps)) throw new Error('workflow job must define steps');
  return job.steps.map(step => asMap(step, 'workflow step') as WorkflowStep);
}

function readWorkflow(path: string): YamlMap {
  return asMap(parse(readFileSync(resolve(process.cwd(), path), 'utf8')), path);
}

function stepNamed(job: YamlMap, name: string): WorkflowStep {
  const step = stepsFor(job).find(candidate => candidate.name === name);
  if (!step) throw new Error(`workflow step is missing: ${name}`);
  return step;
}

const SECRET_WORKFLOW_PATH = '.github/workflows/k2-hosted-acceptance.yml';
const SECURITY_WORKFLOW_PATH = '.github/workflows/k2-hosted-security-gate.yml';
const DB_PREFLIGHT_WORKFLOW_PATH = '.github/workflows/k2-hosted-db-preflight.yml';
const OWNER = 'haizx71';
const REPOSITORY = 'haizx71/lingua-os';
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/k2-hosted-acceptance.yml@refs/heads/master`;
const STAGING_SECRET_NAMES = [
  'K2_STAGING_API_ORIGIN',
  'K2_STAGING_SUPABASE_URL',
  'K2_STAGING_SUPABASE_PROJECT_REF',
  'K2_STAGING_SUPABASE_PUBLISHABLE_KEY',
  'K2_STAGING_SUPABASE_SECRET_KEY',
  'K2_STAGING_READONLY_DATABASE_URL',
];

describe('K2 hosted workflow credential boundary', () => {
  const secretWorkflow = readWorkflow(SECRET_WORKFLOW_PATH);
  const securityWorkflow = readWorkflow(SECURITY_WORKFLOW_PATH);
  const dbPreflightWorkflow = readWorkflow(DB_PREFLIGHT_WORKFLOW_PATH);
  const secretJobs = asMap(secretWorkflow.jobs, 'secret workflow jobs');
  const securityJobs = asMap(securityWorkflow.jobs, 'security workflow jobs');
  const acceptance = asMap(secretJobs['hosted-acceptance'], 'hosted-acceptance job');
  const janitor = asMap(secretJobs.janitor, 'janitor job');
  const cleanup = asMap(secretJobs['current-run-cleanup'], 'current-run-cleanup job');
  const securityGate = asMap(securityJobs['security-gate'], 'security-gate job');
  const dbPreflight = asMap(asMap(dbPreflightWorkflow.jobs, 'db preflight jobs')['readonly-preflight'], 'readonly-preflight job');

  it('runs database preflight without actor credentials or pull-request access', () => {
    expect(Object.keys(asMap(dbPreflightWorkflow.on, 'db preflight triggers'))).toEqual(['workflow_dispatch']);
    expect(asMap(dbPreflightWorkflow.permissions, 'db preflight permissions')).toEqual({ contents: 'read' });
    expect(asMap(dbPreflightWorkflow.concurrency, 'db preflight concurrency')).toMatchObject({
      group: 'k2-hosted-acceptance-staging', 'cancel-in-progress': false,
    });
    const guard = String(dbPreflight.if);
    for (const condition of [
      "github.repository == 'haizx71/lingua-os'",
      "github.ref == 'refs/heads/master'",
      "github.workflow_ref == 'haizx71/lingua-os/.github/workflows/k2-hosted-db-preflight.yml@refs/heads/master'",
      "github.actor == 'haizx71'",
      "github.triggering_actor == 'haizx71'",
    ]) expect(guard).toContain(condition);
    const steps = stepsFor(dbPreflight);
    const shaCheck = stepNamed(dbPreflight, 'Verify exact current master before reading staging secret');
    const probe = stepNamed(dbPreflight, 'Prove session pooler and read-only privileges without actors');
    expect(steps.indexOf(shaCheck)).toBeLessThan(steps.indexOf(probe));
    expect(JSON.stringify(shaCheck)).not.toContain('secrets.');
    expect(probe.run).toContain('k2_readonly_privilege_probe');
    expect(asMap(probe.env, 'db preflight environment')).toEqual({
      K2_STAGING_READONLY_DATABASE_URL: '${{ secrets.K2_STAGING_READONLY_DATABASE_URL }}',
    });
    expect(JSON.stringify(dbPreflightWorkflow)).not.toContain('K2_STAGING_SUPABASE_SECRET_KEY');
    expect(JSON.stringify(dbPreflightWorkflow)).not.toContain('id-token');
    for (const step of steps) {
      if (step.uses) expect(step.uses).toMatch(/^[\w./-]+@[a-f0-9]{40}(?:\s+#.*)?$/);
    }
  });

  it('keeps the secret-bearing workflow off pull requests and serializes hosted mutations', () => {
    const triggers = asMap(secretWorkflow.on, 'secret workflow triggers');
    expect(Object.keys(triggers).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(asMap(secretWorkflow.concurrency, 'secret workflow concurrency')).toMatchObject({
      group: 'k2-hosted-acceptance-staging',
      'cancel-in-progress': false,
    });
    expect(Object.keys(asMap(secretWorkflow.permissions, 'secret workflow permissions'))).toEqual(['contents']);
    expect(asMap(secretWorkflow.permissions, 'secret workflow permissions').contents).toBe('read');
  });

  it('runs a separate credential-free pull-request gate with read-only permissions', () => {
    const triggers = asMap(securityWorkflow.on, 'security workflow triggers');
    expect(Object.keys(triggers)).toEqual(['pull_request']);
    expect(asMap(triggers.pull_request, 'pull_request trigger').branches).toEqual(['master']);
    expect(JSON.stringify(securityWorkflow)).not.toContain('secrets.');
    expect(JSON.stringify(securityWorkflow)).not.toContain('id-token');
    expect(securityGate.env).toBeUndefined();
    expect(asMap(securityGate.permissions, 'security gate permissions')).toEqual({ contents: 'read' });
    const securitySteps = stepsFor(securityGate);
    expect(securitySteps.find(step => step.uses?.startsWith('actions/setup-python@'))?.uses)
      .toMatch(/^[\w./-]+@[a-f0-9]{40}(?:\s+#.*)?$/);
    expect(stepNamed(securityGate, 'Install locked Python dependencies from wheels only').run)
      .toContain('--only-binary=:all: -r requirements/backend-dev.lock');
    expect(stepNamed(securityGate, 'Run read-only hosted probe tests').run)
      .toContain('python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py');
    for (const step of securitySteps) {
      if (step.uses) expect(step.uses).toMatch(/^[\w./-]+@[a-f0-9]{40}(?:\s+#.*)?$/);
      expect(JSON.stringify(step)).not.toContain('secrets.');
    }
  });

  it('restricts acceptance to an owner dispatch from the exact master workflow and current SHA', () => {
    const guard = String(acceptance.if);
    expect(guard).toContain("github.event_name == 'workflow_dispatch'");
    expect(guard).toContain("github.repository == 'haizx71/lingua-os'");
    expect(guard).toContain("github.ref == 'refs/heads/master'");
    expect(guard).toContain(`github.workflow_ref == '${WORKFLOW_REF}'`);
    expect(guard).toContain(`github.actor == '${OWNER}'`);
    expect(guard).toContain(`github.triggering_actor == '${OWNER}'`);
    expect(guard).toContain("inputs.mode == 'acceptance'");
    const preflight = stepNamed(acceptance, 'Verify run SHA is still the master tip before staging secrets');
    const acceptanceStep = stepNamed(acceptance, 'Run protected K2-07 acceptance');
    expect(stepsFor(acceptance).indexOf(preflight)).toBeLessThan(stepsFor(acceptance).indexOf(acceptanceStep));
    expect(preflight.run).toContain('redirect: \'error\'');
    expect(preflight.run).toContain('process.env.GITHUB_SHA');
    expect(preflight.run).toContain('/git/ref/heads/master');
    expect(JSON.stringify(preflight)).not.toContain('secrets.');
    expect(asMap(acceptance.permissions, 'acceptance permissions')).toEqual({
      contents: 'read',
      deployments: 'read',
      'id-token': 'write',
    });
  });

  it('maps repository secrets only to the acceptance, janitor, and recovery steps', () => {
    const secretSteps: Array<{ job: string; step: string; json: string }> = [];
    for (const [jobName, rawJob] of Object.entries(secretJobs)) {
      const job = asMap(rawJob, `${jobName} job`);
      expect(job.env).toBeUndefined();
      expect(job.environment).toBeUndefined();
      for (const step of stepsFor(job)) {
        const json = JSON.stringify(step);
        if (json.includes('secrets.')) {
          secretSteps.push({ job: jobName, step: step.name ?? '', json });
        }
        if (step.uses) expect(step.uses).toMatch(/^[\w./-]+@[a-f0-9]{40}(?:\s+#.*)?$/);
      }
    }
    expect(secretSteps.map(({ job, step }) => `${job}:${step}`).sort()).toEqual([
      'current-run-cleanup:Recover only actors marked for this workflow run',
      'hosted-acceptance:Run protected K2-07 acceptance',
      'janitor:Run guarded TTL janitor only',
    ]);
    const acceptanceEnv = asMap(stepNamed(acceptance, 'Run protected K2-07 acceptance').env, 'acceptance step env');
    expect(STAGING_SECRET_NAMES.every(name => typeof acceptanceEnv[name] === 'string' &&
      String(acceptanceEnv[name]).includes(`secrets.${name}`))).toBe(true);
    for (const job of [janitor, cleanup]) {
      const stepName = job === janitor ? 'Run guarded TTL janitor only' : 'Recover only actors marked for this workflow run';
      const env = asMap(stepNamed(job, stepName).env, `${stepName} env`);
      expect(env.K2_STAGING_SUPABASE_SECRET_KEY).toContain('secrets.K2_STAGING_SUPABASE_SECRET_KEY');
      expect(env.K2_STAGING_READONLY_DATABASE_URL).toContain('secrets.K2_STAGING_READONLY_DATABASE_URL');
      expect(env.K2_STAGING_API_ORIGIN).toBeUndefined();
      expect(env.K2_STAGING_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
    }
  });

  it('keeps janitor owner-gated for manual runs and cleanup eligible after a started failure', () => {
    const janitorGuard = String(janitor.if);
    for (const guard of [
      "github.repository == 'haizx71/lingua-os'",
      "github.ref == 'refs/heads/master'",
      `github.workflow_ref == '${WORKFLOW_REF}'`,
      `github.actor == '${OWNER}'`,
      `github.triggering_actor == '${OWNER}'`,
    ]) expect(janitorGuard).toContain(guard);
    expect(janitorGuard).toContain("github.event_name == 'schedule'");
    expect(janitorGuard).toContain("inputs.mode == 'janitor'");
    expect(asMap(janitor.permissions, 'janitor permissions')).toEqual({ contents: 'read' });
    const janitorPreflight = stepNamed(janitor, 'Verify dispatch SHA is still the master tip before staging secrets');
    const janitorAction = stepNamed(janitor, 'Run guarded TTL janitor only');
    expect(stepsFor(janitor).indexOf(janitorPreflight)).toBeLessThan(stepsFor(janitor).indexOf(janitorAction));
    expect(janitorPreflight.run).toContain('redirect: \'error\'');

    const cleanupGuard = String(cleanup.if);
    expect(cleanupGuard).toContain('always()');
    expect(cleanupGuard).toContain("needs.hosted-acceptance.result != 'skipped'");
    expect(cleanupGuard).toContain(`github.actor == '${OWNER}'`);
    expect(cleanupGuard).toContain(`github.triggering_actor == '${OWNER}'`);
    expect(cleanupGuard).toContain(`github.workflow_ref == '${WORKFLOW_REF}'`);
    expect(cleanupGuard).toContain("github.ref == 'refs/heads/master'");
    expect(cleanupGuard).not.toContain('github.sha');
    expect(JSON.stringify(cleanup)).not.toContain('id-token');
    expect(cleanup.needs).toEqual(['hosted-acceptance']);
  });
});
