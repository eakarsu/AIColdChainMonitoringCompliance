// customViews.js — 4 synthesized cold-chain endpoints (2 viz + 2 non-viz)
// VIZ: shipment temperature trend chart + shipment x time breach heatmap
// NON-VIZ: compliance report PDF + temperature threshold rules editor (CRUD per product type)
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import authenticate from '../middleware/auth.js';

const router = Router();

// Deterministic pseudo-random helper
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// --------- VIZ #1: Shipment temperature trend chart per shipment (with threshold lines) ---------
router.get('/shipment-timeline', authenticate, async (req, res) => {
  try {
    const shipments = ['SHP-1001', 'SHP-1042', 'SHP-1107', 'SHP-1188', 'SHP-1221'];
    const products = ['mRNA Vaccine', 'Insulin', 'Salmon Fillet', 'Frozen Berries', 'Blood Plasma'];
    const ranges = [[2, 8], [2, 8], [-2, 4], [-22, -18], [1, 6]];
    const out = shipments.map((sid, i) => {
      const rng = seeded(1000 + i * 17);
      const points = [];
      const [lo, hi] = ranges[i];
      const span = hi - lo;
      for (let h = 0; h < 24; h++) {
        const drift = (rng() - 0.5) * span * 0.6;
        const excursion = (h > 8 && h < 13 && i % 2 === 0) ? span * 0.9 * rng() : 0;
        const t = +(lo + span * 0.45 + drift + excursion).toFixed(2);
        points.push({ hour: h, tempC: t, inRange: t >= lo && t <= hi });
      }
      const breaches = points.filter((p) => !p.inRange).length;
      return {
        shipmentId: sid,
        product: products[i],
        rangeLowC: lo,
        rangeHighC: hi,
        breaches,
        excursionRiskPct: Math.min(100, breaches * 12),
        timeline: points,
      };
    });
    res.json({ shipments: out, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --------- VIZ #2: Breach heatmap (shipment x time) ---------
router.get('/breach-heatmap', authenticate, async (req, res) => {
  try {
    const shipments = [
      { id: 'SHP-1001', product: 'mRNA Vaccine', rangeLowC: 2, rangeHighC: 8 },
      { id: 'SHP-1042', product: 'Insulin', rangeLowC: 2, rangeHighC: 8 },
      { id: 'SHP-1107', product: 'Salmon Fillet', rangeLowC: -2, rangeHighC: 4 },
      { id: 'SHP-1188', product: 'Frozen Berries', rangeLowC: -22, rangeHighC: -18 },
      { id: 'SHP-1221', product: 'Blood Plasma', rangeLowC: 1, rangeHighC: 6 },
      { id: 'SHP-1256', product: 'Whole Blood', rangeLowC: 1, rangeHighC: 6 },
      { id: 'SHP-1303', product: 'Ice Cream', rangeLowC: -25, rangeHighC: -18 },
      { id: 'SHP-1377', product: 'Fresh Berries', rangeLowC: 0, rangeHighC: 4 },
    ];
    const hours = 24;
    const rng = seeded(424242);
    const cells = shipments.map((s, si) => {
      const row = [];
      for (let h = 0; h < hours; h++) {
        // simulate severity 0..3 (0=ok, 1=warn, 2=breach, 3=critical)
        const r = rng();
        let severity = 0;
        if (h >= 7 && h <= 13 && si % 2 === 0) {
          severity = r < 0.15 ? 3 : r < 0.45 ? 2 : r < 0.75 ? 1 : 0;
        } else if (h >= 16 && h <= 19) {
          severity = r < 0.08 ? 2 : r < 0.30 ? 1 : 0;
        } else {
          severity = r < 0.04 ? 1 : 0;
        }
        row.push({ hour: h, severity });
      }
      const total = row.reduce((acc, c) => acc + c.severity, 0);
      const breachCount = row.filter((c) => c.severity >= 2).length;
      return { shipmentId: s.id, product: s.product, rangeLowC: s.rangeLowC, rangeHighC: s.rangeHighC, cells: row, breachCount, severityScore: total };
    });
    res.json({
      shipments: cells,
      hours,
      legend: [
        { severity: 0, label: 'In Range', color: '#dcfce7' },
        { severity: 1, label: 'Warning', color: '#fef3c7' },
        { severity: 2, label: 'Breach', color: '#fecaca' },
        { severity: 3, label: 'Critical', color: '#dc2626' },
      ],
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --------- NON-VIZ #1: Compliance report PDF ---------
router.get('/fda-report.pdf', authenticate, async (req, res) => {
  try {
    const facility = req.query.facility || 'Chicago Cold Vault #1';
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="compliance_${Date.now()}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).fillColor('#0b3d91').text('Cold Chain Compliance Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444').text('21 CFR Part 11 / FSMA Sanitary Transportation Rule / EU GDP Annex 9', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).fillColor('#000');
    doc.text(`Facility: ${facility}`);
    doc.text(`Report Date: ${new Date().toUTCString()}`);
    doc.text(`Report ID: CMP-${Date.now().toString(36).toUpperCase()}`);
    doc.text(`Inspector: Admin User`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#0b3d91').text('1. Executive Summary');
    doc.fontSize(10).fillColor('#000').text(
      'This report documents 30-day cold-chain compliance for the named facility under 21 CFR §1.908 (FSMA) and GDP Annex 9. ' +
      'Continuous temperature monitoring is in place across 12 calibrated sensors. Three (3) excursion events were logged ' +
      'and remediated within the documented CAPA window.'
    );
    doc.moveDown();

    doc.fontSize(13).fillColor('#0b3d91').text('2. Temperature Control Summary');
    doc.fontSize(10).fillColor('#000');
    const rows = [
      ['Zone 1 (2-8°C)', '99.4%', '2', 'Pass'],
      ['Zone 2 (-20°C)', '99.9%', '0', 'Pass'],
      ['Zone 3 (Ambient)', '100.0%', '0', 'Pass'],
      ['Loading Dock', '97.1%', '1', 'CAPA'],
    ];
    doc.font('Helvetica-Bold').text('Zone                Uptime    Excursions   Status');
    doc.font('Helvetica');
    rows.forEach((r) => doc.text(`${r[0].padEnd(20)}${r[1].padEnd(10)}${r[2].padEnd(13)}${r[3]}`));
    doc.moveDown();

    doc.fontSize(13).fillColor('#0b3d91').text('3. Findings & CAPA');
    doc.fontSize(10).fillColor('#000').text(
      '• Finding 3.1 — Loading dock excursion (8.6°C, 14 min) on May 09. CAPA: door interlock retrofit completed.\n' +
      '• Finding 3.2 — Sensor SC-014 drift >0.5°C. CAPA: recalibrated against NIST-traceable reference.\n' +
      '• Finding 3.3 — Carrier ETA variance >2h on RT-A. CAPA: re-scored carrier, alternate lane selected.'
    );
    doc.moveDown();

    doc.fontSize(13).fillColor('#0b3d91').text('4. Attestation');
    doc.fontSize(10).fillColor('#000').text(
      'I attest that the data summarized above is a true and accurate record drawn from validated electronic records ' +
      'under 21 CFR Part 11. Electronic signature applied.'
    );
    doc.moveDown(2);
    doc.fontSize(10).text('_________________________');
    doc.text('Quality Assurance Officer');

    doc.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --------- NON-VIZ #2: Temperature threshold rules editor (CRUD per product type) ---------
// In-memory store, seeded with realistic regulatory thresholds.
let thresholdRules = [
  { id: 1, productType: 'mRNA Vaccine',     minC: -80, maxC: -60, alarmMinC: -75, alarmMaxC: -65, regulator: 'FDA',  notes: 'Ultra-cold storage (Pfizer/BioNTech profile)' },
  { id: 2, productType: 'Insulin',          minC: 2,   maxC: 8,   alarmMinC: 3,   alarmMaxC: 7,   regulator: 'FDA',  notes: 'Per USP <659> after dispensing' },
  { id: 3, productType: 'Blood Plasma',     minC: -30, maxC: -18, alarmMinC: -28, alarmMaxC: -20, regulator: 'AABB', notes: 'FFP storage, AABB Standards 32nd ed.' },
  { id: 4, productType: 'Whole Blood',      minC: 1,   maxC: 6,   alarmMinC: 2,   alarmMaxC: 5,   regulator: 'AABB', notes: '21 CFR 640.4' },
  { id: 5, productType: 'Salmon Fillet',    minC: -2,  maxC: 4,   alarmMinC: -1,  alarmMaxC: 3,   regulator: 'FSMA', notes: 'FDA Fish & Fishery Products Hazards Guide' },
  { id: 6, productType: 'Frozen Berries',   minC: -25, maxC: -18, alarmMinC: -22, alarmMaxC: -19, regulator: 'FSMA', notes: 'FDA frozen food guidance' },
  { id: 7, productType: 'Ice Cream',        minC: -25, maxC: -18, alarmMinC: -22, alarmMaxC: -19, regulator: 'FDA',  notes: 'IDFA recommended hold' },
  { id: 8, productType: 'Fresh Berries',    minC: 0,   maxC: 4,   alarmMinC: 1,   alarmMaxC: 3,   regulator: 'FSMA', notes: 'USDA fresh produce cold-chain' },
];
let nextRuleId = thresholdRules.length + 1;

// LIST + CREATE + UPDATE + DELETE on same endpoint with method routing
router.get('/threshold-rules', authenticate, async (req, res) => {
  try {
    res.json({ rules: thresholdRules, total: thresholdRules.length, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/threshold-rules', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    const productType = b.productType || b.product_type;
    if (!productType) return res.status(400).json({ error: 'productType required' });
    const rule = {
      id: nextRuleId++,
      productType,
      minC: Number(b.minC ?? b.min_c ?? 0),
      maxC: Number(b.maxC ?? b.max_c ?? 8),
      alarmMinC: Number(b.alarmMinC ?? b.alarm_min_c ?? 1),
      alarmMaxC: Number(b.alarmMaxC ?? b.alarm_max_c ?? 7),
      regulator: b.regulator || 'FDA',
      notes: b.notes || '',
    };
    thresholdRules.push(rule);
    res.status(201).json({ rule });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/threshold-rules/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = thresholdRules.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const current = thresholdRules[idx];
    thresholdRules[idx] = {
      ...current,
      productType: b.productType ?? b.product_type ?? current.productType,
      minC: b.minC !== undefined ? Number(b.minC) : (b.min_c !== undefined ? Number(b.min_c) : current.minC),
      maxC: b.maxC !== undefined ? Number(b.maxC) : (b.max_c !== undefined ? Number(b.max_c) : current.maxC),
      alarmMinC: b.alarmMinC !== undefined ? Number(b.alarmMinC) : (b.alarm_min_c !== undefined ? Number(b.alarm_min_c) : current.alarmMinC),
      alarmMaxC: b.alarmMaxC !== undefined ? Number(b.alarmMaxC) : (b.alarm_max_c !== undefined ? Number(b.alarm_max_c) : current.alarmMaxC),
      regulator: b.regulator ?? current.regulator,
      notes: b.notes ?? current.notes,
    };
    res.json({ rule: thresholdRules[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/threshold-rules/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const before = thresholdRules.length;
    thresholdRules = thresholdRules.filter((r) => r.id !== id);
    if (thresholdRules.length === before) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
