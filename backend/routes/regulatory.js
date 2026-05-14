// NEW: Regulatory Change Alerts
// Tracks FDA / HACCP / FSMA updates with AI-driven impact assessment.

import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { assessRegulatoryChange } from '../services/openrouter.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { source, status, impact_level } = req.query;

    const conditions = [];
    const params = [];
    if (source) { conditions.push(`source = $${params.length + 1}`); params.push(source); }
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (impact_level) { conditions.push(`impact_level = $${params.length + 1}`); params.push(impact_level); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM regulatory_changes ${where} ORDER BY effective_date DESC NULLS LAST, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM regulatory_changes ${where}`, params),
    ]);

    res.json({
      data: data.rows,
      pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch regulatory changes' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM regulatory_changes WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Regulatory change not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch regulatory change' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { source, reference_code, title, description, effective_date, affected_categories, impact_level, status } = req.body;
    if (!source) return res.status(400).json({ error: 'source is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    const result = await pool.query(
      `INSERT INTO regulatory_changes (source, reference_code, title, description, effective_date, affected_categories, impact_level, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [source, reference_code, title, description, effective_date, JSON.stringify(affected_categories || []), impact_level, status || 'new']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating regulatory change:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { source, reference_code, title, description, effective_date, affected_categories, impact_level, status } = req.body;
    const result = await pool.query(
      `UPDATE regulatory_changes SET source=COALESCE($1,source), reference_code=COALESCE($2,reference_code), title=COALESCE($3,title), description=COALESCE($4,description), effective_date=COALESCE($5,effective_date), affected_categories=COALESCE($6,affected_categories), impact_level=COALESCE($7,impact_level), status=COALESCE($8,status), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [source, reference_code, title, description, effective_date, affected_categories ? JSON.stringify(affected_categories) : null, impact_level, status, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Regulatory change not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update regulatory change' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM regulatory_changes WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Regulatory change not found' });
    res.json({ message: 'Regulatory change deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete regulatory change' });
  }
});

// AI assess impact (rate-limited)
router.post('/:id/assess', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM regulatory_changes WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Regulatory change not found' });
    const change = result.rows[0];
    const aiRes = await assessRegulatoryChange(change);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    await pool.query(
      'UPDATE regulatory_changes SET ai_results = $1, impact_level = COALESCE($2, impact_level) WHERE id = $3',
      [aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, aiRes.parsed?.impact_level || null, req.params.id]
    );

    res.json({ change, parsed: aiRes.parsed, raw: aiRes.content, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error assessing regulatory change:', err);
    res.status(500).json({ error: 'Failed to assess regulatory change' });
  }
});

// Acknowledge a regulatory change
router.post('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE regulatory_changes SET status='acknowledged', acknowledged_by=$1, acknowledged_at=NOW(), updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Regulatory change not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge change' });
  }
});

export default router;
