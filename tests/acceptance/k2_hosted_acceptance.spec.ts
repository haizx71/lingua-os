import { test } from '@playwright/test';
import {
  cleanupK2RunActors,
  createK2AdminClient,
  reapExpiredK2Actors,
  validateK2HostedEnvironment,
} from './support/k2_hosted_actors';
import { resolveK2HostedRunMode } from './support/k2_hosted_acceptance_helpers';
import { runK2HostedProbe } from './support/k2_hosted_probe_client';
import { runK2HostedWave } from './support/k2_hosted_runner';
import { k2HostedWaveK207 } from './support/k2_hosted_wave_k2_07';

const RUN_MODE = resolveK2HostedRunMode(process.env.K2_ACCEPTANCE_MODE);

async function verifyActorGone(config: ReturnType<typeof validateK2HostedEnvironment>, actorId: string): Promise<void> {
  const result = await runK2HostedProbe('actor_absent', config.readonlyDatabaseUrl, actorId);
  if (!('tables' in result) || result.totalRows !== 0) {
    throw new Error('K2 hosted acceptance cleanup left actor-owned learner rows.');
  }
}

async function requireAcceptedMigrationHead(config: ReturnType<typeof validateK2HostedEnvironment>): Promise<void> {
  const result = await runK2HostedProbe('migrations', config.readonlyDatabaseUrl);
  if (!('appMigrationHead' in result) || result.appMigrationHead !== '0019') {
    throw new Error('K2 hosted acceptance staging migration head is not approved.');
  }
}

test.describe('K2 protected hosted acceptance lifecycle', () => {
  test.setTimeout(12 * 60_000);

  test('hosted lifecycle delegates K2-07 fixture assertions to the shared wave runner', async ({ page, context }) => {
    test.skip(RUN_MODE !== 'acceptance', 'The configured run mode is not acceptance.');
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runK2HostedWave(config, page, context, test.info(), k2HostedWaveK207);
  });

  test('strict TTL janitor only reaps marked expired actors', async () => {
    test.skip(RUN_MODE !== 'janitor', 'The configured run mode is not janitor.');
    const config = validateK2HostedEnvironment(process.env, 'janitor');
    await requireAcceptedMigrationHead(config);
    const removed = await reapExpiredK2Actors(
      config,
      undefined,
      Date.now(),
      actorId => verifyActorGone(config, actorId),
    );
    test.info().annotations.push({ type: 'expired-actors-reaped', description: String(removed) });
  });

  test('unconditional current-run cleanup recovery', async () => {
    test.skip(RUN_MODE !== 'cleanup-current', 'The configured run mode is not cleanup recovery.');
    const config = validateK2HostedEnvironment(process.env, 'cleanup-current');
    await requireAcceptedMigrationHead(config);
    const removed = await cleanupK2RunActors(
      config,
      createK2AdminClient(config) as never,
      actorId => verifyActorGone(config, actorId),
    );
    test.info().annotations.push({ type: 'current-run-actors-cleaned', description: String(removed) });
  });
});
