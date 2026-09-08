import { describe, expect, it } from 'vitest';
import { assertExact, assertProjectionNumber, assertTimestamp } from './persisted_assertions';

describe('F1 persisted precision boundaries', () => {
  it('accepts the actual PostgreSQL Decimal zero serialization 0E-8', () => {
    expect(() => assertProjectionNumber(0, '0E-8', 'confidence')).not.toThrow();
  });
  it.each([undefined, '', ' ', 'NaN', 'Infinity'])('rejects missing/malformed decimal %s', value => {
    expect(() => assertProjectionNumber(0, value, 'confidence')).toThrow();
  });
  it('keeps IDs, counts and microsecond timestamps exact', () => {
    expect(() => assertExact(1, '1', 'count')).toThrow();
    expect(() => assertExact(1, 1.000000001, 'version')).toThrow();
    expect(() => assertTimestamp('2026-09-06T08:00:00.000001Z', '2026-09-06T08:00:00.000002+00:00', 'time')).toThrow();
    expect(() => assertTimestamp('2026-09-06T08:00:00.123Z', '2026-09-06T08:00:00.123000+00:00', 'time')).not.toThrow();
  });
});
