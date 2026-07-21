export const DISPOSITION_TRANSITIONS = Object.freeze({ pending: ['quarantine'], quarantine: ['released', 'destroyed', 'recalled'], released: [], destroyed: [], recalled: [] });

export function classifyReading({ value, min, max, measuredAt, receivedAt, calibratedUntil }) {
  for (const [name, candidate] of Object.entries({ value, min, max })) if (!Number.isFinite(Number(candidate))) throw new Error(`${name} must be numeric`);
  if (!measuredAt || !receivedAt || !calibratedUntil) throw new Error('measurement, receipt, and calibration timestamps are required');
  const measured = new Date(measuredAt); const received = new Date(receivedAt); const calibrated = new Date(calibratedUntil);
  if ([measured, received, calibrated].some((d) => Number.isNaN(d.getTime()))) throw new Error('timestamps must be valid');
  const gapSeconds = Math.max(0, (received - measured) / 1000);
  const outOfRange = Number(value) < Number(min) || Number(value) > Number(max);
  return { outOfRange, calibrationValid: measured <= calibrated, gapSeconds, requiresReview: outOfRange || measured > calibrated || gapSeconds > 900 };
}

export function calculateExcursion(readings, thresholdSeconds = 0) {
  if (!Array.isArray(readings) || readings.length < 2) throw new Error('at least two ordered readings are required');
  const ordered = [...readings].sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
  let seconds = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const interval = (new Date(ordered[i].measuredAt) - new Date(ordered[i - 1].measuredAt)) / 1000;
    if (interval < 0 || interval > 3600) throw new Error('sensor gap prevents authoritative excursion calculation');
    if (ordered[i - 1].outOfRange) seconds += interval;
  }
  return { durationSeconds: seconds, excursion: seconds > thresholdSeconds };
}

export function approveDisposition(current, next, actorRole, hasOpenCorrectiveAction) {
  if (!(DISPOSITION_TRANSITIONS[current] || []).includes(next)) throw new Error(`invalid disposition ${current} -> ${next}`);
  if (!['quality_manager', 'admin'].includes(actorRole)) throw new Error('quality approval required');
  if (next === 'released' && hasOpenCorrectiveAction) throw new Error('corrective action must be closed before release');
  return next;
}
