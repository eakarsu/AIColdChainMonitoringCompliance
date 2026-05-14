import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { assessCompliance } from '../services/openrouter.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, priority, category, search } = req.query;

    const conditions = [];
    const params = [];
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (priority) { conditions.push(`priority = $${params.length + 1}`); params.push(priority); }
    if (category) { conditions.push(`category = $${params.length + 1}`); params.push(category); }
    if (search) {
      conditions.push(`(regulation ILIKE $${params.length + 1} OR standard ILIKE $${params.length + 1} OR facility ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM compliance_records ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM compliance_records ${where}`, params),
    ]);
    const total = count.rows[0].total;

    res.json({
      data: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Error fetching compliance records:', err);
    res.status(500).json({ error: 'Failed to fetch compliance records' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch compliance record' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes } = req.body;
    if (!regulation) return res.status(400).json({ error: 'regulation is required' });
    const result = await pool.query(
      `INSERT INTO compliance_records (regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [regulation, standard, category, facility, status || 'pending', priority || 'medium', last_audit, next_audit, findings, corrective_actions, auditor, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create compliance record' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update compliance record' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM compliance_records WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json({ message: 'Compliance record deleted', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete compliance record' });
  }
});

// AI assess (rate-limited, persists ai_results)
router.post('/:id/assess', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    const record = result.rows[0];
    const aiRes = await assessCompliance(record);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    const newStatus = aiRes.parsed?.compliance_status?.toLowerCase().replace(/[\s-]/g, '_');
    const validStatuses = ['compliant', 'non_compliant', 'needs_review'];

    await pool.query(
      'UPDATE compliance_records SET ai_results = $1, status = COALESCE($2, status) WHERE id = $3',
      [aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, validStatuses.includes(newStatus) ? newStatus.replace('_', '-') : null, id]
    );
    res.json({ record, analysis: aiRes.content, parsed: aiRes.parsed, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error assessing compliance:', err);
    res.status(500).json({ error: 'Failed to assess compliance' });
  }
});

export default router;
