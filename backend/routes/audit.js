import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// Get audit log entries
router.get('/', authenticate, async (req, res) => {
  try {
    const { entity, action, limit: queryLimit } = req.query;
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    let idx = 1;

    if (entity) {
      query += ` AND entity_type = $${idx++}`;
      params.push(entity);
    }
    if (action) {
      query += ` AND action = $${idx++}`;
      params.push(action);
    }

    query += ' ORDER BY created_at DESC';

    const recordLimit = Math.min(parseInt(queryLimit) || 100, 500);
    query += ` LIMIT $${idx++}`;
    params.push(recordLimit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get audit stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE action = 'create') as creates,
        COUNT(*) FILTER (WHERE action = 'update') as updates,
        COUNT(*) FILTER (WHERE action = 'delete') as deletes,
        COUNT(DISTINCT user_name) as active_users,
        COUNT(DISTINCT entity_type) as entity_types
      FROM audit_log
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching audit stats:', err);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

export default router;
