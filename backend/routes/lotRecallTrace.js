import { Router } from 'express';
import authenticate from '../middleware/auth.js';

const router = Router();

let rows = [
  {
    id: 1,
    lot_code: 'LOT-FRZ-20260520-A',
    product_name: 'Frozen vaccine diluent',
    facility: 'JFK Pharma Crossdock',
    affected_shipments: 7,
    excursion_window: '2026-05-20 02:10-03:05 UTC',
    recall_status: 'containment',
    risk_level: 'high',
    next_action: 'Hold downstream deliveries and notify QA release owner.',
  },
  {
    id: 2,
    lot_code: 'LOT-PRD-20260518-C',
    product_name: 'Chilled biologic sample kit',
    facility: 'Chicago 3PL',
    affected_shipments: 3,
    excursion_window: 'No confirmed excursion',
    recall_status: 'monitoring',
    risk_level: 'medium',
    next_action: 'Keep customer notification draft open until sensor audit completes.',
  },
];

const nextId = () => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

router.use(authenticate);

router.get('/', (req, res) => res.json(rows));
router.post('/', (req, res) => {
  const row = { id: nextId(), ...req.body };
  rows.unshift(row);
  res.status(201).json(row);
});
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Lot recall trace not found' });
  rows[idx] = { ...rows[idx], ...req.body, id };
  res.json(rows[idx]);
});
router.delete('/:id', (req, res) => {
  rows = rows.filter((row) => row.id !== Number(req.params.id));
  res.json({ message: 'deleted' });
});

export default router;
