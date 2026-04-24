import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// Get all alerts (temperature readings that breached thresholds)
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

    query += ` ORDER BY tr.timestamp DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alert stats
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

// Acknowledge an alert
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

// Dismiss (unacknowledge) an alert
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

export default router;
