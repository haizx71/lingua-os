import { describe, expect, it } from 'vitest';
import {
  assertK2RetainedStateUnchanged,
  buildK2ProbeChildEnvironment,
  k2RetainedTableNames,
  parseK2ActorSnapshot,
  parseK2HostedMigrationProof,
  parseK2RetainedSnapshot,
} from './k2_hosted_probe_client';

const emptyActorSnapshot = () => ({
  totalRows: 0,
  tables: Object.fromEntries(k2RetainedTableNames().map(name => [name, {
    rows: 0,
    sha256: '0'.repeat(64),
  }])),
});

describe('K2 read-only probe client', () => {
  it('requires every pinned public learner table and visible retained rows', () => {
    const snapshot = emptyActorSnapshot();
    snapshot.totalRows = 2;
    snapshot.tables.users.rows = 1;
    snapshot.tables.learner_profiles.rows = 1;
    expect(parseK2RetainedSnapshot(snapshot).totalRows).toBe(2);
    expect(() => parseK2RetainedSnapshot({ ...snapshot, tables: { users: snapshot.tables.users } }))
      .toThrow('incomplete table inventory');
  });

  it('supports actor-specific zero proof and catches any residual owner row', () => {
    expect(parseK2ActorSnapshot(emptyActorSnapshot()).totalRows).toBe(0);
    const residual = emptyActorSnapshot();
    residual.totalRows = 1;
    residual.tables.review_items.rows = 1;
    expect(parseK2ActorSnapshot(residual).tables.review_items.rows).toBe(1);
  });

  it('detects a retained table digest or count change', () => {
    const before = emptyActorSnapshot();
    const after = emptyActorSnapshot();
    after.tables.users.rows = 1;
    after.totalRows = 1;
    expect(() => assertK2RetainedStateUnchanged(before, after)).toThrow('retained learner-state snapshot changed');
  });

  it('requires the approved application migration head and exact count', () => {
    expect(parseK2HostedMigrationProof({ appMigrationHead: '0017', appliedMigrations: 17 }))
      .toEqual({ appMigrationHead: '0017', appliedMigrations: 17 });
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0019', appliedMigrations: 19 }))
      .toThrow('staging migration head does not match');
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0017', appliedMigrations: 19 }))
      .toThrow('staging migration head does not match');
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0019', appliedMigrations: 17 }))
      .toThrow('staging migration head does not match');
  });

  it('passes only the read-only URL, action, actor identity, and available runner basics to the probe child', () => {
    const systemEnv = { PATH: 'runner-path', PGSSLROOTCERT: '/runner/supabase-root.crt', SUPABASE_SECRET_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'must-not-inherit' };
    const environment = buildK2ProbeChildEnvironment(
      'actor_absent',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      '550e8400-e29b-41d4-a716-446655440000',
      systemEnv,
    );
    expect(environment).toEqual(expect.objectContaining({
      PATH: 'runner-path',
      PGSSLROOTCERT: '/runner/supabase-root.crt',
      K2_ACCEPTANCE_PROBE_ACTION: 'actor_absent',
      K2_ACCEPTANCE_ACTOR_ID: '550e8400-e29b-41d4-a716-446655440000',
    }));
    expect(environment).not.toHaveProperty('SUPABASE_SECRET_KEY');
    expect(environment).not.toHaveProperty('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(Object.keys(environment).sort()).toEqual([
      'K2_ACCEPTANCE_ACTOR_ID',
      'K2_ACCEPTANCE_PROBE_ACTION',
      'K2_STAGING_READONLY_DATABASE_URL',
      'PATH',
      'PGSSLROOTCERT',
      ...(process.platform === 'win32' && systemEnv.SystemRoot ? ['SystemRoot'] : []),
    ].sort());
  });
});
