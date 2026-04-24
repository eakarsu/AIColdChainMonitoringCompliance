import { Router } from 'express';
import pool from '../db.js';

const router = Router();

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
