import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { analyzeTemperature } from '../services/openrouter.js';

const router = Router();

// GET all readings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM temperature_readings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching temperature readings:', err);
    res.status(500).json({ error: 'Failed to fetch temperature readings' });
  }
});

// GET single reading
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

// POST create reading
router.post('/', async (req, res) => {
  try {
    const { sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp } = req.body;
    const result = await pool.query(
      `INSERT INTO temperature_readings (sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status || 'normal', unit || 'C', timestamp || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating temperature reading:', err);
    res.status(500).json({ error: 'Failed to create temperature reading' });
  }
});

// PUT update reading
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

// DELETE reading
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

// POST AI analysis
router.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM temperature_readings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Temperature reading not found' });
    }
    const reading = result.rows[0];
    const analysis = await analyzeTemperature(reading);
    res.json({ reading, analysis });
  } catch (err) {
    console.error('Error analyzing temperature reading:', err);
    res.status(500).json({ error: 'Failed to analyze temperature reading' });
  }
});

export default router;
