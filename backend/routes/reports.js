import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

// ─── GET /api/reports/compliance-summary ─────────────────────────────────────
router.get('/compliance-summary', authenticate, async (req, res) => {
  try {
    const [byCarrier, byCategory, byViolationType, trend] = await Promise.all([
      // Compliance rate per carrier (using carrier name from incidents/compliance_records join)
      pool.query(`
        SELECT
          COALESCE(c.name, 'Unknown Carrier') as carrier,
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE cr.status = 'compliant') as compliant_count,
          ROUND(
            COUNT(*) FILTER (WHERE cr.status = 'compliant') * 100.0 / NULLIF(COUNT(*), 0)
          , 1) as compliance_rate
        FROM compliance_records cr
        LEFT JOIN carriers c ON c.id = cr.carrier_id
        GROUP BY c.name
        ORDER BY compliance_rate DESC NULLS LAST
      `),

      // Compliance rate per product category
      pool.query(`
        SELECT
          COALESCE(category, 'Uncategorized') as category,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'compliant') as compliant,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'compliant') * 100.0 / NULLIF(COUNT(*), 0)
          , 1) as compliance_rate
        FROM compliance_records
        GROUP BY category
        ORDER BY compliance_rate DESC NULLS LAST
      `),

      // Violations by type
      pool.query(`
        SELECT
          incident_type as violation_type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'high') as high_count,
          COUNT(*) FILTER (WHERE severity = 'medium') as medium_count
        FROM incidents
        GROUP BY incident_type
        ORDER BY count DESC
      `),

      // 30-day compliance trend (daily)
      pool.query(`
        SELECT
          DATE_TRUNC('day', created_at)::date as date,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'compliant') as compliant,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'compliant') * 100.0 / NULLIF(COUNT(*), 0)
          , 1) as compliance_rate
        FROM compliance_records
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      complianceByCarrier: byCarrier.rows,
      complianceByCategory: byCategory.rows,
      violationsByType: byViolationType.rows,
      thirtyDayTrend: trend.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating compliance summary:', err);
    res.status(500).json({ error: 'Failed to generate compliance summary' });
  }
});

// ─── GET /api/reports/incident-summary ───────────────────────────────────────
router.get('/incident-summary', authenticate, async (req, res) => {
  try {
    const [totals, byType, resolutionTime] = await Promise.all([
      // Total incidents breakdown
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical,
          COUNT(*) FILTER (WHERE severity = 'high') as high,
          COUNT(*) FILTER (WHERE severity = 'medium') as medium,
          COUNT(*) FILTER (WHERE severity = 'low') as low
        FROM incidents
      `),

      // By type
      pool.query(`
        SELECT
          incident_type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
          COUNT(*) FILTER (WHERE status IN ('open','investigating')) as open_count
        FROM incidents
        GROUP BY incident_type
        ORDER BY count DESC
      `),

      // Average resolution time (hours) for resolved incidents
      pool.query(`
        SELECT
          incident_type,
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
            )::numeric
          , 1) as avg_resolution_hours,
          COUNT(*) as sample_size
        FROM incidents
        WHERE status = 'resolved'
          AND updated_at IS NOT NULL
        GROUP BY incident_type
        ORDER BY avg_resolution_hours ASC
      `),
    ]);

    res.json({
      totals: totals.rows[0],
      byType: byType.rows,
      resolutionTimeByType: resolutionTime.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating incident summary:', err);
    res.status(500).json({ error: 'Failed to generate incident summary' });
  }
});

// ─── GET /api/export/temperature-logs (CSV) ──────────────────────────────────
router.get('/export/temperature-logs', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, shipment_id } = req.query;
    const params = [];
    const conditions = [];

    if (start_date) {
      params.push(start_date);
      conditions.push(`timestamp >= $${params.length}`);
    }
    if (end_date) {
      params.push(end_date);
      conditions.push(`timestamp <= $${params.length}`);
    }
    if (shipment_id) {
      params.push(shipment_id);
      conditions.push(`sensor_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT sensor_id, location, zone, product_type, temperature, humidity,
              min_threshold, max_threshold, status, unit, timestamp
       FROM temperature_readings
       ${where}
       ORDER BY timestamp DESC`,
      params
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=temperature_logs.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    console.error('Error exporting temperature logs:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── GET /api/export/compliance-report (PDF) ─────────────────────────────────
router.get('/export/compliance-report', authenticate, async (req, res) => {
  try {
    const [summary, records] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'compliant') as compliant,
          COUNT(*) FILTER (WHERE status = 'non-compliant') as non_compliant,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'compliant') * 100.0 / NULLIF(COUNT(*), 0)
          , 1) as compliance_rate
        FROM compliance_records
      `),
      pool.query(`
        SELECT regulation, standard, category, facility, status, priority,
               last_audit, next_audit, findings, corrective_actions, auditor
        FROM compliance_records
        ORDER BY priority DESC, status
        LIMIT 100
      `),
    ]);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance_report.pdf');
    doc.pipe(res);

    // Title
    doc.fontSize(22).font('Helvetica-Bold').text('Cold Chain Compliance Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary section
    const s = summary.rows[0];
    doc.fontSize(16).font('Helvetica-Bold').text('Executive Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Records: ${s.total}`);
    doc.text(`Compliant: ${s.compliant}  |  Non-Compliant: ${s.non_compliant}  |  Pending: ${s.pending}`);
    doc.text(`Overall Compliance Rate: ${s.compliance_rate || 0}%`);
    doc.moveDown(1.5);

    // Records table
    doc.fontSize(16).font('Helvetica-Bold').text('Compliance Records');
    doc.moveDown(0.5);

    for (const rec of records.rows) {
      doc.fontSize(11).font('Helvetica-Bold').text(`${rec.regulation || 'N/A'} — ${rec.standard || 'N/A'}`);
      doc.fontSize(10).font('Helvetica')
        .text(`Facility: ${rec.facility || 'N/A'}   Category: ${rec.category || 'N/A'}   Status: ${rec.status || 'N/A'}   Priority: ${rec.priority || 'N/A'}`)
        .text(`Last Audit: ${rec.last_audit || 'N/A'}   Next Audit: ${rec.next_audit || 'N/A'}   Auditor: ${rec.auditor || 'N/A'}`);
      if (rec.findings) doc.text(`Findings: ${rec.findings}`);
      if (rec.corrective_actions) doc.text(`Corrective Actions: ${rec.corrective_actions}`);
      doc.moveDown(0.8);
    }

    doc.end();
  } catch (err) {
    console.error('Error generating compliance PDF:', err);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ─── Legacy export endpoints (kept for backward compat) ──────────────────────

router.get('/export/temperature', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, timestamp FROM temperature_readings ORDER BY timestamp DESC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=temperature_readings.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/spoilage', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status FROM spoilage_predictions ORDER BY created_at DESC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=spoilage_predictions.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/compliance', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor FROM compliance_records ORDER BY created_at DESC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance_records.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/carriers', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, status FROM carriers ORDER BY name');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=carriers.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/incidents', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to FROM incidents ORDER BY date DESC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=incidents.csv');
    res.send(toCsv(result.rows));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/summary', authenticate, async (req, res) => {
  try {
    const [temp, spoilage, compliance, carriers, incidents] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'normal') as normal,
          COUNT(*) FILTER (WHERE status = 'warning') as warning,
          COUNT(*) FILTER (WHERE status IN ('critical', 'alert')) as critical,
          ROUND(AVG(temperature)::numeric, 1) as avg_temp,
          ROUND(MIN(temperature)::numeric, 1) as min_temp,
          ROUND(MAX(temperature)::numeric, 1) as max_temp,
          COUNT(DISTINCT location) as locations,
          COUNT(DISTINCT zone) as zones
        FROM temperature_readings
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE risk_level = 'low') as low_risk,
          COUNT(*) FILTER (WHERE risk_level = 'medium') as medium_risk,
          COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk,
          COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_risk,
          COUNT(*) FILTER (WHERE status = 'expired') as expired
        FROM spoilage_predictions
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'compliant') as compliant,
          COUNT(*) FILTER (WHERE status = 'non-compliant') as non_compliant,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE priority = 'critical') as critical_priority
        FROM compliance_records
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          ROUND(AVG(score)::numeric, 1) as avg_score,
          ROUND(AVG(on_time_rate)::numeric, 1) as avg_on_time,
          ROUND(AVG(temp_compliance_rate)::numeric, 1) as avg_temp_compliance,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended
        FROM carriers
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_severity
        FROM incidents
      `),
    ]);

    res.json({
      temperature: temp.rows[0],
      spoilage: spoilage.rows[0],
      compliance: compliance.rows[0],
      carriers: carriers.rows[0],
      incidents: incidents.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating summary:', err);
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

export default router;
