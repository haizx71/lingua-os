import { test } from '@playwright/test';
import {
  cleanupK2RunActors,
  createK2AdminClient,
  createK2HostedFixtureOidcToken,
  reapExpiredK2Actors,
  requestK2HostedFixtureControl,
  validateK2HostedEnvironment,
  verifyK2HostedCurrentMasterSha,
} from './support/k2_hosted_actors';
import {
  resolveK2HostedRunMode,
  resolveK2HostedWaveSelector,
} from './support/k2_hosted_acceptance_helpers';
import { runK2HostedProbe } from './support/k2_hosted_probe_client';
import { runK2HostedWave } from './support/k2_hosted_runner';
import { k2HostedWaveK207 } from './support/k2_hosted_wave_k2_07';
import { k2HostedWaveK208DueOnly } from './support/k2_hosted_wave_k2_08_due_only';
import { k2HostedWaveK208 } from './support/k2_hosted_wave_k2_08';
import { k2HostedWaveK209 } from './support/k2_hosted_wave_k2_09';
import { cleanupK209FixtureAfterCurrentRun } from './support/k2_hosted_runner';

const RUN_MODE = resolveK2HostedRunMode(process.env.K2_ACCEPTANCE_MODE);
const WAVE_SELECTOR = resolveK2HostedWaveSelector(process.env.K2_ACCEPTANCE_WAVE);

async function verifyActorGone(config: ReturnType<typeof validateK2HostedEnvironment>, actorId: string): Promise<void> {
  const result = await runK2HostedProbe('actor_absent', config.readonlyDatabaseUrl, actorId);
  if (!('tables' in result) || result.totalRows !== 0) {
    throw new Error('K2 hosted acceptance cleanup left actor-owned learner rows.');
  }
}

test.describe('K2 protected hosted acceptance lifecycle', () => {
  test.setTimeout(12 * 60_000);

  test('hosted lifecycle delegates K2-07 fixture assertions to the shared wave runner', async ({ page, context }) => {
    test.skip(RUN_MODE !== 'acceptance' || WAVE_SELECTOR !== 'K2-07', 'The selected hosted subcase is not K2-07.');
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runK2HostedWave(config, page, context, test.info(), k2HostedWaveK207);
  });

  test('hosted lifecycle runs only the K2-08 due-only subcase', async ({ page, context }) => {
    test.skip(RUN_MODE !== 'acceptance' || WAVE_SELECTOR !== 'K2-08-DUE-ONLY',
      'The selected hosted subcase is not K2-08 due-only.');
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runK2HostedWave(config, page, context, test.info(), k2HostedWaveK208DueOnly);
  });

  test('hosted lifecycle runs the complete four-actor K2-08 gate', async ({ page, context }) => {
    test.skip(RUN_MODE !== 'acceptance' || WAVE_SELECTOR !== 'K2-08',
      'The selected hosted subcase is not full K2-08.');
    test.setTimeout(25 * 60_000);
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runK2HostedWave(config, page, context, test.info(), k2HostedWaveK208);
  });

  test('hosted lifecycle runs the K2-09 bridge-backed Dictionary gate', async ({ page, context }) => {
    test.skip(RUN_MODE !== 'acceptance' || WAVE_SELECTOR !== 'K2-09',
      'The selected hosted subcase is not K2-09.');
    test.setTimeout(25 * 60_000);
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runK2HostedWave(config, page, context, test.info(), k2HostedWaveK209);
  });

  test('strict TTL janitor only reaps marked expired actors', async () => {
    test.skip(RUN_MODE !== 'janitor', 'The configured run mode is not janitor.');
    const config = validateK2HostedEnvironment(process.env, 'janitor');
    await verifyK2HostedCurrentMasterSha(config);
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
    const removed = await cleanupK2RunActors(
      config,
      createK2AdminClient(config) as never,
      actorId => verifyActorGone(config, actorId),
    );
    if (WAVE_SELECTOR === 'K2-09') await cleanupK209FixtureAfterCurrentRun(config);
    test.info().annotations.push({ type: 'current-run-actors-cleaned', description: String(removed) });
  });

  test('fixture reaper only closes expired completed run receipts', async () => {
    test.skip(RUN_MODE !== 'fixture-reap', 'The configured run mode is not the fixture reaper.');
    const config = validateK2HostedEnvironment(process.env, 'fixture-reap');
    await verifyK2HostedCurrentMasterSha(config);
    const token = await createK2HostedFixtureOidcToken(config);
    const result = await requestK2HostedFixtureControl(
      config, 'reap-expired', token, config.githubToken,
    );
    if (!('processedCount' in result)) {
      throw new Error('K2 hosted fixture reaper response was invalid.');
    }
    test.info().annotations.push({
      type: 'expired-fixtures-processed',
      description: String(result.processedCount),
    });
  });
});
