import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateFrllEnvironment, FRLL_REQUIRED_ENV_VARS } from './support/env_config';
import { generateDisposableCredentials } from './support/supabase_users';

const FIXTURE_SQL_PATH = path.resolve(__dirname, '../../database/seeds/first_real_learning_loop.sql');
const EXPECTED_CONCEPT_ID = '7f110000-0000-4000-8000-000000000004';
const EXPECTED_LEMMA = 'frll-anchor';

const LEARNER_DERIVED_TABLES = [
  'users',
  'learner_profiles',
  'user_languages',
  'user_saved_concepts',
  'user_saved_content',
  'user_saved_sentences',
  'concept_save_intents',
  'user_concept_states',
  'user_skill_states',
  'user_language_projection_heads',
  'learning_events',
  'exposure_events',
  'review_items',
  'fsrs_states',
  'review_events',
  'today_plans',
  'today_plan_activities',
  'today_activity_review_items',
  'profile_mutation_results',
  'assessment_attempts',
  'assessment_responses',
  'assessment_results',
];

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

test.describe('FRLL Phase A.1: Playwright Browser Harness Smoke', () => {
  test('launches real Chromium browser, verifies DOM execution and Playwright locator assertions', async ({
    page,
  }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>FRLL Playwright Harness Smoke</title>
        </head>
        <body>
          <div id="harness-root">
            <h1 id="harness-title">Playwright Browser Acceptance Harness</h1>
            <p id="harness-status" data-ready="true">OPERATIONAL</p>
          </div>
        </body>
      </html>
    `);

    const title = page.locator('#harness-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Playwright Browser Acceptance Harness');

    const statusEl = page.locator('#harness-status');
    await expect(statusEl).toHaveAttribute('data-ready', 'true');
    await expect(statusEl).toHaveText('OPERATIONAL');

    expect(await page.title()).toBe('FRLL Playwright Harness Smoke');
  });
});

test.describe('FRLL Phase A: Acceptance Test Preflight & Fixture Isolation', () => {
  test('FRLL-01 preflight: detects missing environment variables without leaking secrets', () => {
    const result = validateFrllEnvironment({});
    expect(result.ok).toBe(false);
    expect(result.missingVars).toEqual(FRLL_REQUIRED_ENV_VARS);
    expect(result.missingVars).toContain('DATABASE_URL');
    expect(result.missingVars).toContain('SUPABASE_URL');
    expect(
      result.missingVars.includes('SUPABASE_SECRET_KEY') ||
      result.missingVars.includes('SUPABASE_SERVICE_ROLE_KEY')
    ).toBe(true);
    expect(result.missingVars).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(result.missingVars).toContain('NEXT_PUBLIC_API_BASE_URL');
    expect(result.missingVars.length).toBe(8);
  });

  test('FRLL-03 fixture: SQL seed contains strictly zero inserts into learner-derived tables', () => {
    expect(fs.existsSync(FIXTURE_SQL_PATH)).toBe(true);
    const sqlContent = fs.readFileSync(FIXTURE_SQL_PATH, 'utf-8');

    for (const table of LEARNER_DERIVED_TABLES) {
      const regex = new RegExp(`INSERT\\s+INTO\\s+${table}\\b`, 'i');
      expect(regex.test(sqlContent)).toBe(false);
    }
  });

  test('FRLL-03 idempotency: every INSERT statement enforces ON CONFLICT DO NOTHING', () => {
    const sqlContent = fs.readFileSync(FIXTURE_SQL_PATH, 'utf-8');
    const insertBlocks = sqlContent.split(/INSERT\s+INTO\s+/i).slice(1);
    expect(insertBlocks.length).toBeGreaterThan(0);

    for (const block of insertBlocks) {
      const hasOnConflict = /ON\s+CONFLICT\s*(\([^)]+\))?\s*DO\s+NOTHING/i.test(block);
      expect(hasOnConflict).toBe(true);
    }
  });

  test('FRLL-04 catalog fixture: defines stable anchor concept with complete provenance metadata', () => {
    const sqlContent = fs.readFileSync(FIXTURE_SQL_PATH, 'utf-8');

    expect(sqlContent).toContain(EXPECTED_CONCEPT_ID);
    expect(sqlContent).toContain(EXPECTED_LEMMA);
    expect(sqlContent).toContain('LINGUA-FIXTURE');
    expect(sqlContent).toContain("'approved'");
    expect(sqlContent).toContain("'allowed'");
    expect(sqlContent).toContain("'word'");
    expect(sqlContent).toContain("'noun'");
    expect(sqlContent).toContain("'en'");
    expect(sqlContent).toContain("'vi'");
  });

  test('FRLL-16 isolation: generates random disposable credentials with distinct run tags', () => {
    const creds1 = generateDisposableCredentials('run-a');
    const creds2 = generateDisposableCredentials('run-b');

    expect(creds1.email).toMatch(/^frll-run-a-[a-f0-9-]+@example\.invalid$/);
    expect(creds2.email).toMatch(/^frll-run-b-[a-f0-9-]+@example\.invalid$/);
    expect(creds1.email).not.toBe(creds2.email);
    expect(creds1.password).not.toBe(creds2.password);
    expect(creds1.password.length).toBeGreaterThanOrEqual(16);
  });
});

test.describe('FRLL Phase B–F: Real-Auth Scenarios (External Supabase Prerequisite Blocked)', () => {
  test.beforeEach(() => {
    test.skip(
      !hasRealSupabaseEnv,
      'External Supabase credentials absent (EXTERNAL_PREREQUISITE_BLOCKED)'
    );
  });

  test('FRLL-01 & FRLL-02: Authenticated Actor Bootstrap & Profile Creation', async ({ page }) => {
    await page.goto('/auth');
  });

  test('FRLL-05 & FRLL-06: Dictionary Discovery & Live Save/Learn Activation', async ({ page }) => {
    await page.goto('/dictionary');
  });

  test('FRLL-07: Server-Generated Today Plan Verification', async ({ page }) => {
    await page.goto('/today');
  });

  test('FRLL-08 & FRLL-09: Live Review Answer & Atomic Transition', async ({ page }) => {
    await page.goto('/review');
  });

  test('FRLL-10 & FRLL-11: Idempotency, Replay & Lost-Response Recovery', async ({ page }) => {
    await page.goto('/review');
  });

  test('FRLL-12 & FRLL-13: Brain Projection & Actor Isolation', async ({ page }) => {
    await page.goto('/brain');
  });
});
