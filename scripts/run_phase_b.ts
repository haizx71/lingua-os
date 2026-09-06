/**
 * CLI execution entrypoint for FRLL Phase B Learning Loop.
 * Consumes environment variables from process environment without logging secrets.
 */

import { runPhaseBLearningLoop } from '../tests/acceptance/support/phase_b_runner';

async function main(): Promise<void> {
  console.log('========================================================');
  console.log('LINGUA OS - FRLL PHASE B EXECUTION');
  console.log('========================================================');

  try {
    const report = await runPhaseBLearningLoop();
    console.log('\n========================================================');
    console.log('FRLL PHASE B: PASS');
    console.log('========================================================');
    console.log(`Execution Duration: ${report.durationMs}ms`);
    console.log(`Actor UUID: ${report.userId}`);
    console.log(`Language Profile: ${report.languageProfileId}`);
    console.log(`Anchor Concept: ${report.conceptId}`);
    console.log(`Initial Save Timestamp: ${report.firstSaveTimestamp}`);
    console.log(`Post-Save Memory Lineage Count: ${report.postSaveDigest.review_item_count}`);
    console.log(`Post-Resave Memory Lineage Count: ${report.postResaveDigest.review_item_count}`);
    const fsrs = report.postSaveDigest.fsrs_states[0];
    if (fsrs) {
      console.log(`FSRS State: ${fsrs.state} (version ${fsrs.state_version})`);
      console.log(`FSRS Due At: ${fsrs.due_at}`);
    }
    console.log(`Learning Events Count: ${report.postSaveDigest.learning_event_count}`);
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] FRLL Phase B execution halted with error:');
    console.error((err as Error).message);
    process.exit(1);
  }
}

void main();
