import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { assessCompliance } from '../services/openrouter.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compliance_records ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching compliance records:', err);
    res.status(500).json({ error: 'Failed to fetch compliance records' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching compliance record:', err);
    res.status(500).json({ error: 'Failed to fetch compliance record' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO compliance_records (regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [regulation, standard, category, facility, status || 'pending', priority || 'medium', last_audit, next_audit, findings, corrective_actions, auditor, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating compliance record:', err);
    res.status(500).json({ error: 'Failed to create compliance record' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes } = req.body;
    const result = await pool.query(
      `UPDATE compliance_records SET regulation=$1, standard=$2, category=$3, facility=$4, status=$5, priority=$6, last_audit=$7, next_audit=$8, findings=$9, corrective_actions=$10, auditor=$11, notes=$12
       WHERE id=$13 RETURNING *`,
      [regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating compliance record:', err);
    res.status(500).json({ error: 'Failed to update compliance record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM compliance_records WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json({ message: 'Compliance record deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting compliance record:', err);
    res.status(500).json({ error: 'Failed to delete compliance record' });
  }
});

router.post('/:id/assess', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    const record = result.rows[0];
    const analysis = await assessCompliance(record);
    res.json({ record, analysis });
  } catch (err) {
    console.error('Error assessing compliance:', err);
    res.status(500).json({ error: 'Failed to assess compliance' });
  }
});

export default router;
