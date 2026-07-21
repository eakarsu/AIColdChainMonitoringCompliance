import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReading, calculateExcursion, approveDisposition } from '../domain/coldChainWorkflow.js';

test('flags threshold, late gateway, and expired calibration independently', () => {
  const result = classifyReading({ value: 9, min: 2, max: 8, measuredAt: '2026-01-01T00:00:00Z', receivedAt: '2026-01-01T00:20:00Z', calibratedUntil: '2025-12-31T00:00:00Z' });
  assert.deepEqual(result, { outOfRange: true, calibrationValid: false, gapSeconds: 1200, requiresReview: true });
});
test('calculates deterministic excursion duration and rejects trace gaps', () => {
  assert.deepEqual(calculateExcursion([{ measuredAt: '2026-01-01T00:00:00Z', outOfRange: true }, { measuredAt: '2026-01-01T00:10:00Z', outOfRange: false }], 300), { durationSeconds: 600, excursion: true });
  assert.throws(() => calculateExcursion([{ measuredAt: '2026-01-01T00:00:00Z', outOfRange: true }, { measuredAt: '2026-01-01T02:00:00Z', outOfRange: false }]), /gap/);
});
test('requires quality approval and closed corrective action to release', () => {
  assert.throws(() => approveDisposition('quarantine', 'released', 'operator', false), /quality/);
  assert.throws(() => approveDisposition('quarantine', 'released', 'quality_manager', true), /corrective/);
  assert.equal(approveDisposition('quarantine', 'recalled', 'quality_manager', true), 'recalled');
});
