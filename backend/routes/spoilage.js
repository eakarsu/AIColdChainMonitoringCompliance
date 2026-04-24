import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { analyzeSpoilage } from '../services/openrouter.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM spoilage_predictions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching spoilage predictions:', err);
    res.status(500).json({ error: 'Failed to fetch spoilage predictions' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM spoilage_predictions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching spoilage prediction:', err);
    res.status(500).json({ error: 'Failed to fetch spoilage prediction' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status, ai_analysis } = req.body;
    const result = await pool.query(
      `INSERT INTO spoilage_predictions (product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status, ai_analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level || 'medium', confidence, status || 'active', ai_analysis]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating spoilage prediction:', err);
    res.status(500).json({ error: 'Failed to create spoilage prediction' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status, ai_analysis } = req.body;
    const result = await pool.query(
      `UPDATE spoilage_predictions SET product_name=$1, batch_id=$2, product_type=$3, current_temp=$4, storage_temp=$5, quantity=$6, unit=$7, manufacture_date=$8, expiry_date=$9, predicted_spoilage_date=$10, risk_level=$11, confidence=$12, status=$13, ai_analysis=$14
       WHERE id=$15 RETURNING *`,
      [product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status, ai_analysis, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating spoilage prediction:', err);
    res.status(500).json({ error: 'Failed to update spoilage prediction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM spoilage_predictions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    res.json({ message: 'Spoilage prediction deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting spoilage prediction:', err);
    res.status(500).json({ error: 'Failed to delete spoilage prediction' });
  }
});

router.post('/:id/predict', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM spoilage_predictions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    const product = result.rows[0];
    const analysis = await analyzeSpoilage(product);
    await pool.query('UPDATE spoilage_predictions SET ai_analysis = $1 WHERE id = $2', [analysis, id]);
    res.json({ product, analysis });
  } catch (err) {
    console.error('Error predicting spoilage:', err);
    res.status(500).json({ error: 'Failed to predict spoilage' });
  }
});

export default router;
