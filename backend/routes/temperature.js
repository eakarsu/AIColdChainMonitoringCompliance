import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { analyzeTemperature } from '../services/openrouter.js';
import { thresholdConfig, fireCriticalWebhooks } from './alerts.js';

const router = Router();

// ─── Threshold check helper ───────────────────────────────────────────────────
async function checkThresholdsAndAlert(reading) {
  const cfg = thresholdConfig[reading.product_type] || thresholdConfig['default'];
  if (!cfg) return;

  const temp = parseFloat(reading.temperature);
  const humidity = parseFloat(reading.humidity);
  const minTemp = cfg.min_temp ?? reading.min_threshold;
  const maxTemp = cfg.max_temp ?? reading.max_threshold;

  const tempExceeded = (minTemp != null && temp < minTemp) || (maxTemp != null && temp > maxTemp);
  const humidityExceeded =
    (cfg.humidity_min != null && humidity < cfg.humidity_min) ||
    (cfg.humidity_max != null && humidity > cfg.humidity_max);

  if (tempExceeded || humidityExceeded) {
    const deviation = maxTemp != null && temp > maxTemp
      ? temp - maxTemp
      : minTemp != null && temp < minTemp
        ? minTemp - temp
        : 0;

    const severity = deviation > 5 ? 'critical' : deviation > 2 ? 'high' : 'medium';

    const alertData = {
      reading_id: reading.id,
      sensor_id: reading.sensor_id,
      location: reading.location,
      product_type: reading.product_type,
      temperature: temp,
      humidity,
      severity,
      deviation: Math.round(deviation * 10) / 10,
      triggered_at: new Date().toISOString(),
    };

    if (severity === 'critical') {
      fireCriticalWebhooks(alertData);
    }

    // Insert alert record if critical or high
    if (severity === 'critical' || severity === 'high') {
      try {
        await pool.query(`
          INSERT INTO alerts (reading_id, acknowledged, acknowledged_by, acknowledged_at, notes)
          VALUES ($1, false, NULL, NULL, $2)
          ON CONFLICT (reading_id) DO NOTHING
        `, [reading.id, `Auto-generated: ${severity} threshold breach`]);
      } catch (_) {
        // alerts table may differ — ignore insert errors
      }
    }
  }
}

// ─── GET /api/temperature — with filtering and pagination ────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      shipment_id,
      start_date,
      end_date,
      min_temp,
      max_temp,
      page = 1,
      limit = 50,
    } = req.query;

    const params = [];
    const conditions = [];

    if (shipment_id) {
      params.push(shipment_id);
      conditions.push(`sensor_id = $${params.length}`);
    }
    if (start_date) {
      params.push(start_date);
      conditions.push(`timestamp >= $${params.length}`);
    }
    if (end_date) {
      params.push(end_date);
      conditions.push(`timestamp <= $${params.length}`);
    }
    if (min_temp !== undefined) {
      params.push(parseFloat(min_temp));
      conditions.push(`temperature >= $${params.length}`);
    }
    if (max_temp !== undefined) {
      params.push(parseFloat(max_temp));
      conditions.push(`temperature <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum);
    params.push(offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM temperature_readings ${where} ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM temperature_readings ${where}`,
        params.slice(0, params.length - 2)
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);
    res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Error fetching temperature readings:', err);
    res.status(500).json({ error: 'Failed to fetch temperature readings' });
  }
});

// ─── GET /api/temperature/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM temperature_readings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Temperature reading not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching temperature reading:', err);
    res.status(500).json({ error: 'Failed to fetch temperature reading' });
  }
});

// ─── POST /api/temperature — create single reading ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp } = req.body;

    if (temperature === undefined || temperature === null) {
      return res.status(400).json({ error: 'temperature is required' });
    }
    if (!sensor_id) {
      return res.status(400).json({ error: 'sensor_id is required' });
    }

    const result = await pool.query(
      `INSERT INTO temperature_readings (sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status || 'normal', unit || 'C', timestamp || new Date()]
    );

    const reading = result.rows[0];
    await checkThresholdsAndAlert(reading);

    res.status(201).json(reading);
  } catch (err) {
    console.error('Error creating temperature reading:', err);
    res.status(500).json({ error: 'Failed to create temperature reading' });
  }
});

// ─── POST /api/temperature/bulk — bulk import (max 1000 readings) ─────────────
router.post('/bulk', async (req, res) => {
  try {
    const { readings } = req.body;

    if (!Array.isArray(readings)) {
      return res.status(400).json({ error: 'readings must be an array' });
    }
    if (readings.length === 0) {
      return res.status(400).json({ error: 'readings array is empty' });
    }
    if (readings.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 readings per bulk import' });
    }

    // Validate each reading
    const errors = [];
    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      if (r.temperature === undefined || r.temperature === null) {
        errors.push(`readings[${i}]: temperature is required`);
      }
      if (!r.sensor_id) {
        errors.push(`readings[${i}]: sensor_id is required`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const client = await pool.connect();
    const inserted = [];

    try {
      await client.query('BEGIN');

      for (const r of readings) {
        const result = await client.query(
          `INSERT INTO temperature_readings
             (sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            r.sensor_id,
            r.location || null,
            r.zone || null,
            r.product_type || null,
            r.temperature,
            r.humidity || null,
            r.min_threshold || null,
            r.max_threshold || null,
            r.status || 'normal',
            r.unit || 'C',
            r.timestamp || new Date(),
          ]
        );
        inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Run threshold checks asynchronously to avoid blocking the response
    setImmediate(async () => {
      for (const reading of inserted) {
        await checkThresholdsAndAlert(reading);
      }
    });

    res.status(201).json({
      message: `Successfully imported ${inserted.length} readings`,
      count: inserted.length,
      readings: inserted,
    });
  } catch (err) {
    console.error('Error bulk importing temperature readings:', err);
    res.status(500).json({ error: 'Failed to bulk import temperature readings' });
  }
});

// ─── PUT /api/temperature/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp } = req.body;
    const result = await pool.query(
      `UPDATE temperature_readings SET sensor_id=$1, location=$2, zone=$3, product_type=$4, temperature=$5, humidity=$6, min_threshold=$7, max_threshold=$8, status=$9, unit=$10, timestamp=$11
       WHERE id=$12 RETURNING *`,
      [sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Temperature reading not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating temperature reading:', err);
    res.status(500).json({ error: 'Failed to update temperature reading' });
  }
});

// ─── DELETE /api/temperature/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM temperature_readings WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Temperature reading not found' });
    }
    res.json({ message: 'Temperature reading deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting temperature reading:', err);
    res.status(500).json({ error: 'Failed to delete temperature reading' });
  }
});

// ─── POST /api/temperature/:id/analyze (AI, rate-limited) ────────────────────
router.post('/:id/analyze', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM temperature_readings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Temperature reading not found' });
    }
    const reading = result.rows[0];
    const aiRes = await analyzeTemperature(reading);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    await pool.query(
      'UPDATE temperature_readings SET ai_results = $1 WHERE id = $2',
      [aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, id]
    );
    res.json({ reading, analysis: aiRes.content, parsed: aiRes.parsed, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error analyzing temperature reading:', err);
    res.status(500).json({ error: 'Failed to analyze temperature reading' });
  }
});

export default router;
