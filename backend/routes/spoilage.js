import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { analyzeSpoilage, calculateSpoilageCost } from '../services/openrouter.js';

const router = Router();

// Paginated list with optional filters
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { risk_level, status, search } = req.query;

    const conditions = [];
    const params = [];
    if (risk_level) { conditions.push(`risk_level = $${params.length + 1}`); params.push(risk_level); }
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (search) {
      conditions.push(`(product_name ILIKE $${params.length + 1} OR batch_id ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM spoilage_predictions ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM spoilage_predictions ${where}`, params),
    ]);
    const total = count.rows[0].total;

    res.json({
      data: data.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching spoilage predictions:', err);
    res.status(500).json({ error: 'Failed to fetch spoilage predictions' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM spoilage_predictions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spoilage prediction' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status, ai_analysis } = req.body;
    if (!product_name) return res.status(400).json({ error: 'product_name is required' });
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

router.put('/:id', authenticate, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update spoilage prediction' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM spoilage_predictions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    res.json({ message: 'Spoilage prediction deleted', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete spoilage prediction' });
  }
});

// AI predict (rate-limited)
router.post('/:id/predict', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM spoilage_predictions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    const product = result.rows[0];
    const aiRes = await analyzeSpoilage(product);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    await pool.query(
      'UPDATE spoilage_predictions SET ai_analysis = $1, ai_results = $2, risk_level = COALESCE($3, risk_level) WHERE id = $4',
      [aiRes.content, aiRes.parsed ? JSON.stringify(aiRes.parsed) : null, aiRes.parsed?.risk_level?.toLowerCase() || null, id]
    );
    res.json({ product, analysis: aiRes.content, parsed: aiRes.parsed, parseStrategy: aiRes.parseStrategy });
  } catch (err) {
    console.error('Error predicting spoilage:', err);
    res.status(500).json({ error: 'Failed to predict spoilage' });
  }
});

// NEW: Spoilage Cost Calculator (rate-limited)
router.post('/:id/cost', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM spoilage_predictions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spoilage prediction not found' });
    }
    const product = result.rows[0];
    const costRes = await calculateSpoilageCost(product);
    if (!costRes.success) return res.status(502).json({ error: costRes.error });

    await pool.query(
      'UPDATE spoilage_predictions SET cost_analysis = $1, estimated_loss_usd = $2 WHERE id = $3',
      [costRes.parsed ? JSON.stringify(costRes.parsed) : null, costRes.parsed?.estimated_loss_usd || null, id]
    );
    res.json({ product, cost: costRes.parsed, raw: costRes.content });
  } catch (err) {
    console.error('Error calculating spoilage cost:', err);
    res.status(500).json({ error: 'Failed to calculate spoilage cost' });
  }
});

export default router;
