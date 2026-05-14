import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { analyzeIncident } from '../services/openrouter.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, severity, search } = req.query;

    const conditions = [];
    const params = [];
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (severity) { conditions.push(`severity = $${params.length + 1}`); params.push(severity); }
    if (search) {
      conditions.push(`(title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM incidents ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM incidents ${where}`, params),
    ]);
    const total = count.rows[0].total;

    res.json({
      data: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const result = await pool.query(
      `INSERT INTO incidents (title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [title, incident_type, severity, date || new Date(), location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status || 'open', reported_by, assigned_to, resolution_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM incidents WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json({ message: 'Incident deleted', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

router.post('/:id/analyze', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    const incident = result.rows[0];
    const aiRes = await analyzeIncident(incident);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    const root = aiRes.parsed?.root_cause || null;
    await pool.query(
      'UPDATE incidents SET ai_results = $1, root_cause = COALESCE($2, root_cause) WHERE id = $3',
      [aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, root, id]
    );
    res.json({ incident, analysis: aiRes.content, parsed: aiRes.parsed, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error analyzing incident:', err);
    res.status(500).json({ error: 'Failed to analyze incident' });
  }
});

export default router;
