import { test } from '@playwright/test';
import {
  resolveK2HostedRunMode,
  resolveK2HostedWaveSelector,
} from './support/k2_hosted_acceptance_helpers';
import { validateK2HostedEnvironment } from './support/k2_hosted_actors';
import {
  runPilotReaderHostedAcceptance,
  runPilotReaderHostedRecovery,
} from './support/pilot_reader_hosted_runner';

const RUN_MODE = resolveK2HostedRunMode(process.env.K2_ACCEPTANCE_MODE);
const SELECTOR = resolveK2HostedWaveSelector(process.env.K2_ACCEPTANCE_WAVE);

test.describe('PILOT-READER protected hosted acceptance', () => {
  test('pilot hosted Reader lifecycle', async ({ browser, page }) => {
    test.skip(RUN_MODE !== 'acceptance' || SELECTOR !== 'PILOT-READER',
      'The selected hosted subcase is not PILOT-READER.');
    test.setTimeout(30 * 60_000);
    const config = validateK2HostedEnvironment(process.env, 'acceptance');
    await runPilotReaderHostedAcceptance(config, browser, page);
  });

  test('recover only the fixed failed PILOT-READER run', async () => {
    test.skip(RUN_MODE !== 'reader-recovery' || SELECTOR !== 'PILOT-READER',
      'The selected subcase is not fixed PILOT-READER recovery.');
    test.setTimeout(15 * 60_000);
    const config = validateK2HostedEnvironment(process.env, 'reader-recovery');
    await runPilotReaderHostedRecovery(config);
  });
});
