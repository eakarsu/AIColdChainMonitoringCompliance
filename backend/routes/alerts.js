import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import fetch from 'node-fetch';

const router = Router();

// ─── In-memory threshold config (falls back to DB table if available) ─────────
// Structure: { [category]: { min_temp, max_temp, humidity_min, humidity_max, response_time_sla_minutes } }
let thresholdConfig = {};

// ─── Webhook delivery with retry ──────────────────────────────────────────────
async function deliverWebhook(webhookUrl, payload, attempt = 1) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      setTimeout(() => deliverWebhook(webhookUrl, payload, attempt + 1), delay);
    } else {
      console.error(`Webhook delivery failed after 3 attempts to ${webhookUrl}:`, err.message);
    }
  }
}

// ─── Fire webhooks for critical alerts ────────────────────────────────────────
export async function fireCriticalWebhooks(alertData) {
  try {
    const result = await pool.query('SELECT webhook_url FROM webhook_configs WHERE active = true');
    for (const row of result.rows) {
      deliverWebhook(row.webhook_url, {
        event: 'critical_alert',
        timestamp: new Date().toISOString(),
        alert: alertData,
      });
    }
  } catch (err) {
    console.error('Error firing webhooks:', err.message);
  }
}

// ─── POST /api/alerts/configure — set thresholds ──────────────────────────────
router.post('/configure', authenticate, async (req, res) => {
  try {
    const {
      category,
      min_temp,
      max_temp,
      humidity_min,
      humidity_max,
      response_time_sla_minutes,
    } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    thresholdConfig[category] = {
      min_temp: min_temp ?? thresholdConfig[category]?.min_temp,
      max_temp: max_temp ?? thresholdConfig[category]?.max_temp,
      humidity_min: humidity_min ?? thresholdConfig[category]?.humidity_min,
      humidity_max: humidity_max ?? thresholdConfig[category]?.humidity_max,
      response_time_sla_minutes: response_time_sla_minutes ?? thresholdConfig[category]?.response_time_sla_minutes,
    };

    // Persist to DB if table exists
    try {
      await pool.query(`
        INSERT INTO alert_thresholds (category, min_temp, max_temp, humidity_min, humidity_max, response_time_sla_minutes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (category) DO UPDATE
          SET min_temp = EXCLUDED.min_temp,
              max_temp = EXCLUDED.max_temp,
              humidity_min = EXCLUDED.humidity_min,
              humidity_max = EXCLUDED.humidity_max,
              response_time_sla_minutes = EXCLUDED.response_time_sla_minutes,
              updated_at = NOW()
      `, [category, min_temp, max_temp, humidity_min, humidity_max, response_time_sla_minutes]);
    } catch (_dbErr) {
      // Table may not exist yet — config is still held in memory
    }

    res.json({ message: 'Threshold configuration saved', config: thresholdConfig[category] });
  } catch (err) {
    console.error('Error configuring thresholds:', err);
    res.status(500).json({ error: 'Failed to save threshold configuration' });
  }
});

// ─── GET /api/alerts/thresholds — return current config ───────────────────────
router.get('/thresholds', authenticate, async (req, res) => {
  try {
    // Attempt to load from DB (merges with in-memory)
    try {
      const result = await pool.query('SELECT * FROM alert_thresholds ORDER BY category');
      for (const row of result.rows) {
        thresholdConfig[row.category] = {
          min_temp: row.min_temp,
          max_temp: row.max_temp,
          humidity_min: row.humidity_min,
          humidity_max: row.humidity_max,
          response_time_sla_minutes: row.response_time_sla_minutes,
          updated_at: row.updated_at,
        };
      }
    } catch (_) {
      // table may not exist
    }
    res.json({ thresholds: thresholdConfig });
  } catch (err) {
    console.error('Error fetching thresholds:', err);
    res.status(500).json({ error: 'Failed to fetch thresholds' });
  }
});

// ─── POST /api/webhooks/configure ─────────────────────────────────────────────
router.post('/webhook/configure', authenticate, async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url is required' });
    }

    const userId = req.user.id;
    try {
      await pool.query(`
        INSERT INTO webhook_configs (user_id, webhook_url, active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET webhook_url = EXCLUDED.webhook_url, active = true, updated_at = NOW()
      `, [userId, webhook_url]);
    } catch (_) {
      return res.status(500).json({ error: 'Failed to save webhook — ensure webhook_configs table exists' });
    }

    res.json({ message: 'Webhook configured successfully', webhook_url });
  } catch (err) {
    console.error('Error configuring webhook:', err);
    res.status(500).json({ error: 'Failed to configure webhook' });
  }
});

// ─── GET /api/alerts — all alerts ────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, severity } = req.query;
    let query = `
      SELECT
        tr.id,
        tr.sensor_id,
        tr.location,
        tr.zone,
        tr.product_type,
        tr.temperature,
        tr.min_threshold,
        tr.max_threshold,
        tr.status,
        tr.timestamp,
        CASE
          WHEN tr.temperature > tr.max_threshold + 5 OR tr.temperature < tr.min_threshold - 5 THEN 'critical'
          WHEN tr.temperature > tr.max_threshold + 2 OR tr.temperature < tr.min_threshold - 2 THEN 'high'
          WHEN tr.temperature > tr.max_threshold OR tr.temperature < tr.min_threshold THEN 'medium'
          ELSE 'low'
        END as severity,
        CASE
          WHEN tr.temperature > tr.max_threshold THEN ROUND((tr.temperature - tr.max_threshold)::numeric, 1)
          WHEN tr.temperature < tr.min_threshold THEN ROUND((tr.min_threshold - tr.temperature)::numeric, 1)
          ELSE 0
        END as deviation,
        COALESCE(a.acknowledged, false) as acknowledged,
        a.acknowledged_by,
        a.acknowledged_at,
        a.notes as alert_notes
      FROM temperature_readings tr
      LEFT JOIN alerts a ON a.reading_id = tr.id
      WHERE tr.status IN ('warning', 'critical', 'alert')
         OR tr.temperature > tr.max_threshold
         OR tr.temperature < tr.min_threshold
    `;
    const params = [];

    if (status === 'acknowledged') {
      query += ` AND COALESCE(a.acknowledged, false) = true`;
    } else if (status === 'active') {
      query += ` AND COALESCE(a.acknowledged, false) = false`;
    }

    if (severity) {
      query += ` AND (
        CASE
          WHEN tr.temperature > tr.max_threshold + 5 OR tr.temperature < tr.min_threshold - 5 THEN 'critical'
          WHEN tr.temperature > tr.max_threshold + 2 OR tr.temperature < tr.min_threshold - 2 THEN 'high'
          WHEN tr.temperature > tr.max_threshold OR tr.temperature < tr.min_threshold THEN 'medium'
          ELSE 'low'
        END
      ) = $${params.length + 1}`;
      params.push(severity);
    }

    query += ` ORDER BY tr.timestamp DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─── GET /api/alerts/stats ────────────────────────────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('warning', 'critical', 'alert') OR temperature > max_threshold OR temperature < min_threshold) as total_alerts,
        COUNT(*) FILTER (WHERE temperature > max_threshold + 5 OR temperature < min_threshold - 5) as critical_count,
        COUNT(*) FILTER (WHERE (temperature > max_threshold + 2 OR temperature < min_threshold - 2) AND NOT (temperature > max_threshold + 5 OR temperature < min_threshold - 5)) as high_count,
        COUNT(*) FILTER (WHERE (temperature > max_threshold OR temperature < min_threshold) AND NOT (temperature > max_threshold + 2 OR temperature < min_threshold - 2)) as medium_count
      FROM temperature_readings
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching alert stats:', err);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

// ─── POST /api/alerts/:id/acknowledge ────────────────────────────────────────
router.post('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.query(`
      INSERT INTO alerts (reading_id, acknowledged, acknowledged_by, acknowledged_at, notes)
      VALUES ($1, true, $2, NOW(), $3)
      ON CONFLICT (reading_id)
      DO UPDATE SET acknowledged = true, acknowledged_by = $2, acknowledged_at = NOW(), notes = $3
    `, [id, req.user.name || req.user.email, notes || '']);

    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ─── POST /api/alerts/:id/dismiss ────────────────────────────────────────────
router.post('/:id/dismiss', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM alerts WHERE reading_id = $1`, [id]);
    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    console.error('Error dismissing alert:', err);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

// Export thresholdConfig for use in temperature route
export { thresholdConfig };

export default router;
