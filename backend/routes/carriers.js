import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { scoreCarrier } from '../services/openrouter.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    const conditions = [];
    const params = [];
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR code ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM carriers ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM carriers ${where}`, params),
    ]);
    const total = count.rows[0].total;

    res.json({
      data: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Error fetching carriers:', err);
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch carrier' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO carriers (name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count || 0, total_shipments || 0, routes, fleet_size, certification, insurance_rating, last_review, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create carrier' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update carrier' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM carriers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    res.json({ message: 'Carrier deleted', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete carrier' });
  }
});

router.post('/:id/score', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    const carrier = result.rows[0];
    const aiRes = await scoreCarrier(carrier);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    await pool.query(
      'UPDATE carriers SET ai_results = $1, score = COALESCE($2, score) WHERE id = $3',
      [aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, aiRes.parsed?.overall_score || null, id]
    );
    res.json({ carrier, analysis: aiRes.content, parsed: aiRes.parsed, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error scoring carrier:', err);
    res.status(500).json({ error: 'Failed to score carrier' });
  }
});

// NEW: Carrier Performance Dashboard - aggregated KPIs for a carrier
router.get('/:id/performance', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const carrier = await pool.query('SELECT * FROM carriers WHERE id = $1', [id]);
    if (!carrier.rows.length) return res.status(404).json({ error: 'Carrier not found' });

    const incidentsResult = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
              COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
              COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
       FROM incidents
       WHERE assigned_to ILIKE $1 OR location ILIKE $1`,
      [`%${carrier.rows[0].name}%`]
    ).catch(() => ({ rows: [{ total: 0, critical: 0, high: 0, resolved: 0 }] }));

    res.json({
      carrier: carrier.rows[0],
      incidents: incidentsResult.rows[0],
      kpis: {
        on_time_rate: carrier.rows[0].on_time_rate,
        temp_compliance_rate: carrier.rows[0].temp_compliance_rate,
        score: carrier.rows[0].score,
        total_shipments: carrier.rows[0].total_shipments,
        incident_rate: carrier.rows[0].total_shipments > 0
          ? ((carrier.rows[0].incident_count || 0) / carrier.rows[0].total_shipments * 100).toFixed(2)
          : null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching carrier performance:', err);
    res.status(500).json({ error: 'Failed to fetch carrier performance' });
  }
});

export default router;
