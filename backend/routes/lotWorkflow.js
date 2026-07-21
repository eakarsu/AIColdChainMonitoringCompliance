import { Router } from 'express';
import crypto from 'node:crypto';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { classifyReading, approveDisposition } from '../domain/coldChainWorkflow.js';
const router = Router();

const tenant = (req, res) => req.user?.tenant_id || (res.status(403).json({ error: 'Tenant-scoped identity required' }), null);

router.post('/telemetry', async (req, res) => {
  const secret = process.env.DEVICE_SIGNING_SECRET; const signature = req.get('X-Device-Signature') || '';
  if (!secret || secret.length < 32) return res.status(503).json({ error: 'Device verification is not configured' });
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid device signature' });
  const { tenant_id, lot_id, device_external_id, idempotency_key, measured_at, temperature, payload_sha256 } = req.body;
  if (!tenant_id || !lot_id || !device_external_id || !idempotency_key || !/^[a-f0-9]{64}$/i.test(payload_sha256 || '')) return res.status(400).json({ error: 'Complete telemetry identity and checksum required' });
  try {
    const found = await pool.query(`SELECT l.*,d.id AS device_id,d.calibrated_until,d.revoked_at FROM governed_lots l JOIN calibrated_devices d ON d.tenant_id=l.tenant_id WHERE l.id=$1 AND l.tenant_id=$2 AND d.external_id=$3`, [lot_id, tenant_id, device_external_id]);
    if (!found.rowCount || found.rows[0].revoked_at) return res.status(403).json({ error: 'Active calibrated device and lot binding not found' });
    const row = found.rows[0];
    const classification = classifyReading({ value: temperature, min: row.min_temperature, max: row.max_temperature, measuredAt: measured_at, receivedAt: new Date().toISOString(), calibratedUntil: row.calibrated_until });
    const inserted = await pool.query(`INSERT INTO lot_telemetry(tenant_id,lot_id,device_id,idempotency_key,measured_at,temperature,payload_sha256,calibration_valid,out_of_range)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`, [tenant_id, lot_id, row.device_id, idempotency_key, measured_at, temperature, payload_sha256.toLowerCase(), classification.calibrationValid, classification.outOfRange]);
    if (classification.requiresReview) await pool.query(`UPDATE governed_lots SET disposition='quarantine',version=version+1 WHERE id=$1 AND tenant_id=$2 AND disposition='pending'`, [lot_id, tenant_id]);
    res.status(202).json({ reading: inserted.rows[0], classification });
  } catch (error) { res.status(422).json({ error: error.message }); }
});

router.post('/lots/:id/custody', authenticate, async (req, res) => {
  const tenantId = tenant(req, res); if (!tenantId) return;
  const { eventType, location, occurredAt, priorEventHash, eventHash, eventData = {} } = req.body;
  if (!eventType || !occurredAt || !/^[a-f0-9]{64}$/i.test(eventHash || '')) return res.status(400).json({ error: 'eventType, occurredAt, and eventHash required' });
  const lot = await pool.query('SELECT id FROM governed_lots WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
  if (!lot.rowCount) return res.status(404).json({ error: 'Lot not found in tenant' });
  const last = await pool.query('SELECT event_hash FROM lot_custody_events WHERE lot_id=$1 AND tenant_id=$2 ORDER BY sequence DESC LIMIT 1', [req.params.id, tenantId]);
  if ((last.rows[0]?.event_hash || null) !== (priorEventHash || null)) return res.status(409).json({ error: 'Custody hash chain mismatch' });
  const result = await pool.query(`INSERT INTO lot_custody_events(tenant_id,lot_id,actor_id,event_type,location,prior_event_hash,event_hash,event_data,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [tenantId, req.params.id, req.user.id, eventType, location, priorEventHash || null, eventHash.toLowerCase(), JSON.stringify(eventData), occurredAt]);
  res.status(201).json(result.rows[0]);
});

router.post('/lots/:id/disposition', authenticate, async (req, res) => {
  const tenantId = tenant(req, res); if (!tenantId) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM governed_lots WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, tenantId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Lot not found' }); }
    const open = await client.query(`SELECT count(*)::int AS count FROM lot_corrective_actions WHERE lot_id=$1 AND tenant_id=$2 AND status <> 'closed'`, [req.params.id, tenantId]);
    const next = approveDisposition(found.rows[0].disposition, req.body.disposition, req.user.role, open.rows[0].count > 0);
    await client.query('UPDATE governed_lots SET disposition=$1,version=version+1 WHERE id=$2 AND tenant_id=$3', [next, req.params.id, tenantId]);
    await client.query(`INSERT INTO lot_custody_events(tenant_id,lot_id,actor_id,event_type,event_hash,event_data,occurred_at) VALUES($1,$2,$3,'disposition',encode(digest($4::text,'sha256'),'hex'),$4::jsonb,now())`, [tenantId, req.params.id, String(req.user.id), JSON.stringify({ disposition: next, reason: req.body.reason })]);
    await client.query('COMMIT'); res.json({ disposition: next });
  } catch (error) { await client.query('ROLLBACK'); res.status(409).json({ error: error.message }); } finally { client.release(); }
});
export default router;
