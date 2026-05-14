// NEW: Predictive Alert System + Trend Analysis + IoT Integration Hub

import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import bcrypt from 'bcryptjs';
import { predictAlert } from '../services/openrouter.js';

const router = Router();

// ─── Predictive Alerts ───────────────────────────────────────────────────────

router.get('/alerts', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const conditions = [];
    const params = [];
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM predictive_alerts ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM predictive_alerts ${where}`, params),
    ]);

    res.json({
      data: data.rows,
      pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch predictive alerts' });
  }
});

// Generate a predictive alert from recent sensor data
router.post('/generate/:sensor_id', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { sensor_id } = req.params;
    const lookback_hours = parseInt(req.query.lookback_hours) || 24;

    const history = await pool.query(
      `SELECT temperature, humidity, status, timestamp
       FROM temperature_readings
       WHERE sensor_id = $1
         AND timestamp >= NOW() - INTERVAL '${lookback_hours} hours'
       ORDER BY timestamp DESC
       LIMIT 200`,
      [sensor_id]
    );

    if (!history.rows.length) {
      return res.status(404).json({ error: 'No historical data found for this sensor' });
    }

    const aiRes = await predictAlert(history.rows);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    const productType = req.body.product_type || null;

    const result = await pool.query(
      `INSERT INTO predictive_alerts (sensor_id, product_type, alert_probability_pct, predicted_alert_window_hours, predicted_severity, trend_direction, ai_results)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        sensor_id,
        productType,
        aiRes.parsed?.alert_probability_pct || null,
        aiRes.parsed?.predicted_alert_window_hours || null,
        aiRes.parsed?.predicted_severity || null,
        aiRes.parsed?.trend_direction || null,
        aiRes.parsed ? JSON.stringify(aiRes.parsed) : null,
      ]
    );

    res.status(201).json({
      predictive_alert: result.rows[0],
      raw: aiRes.content,
      parseStrategy: aiRes.parseStrategy,
      sample_size: history.rows.length,
    });
  } catch (err) {
    console.error('Error generating predictive alert:', err);
    res.status(500).json({ error: 'Failed to generate predictive alert' });
  }
});

router.post('/alerts/:id/dismiss', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE predictive_alerts SET status='dismissed', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

// ─── Trend Analysis (NEW) ────────────────────────────────────────────────────

router.get('/trend/:sensor_id', authenticate, async (req, res) => {
  try {
    const { sensor_id } = req.params;
    const window_hours = parseInt(req.query.window_hours) || 24;

    const result = await pool.query(
      `SELECT
         DATE_TRUNC('hour', timestamp) AS bucket,
         ROUND(AVG(temperature)::numeric, 2) AS avg_temp,
         ROUND(MIN(temperature)::numeric, 2) AS min_temp,
         ROUND(MAX(temperature)::numeric, 2) AS max_temp,
         ROUND(AVG(humidity)::numeric, 2) AS avg_humidity,
         COUNT(*) AS readings,
         COUNT(*) FILTER (WHERE status IN ('warning','critical','alert')) AS anomalies
       FROM temperature_readings
       WHERE sensor_id = $1
         AND timestamp >= NOW() - INTERVAL '${window_hours} hours'
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [sensor_id]
    );

    res.json({
      sensor_id,
      window_hours,
      buckets: result.rows,
      total_anomalies: result.rows.reduce((sum, r) => sum + parseInt(r.anomalies), 0),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching trend:', err);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

// ─── IoT Integration Hub (NEW) ───────────────────────────────────────────────
// Issue API key, ingest readings via key, list sources

router.get('/iot/sources', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, vendor, last_ingest_at, total_readings, active, created_at FROM iot_sources ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch IoT sources' });
  }
});

// Issue API key for an IoT source
router.post('/iot/sources', authenticate, async (req, res) => {
  try {
    const { name, vendor } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Generate a random API key
    const rawKey = `cck_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const keyHash = await bcrypt.hash(rawKey, 8);

    const result = await pool.query(
      `INSERT INTO iot_sources (name, api_key_hash, vendor) VALUES ($1, $2, $3) RETURNING id, name, vendor, active, created_at`,
      [name, keyHash, vendor || 'generic']
    );

    res.status(201).json({
      source: result.rows[0],
      api_key: rawKey,
      message: 'Save this API key now — it will not be shown again.',
    });
  } catch (err) {
    console.error('Error creating IoT source:', err);
    res.status(500).json({ error: err.message });
  }
});

// Ingest readings (via API key, no JWT)
router.post('/iot/ingest', async (req, res) => {
  try {
    const apiKey = req.headers['x-iot-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'X-IoT-API-Key header is required' });

    const sources = await pool.query(`SELECT id, api_key_hash, active FROM iot_sources WHERE active = true`);
    let matchedSource = null;
    for (const src of sources.rows) {
      if (await bcrypt.compare(apiKey, src.api_key_hash)) {
        matchedSource = src;
        break;
      }
    }
    if (!matchedSource) return res.status(401).json({ error: 'Invalid IoT API key' });

    const { readings } = req.body;
    if (!Array.isArray(readings)) return res.status(400).json({ error: 'readings must be an array' });
    if (readings.length === 0) return res.status(400).json({ error: 'readings array is empty' });
    if (readings.length > 1000) return res.status(400).json({ error: 'Maximum 1000 readings per ingest' });

    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query('BEGIN');
      for (const r of readings) {
        if (!r.sensor_id || r.temperature === undefined) continue;
        const ins = await client.query(
          `INSERT INTO temperature_readings (sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp, facility_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [r.sensor_id, r.location || null, r.zone || null, r.product_type || null, r.temperature, r.humidity || null, r.min_threshold || null, r.max_threshold || null, r.status || 'normal', r.unit || 'C', r.timestamp || new Date(), r.facility_id || null]
        );
        inserted.push(ins.rows[0].id);
      }
      await client.query(`UPDATE iot_sources SET last_ingest_at = NOW(), total_readings = total_readings + $1 WHERE id = $2`, [inserted.length, matchedSource.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({ ingested: inserted.length, source_id: matchedSource.id });
  } catch (err) {
    console.error('Error ingesting IoT data:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/iot/sources/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE iot_sources SET active=false WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Source not found' });
    res.json({ message: 'Source revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke source' });
  }
});

// ─── Scheduled Reports (NEW: Compliance Report Auto-Generation) ──────────────

router.get('/reports/scheduled', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM scheduled_reports WHERE active = true ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

router.post('/reports/scheduled', authenticate, async (req, res) => {
  try {
    const { name, report_type, format, schedule_cron, recipients, filters, facility_id } = req.body;
    if (!name || !report_type) return res.status(400).json({ error: 'name and report_type are required' });
    const result = await pool.query(
      `INSERT INTO scheduled_reports (user_id, name, report_type, format, schedule_cron, recipients, filters, facility_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name, report_type, format || 'pdf', schedule_cron || '0 0 * * MON', JSON.stringify(recipients || []), JSON.stringify(filters || {}), facility_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating scheduled report:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/reports/scheduled/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE scheduled_reports SET active=false WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Scheduled report not found' });
    res.json({ message: 'Scheduled report deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete scheduled report' });
  }
});

export default router;
