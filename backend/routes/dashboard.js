import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/dashboard — main dashboard metrics
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [
      activeShipments,
      excursionsToday,
      complianceScore,
      criticalAlerts,
      expiringProducts,
    ] = await Promise.all([
      // Active shipments: temperature readings with a status other than archived/expired recorded today
      pool.query(`
        SELECT COUNT(DISTINCT sensor_id) as count
        FROM temperature_readings
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `),
      // Temperature excursions today: readings outside thresholds since midnight
      pool.query(`
        SELECT COUNT(*) as count
        FROM temperature_readings
        WHERE timestamp >= $1
          AND (temperature > max_threshold OR temperature < min_threshold)
      `, [startOfDay.toISOString()]),
      // Compliance score from compliance_records
      pool.query(`
        SELECT
          ROUND(
            COUNT(*) FILTER (WHERE status = 'compliant') * 100.0 / NULLIF(COUNT(*), 0)
          , 1) as score
        FROM compliance_records
      `),
      // Critical alerts: unacknowledged readings that are critical severity
      pool.query(`
        SELECT COUNT(*) as count
        FROM temperature_readings tr
        LEFT JOIN alerts a ON a.reading_id = tr.id
        WHERE (tr.temperature > tr.max_threshold + 5 OR tr.temperature < tr.min_threshold - 5)
          AND COALESCE(a.acknowledged, false) = false
      `),
      // Products expiring within 24 hours
      pool.query(`
        SELECT COUNT(*) as count
        FROM spoilage_predictions
        WHERE expiry_date IS NOT NULL
          AND expiry_date BETWEEN NOW() AND $1
          AND status != 'expired'
      `, [in24h.toISOString()]),
    ]);

    res.json({
      activeShipments: parseInt(activeShipments.rows[0].count) || 0,
      temperatureExcursionsToday: parseInt(excursionsToday.rows[0].count) || 0,
      complianceScore: parseFloat(complianceScore.rows[0].score) || 0,
      criticalAlerts: parseInt(criticalAlerts.rows[0].count) || 0,
      expiringProductsIn24h: parseInt(expiringProducts.rows[0].count) || 0,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Legacy /stats endpoint retained for backward compatibility
router.get('/stats', async (req, res) => {
  try {
    const [readings, alerts, compliance, carrierScore, incidents, spoilage] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM temperature_readings'),
      pool.query("SELECT COUNT(*) as total FROM temperature_readings WHERE status IN ('alert', 'critical', 'warning')"),
      pool.query("SELECT COUNT(*) FILTER (WHERE status = 'compliant') as compliant, COUNT(*) as total FROM compliance_records"),
      pool.query('SELECT COALESCE(AVG(score), 0) as avg_score FROM carriers'),
      pool.query("SELECT COUNT(*) as total FROM incidents WHERE status IN ('open', 'investigating')"),
      pool.query('SELECT COUNT(*) as total FROM spoilage_predictions'),
    ]);

    const totalCompliance = parseInt(compliance.rows[0].total) || 1;
    const compliantCount = parseInt(compliance.rows[0].compliant) || 0;
    const complianceRate = Math.round((compliantCount / totalCompliance) * 100);

    res.json({
      totalReadings: parseInt(readings.rows[0].total),
      activeAlerts: parseInt(alerts.rows[0].total),
      complianceRate,
      avgCarrierScore: parseFloat(parseFloat(carrierScore.rows[0].avg_score).toFixed(1)),
      openIncidents: parseInt(incidents.rows[0].total),
      spoilagePredictions: parseInt(spoilage.rows[0].total),
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
