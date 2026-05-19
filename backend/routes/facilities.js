// NEW: Multi-Facility Aggregation
// Provides parent-company view, facility CRUD, and aggregated benchmarks.

import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';
import { analyzeMultiFacility } from '../services/openrouter.js';

const router = Router();

// List facilities (paginated)
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { region, parent_company, search } = req.query;

    const conditions = ['active = true'];
    const params = [];
    if (region) { conditions.push(`region = $${params.length + 1}`); params.push(region); }
    if (parent_company) { conditions.push(`parent_company = $${params.length + 1}`); params.push(parent_company); }
    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR code ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      pool.query(`SELECT * FROM facilities ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM facilities ${where}`, params),
    ]);

    res.json({
      data: data.rows,
      pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) },
    });
  } catch (err) {
    console.error('Error fetching facilities:', err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, parent_company, region, address, contact_email, contact_phone, facility_type, capacity_units } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO facilities (name, code, parent_company, region, address, contact_email, contact_phone, facility_type, capacity_units)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, code, parent_company, region, address, contact_email, contact_phone, facility_type, capacity_units]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating facility:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, parent_company, region, address, contact_email, contact_phone, facility_type, capacity_units, active } = req.body;
    const result = await pool.query(
      `UPDATE facilities SET name=COALESCE($1,name), code=COALESCE($2,code), parent_company=COALESCE($3,parent_company), region=COALESCE($4,region), address=COALESCE($5,address), contact_email=COALESCE($6,contact_email), contact_phone=COALESCE($7,contact_phone), facility_type=COALESCE($8,facility_type), capacity_units=COALESCE($9,capacity_units), active=COALESCE($10,active), updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, code, parent_company, region, address, contact_email, contact_phone, facility_type, capacity_units, active, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Facility not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('UPDATE facilities SET active=false WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Facility not found' });
    res.json({ message: 'Facility deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete facility' });
  }
});

// Aggregated rollup dashboard across all facilities
router.get('/rollup', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.id,
        f.name,
        f.code,
        f.region,
        f.parent_company,
        COALESCE(temp_stats.total_readings, 0)::int AS total_readings,
        COALESCE(temp_stats.alert_count, 0)::int AS alert_count,
        COALESCE(temp_stats.avg_temp, NULL) AS avg_temp,
        COALESCE(incident_stats.total_incidents, 0)::int AS total_incidents,
        COALESCE(incident_stats.critical_incidents, 0)::int AS critical_incidents
      FROM facilities f
      LEFT JOIN (
        SELECT facility_id,
          COUNT(*) AS total_readings,
          COUNT(*) FILTER (WHERE status IN ('warning','critical','alert')) AS alert_count,
          ROUND(AVG(temperature)::numeric, 2) AS avg_temp
        FROM temperature_readings
        GROUP BY facility_id
      ) temp_stats ON temp_stats.facility_id = f.id
      LEFT JOIN (
        SELECT facility_id,
          COUNT(*) AS total_incidents,
          COUNT(*) FILTER (WHERE severity = 'critical') AS critical_incidents
        FROM incidents
        GROUP BY facility_id
      ) incident_stats ON incident_stats.facility_id = f.id
      WHERE f.active = true
      ORDER BY f.name
    `);
    res.json({
      facilities: result.rows,
      total: result.rows.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching rollup:', err);
    res.status(500).json({ error: 'Failed to fetch rollup' });
  }
});

// AI-powered multi-facility insights (rate-limited)
router.post('/insights', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const rollup = await pool.query(`
      SELECT
        f.id, f.name, f.region, f.parent_company,
        COALESCE(temp_stats.total_readings, 0)::int AS total_readings,
        COALESCE(temp_stats.alert_count, 0)::int AS alert_count,
        COALESCE(incident_stats.total_incidents, 0)::int AS total_incidents,
        COALESCE(incident_stats.critical_incidents, 0)::int AS critical_incidents
      FROM facilities f
      LEFT JOIN (SELECT facility_id, COUNT(*) AS total_readings, COUNT(*) FILTER (WHERE status IN ('warning','critical','alert')) AS alert_count FROM temperature_readings GROUP BY facility_id) temp_stats ON temp_stats.facility_id = f.id
      LEFT JOIN (SELECT facility_id, COUNT(*) AS total_incidents, COUNT(*) FILTER (WHERE severity='critical') AS critical_incidents FROM incidents GROUP BY facility_id) incident_stats ON incident_stats.facility_id = f.id
      WHERE f.active = true
    `);

    const aiRes = await analyzeMultiFacility(rollup.rows);
    if (!aiRes.success) return res.status(502).json({ error: aiRes.error });

    res.json({
      summary: aiRes.parsed,
      raw: aiRes.content,
      parseStrategy: aiRes.parseStrategy,
      facilityCount: rollup.rows.length,
    });
  } catch (err) {
    console.error('Error generating multi-facility insights:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
