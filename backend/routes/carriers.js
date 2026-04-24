import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { scoreCarrier } from '../services/openrouter.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carriers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching carriers:', err);
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching carrier:', err);
    res.status(500).json({ error: 'Failed to fetch carrier' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status } = req.body;
    const result = await pool.query(
      `INSERT INTO carriers (name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count || 0, total_shipments || 0, routes, fleet_size, certification, insurance_rating, last_review, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating carrier:', err);
    res.status(500).json({ error: 'Failed to create carrier' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status } = req.body;
    const result = await pool.query(
      `UPDATE carriers SET name=$1, code=$2, contact_email=$3, phone=$4, score=$5, on_time_rate=$6, temp_compliance_rate=$7, incident_count=$8, total_shipments=$9, routes=$10, fleet_size=$11, certification=$12, insurance_rating=$13, last_review=$14, status=$15
       WHERE id=$16 RETURNING *`,
      [name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating carrier:', err);
    res.status(500).json({ error: 'Failed to update carrier' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM carriers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    res.json({ message: 'Carrier deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting carrier:', err);
    res.status(500).json({ error: 'Failed to delete carrier' });
  }
});

router.post('/:id/score', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    const carrier = result.rows[0];
    const analysis = await scoreCarrier(carrier);
    res.json({ carrier, analysis });
  } catch (err) {
    console.error('Error scoring carrier:', err);
    res.status(500).json({ error: 'Failed to score carrier' });
  }
});

export default router;
