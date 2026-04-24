import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import { analyzeIncident } from '../services/openrouter.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching incident:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date } = req.body;
    const result = await pool.query(
      `INSERT INTO incidents (title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [title, incident_type, severity, date || new Date(), location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status || 'open', reported_by, assigned_to, resolution_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating incident:', err);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date } = req.body;
    const result = await pool.query(
      `UPDATE incidents SET title=$1, incident_type=$2, severity=$3, date=$4, location=$5, facility=$6, product_affected=$7, temperature_recorded=$8, description=$9, root_cause=$10, corrective_action=$11, status=$12, reported_by=$13, assigned_to=$14, resolution_date=$15
       WHERE id=$16 RETURNING *`,
      [title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating incident:', err);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM incidents WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json({ message: 'Incident deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting incident:', err);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    const incident = result.rows[0];
    const analysis = await analyzeIncident(incident);
    res.json({ incident, analysis });
  } catch (err) {
    console.error('Error analyzing incident:', err);
    res.status(500).json({ error: 'Failed to analyze incident' });
  }
});

export default router;
