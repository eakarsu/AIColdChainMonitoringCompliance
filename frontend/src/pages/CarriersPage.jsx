import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiTruck } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DetailPanel from '../components/DetailPanel';
import {
  fetchCarriers,
  createCarrier,
  updateCarrier,
  deleteCarrier,
  scoreCarrier,
} from '../api';
import { showToast } from '../utils/toast';

const scoreBadge = (val) => {
  if (val == null) return '—';
  const n = Number(val);
  let cls = 'badge-danger';
  if (n >= 90) cls = 'badge-success';
  else if (n >= 70) cls = 'badge-warning';
  else if (n >= 50) cls = 'badge-orange';
  return <span className={`badge ${cls}`}>{n}</span>;
};

const statusBadge = (val) => {
  const map = { active: 'badge-success', inactive: 'badge-danger', suspended: 'badge-warning' };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'score', label: 'Score', render: (v) => scoreBadge(v) },
  { key: 'onTimeRate', label: 'On-Time Rate', render: (v) => (v != null ? `${v}%` : '—') },
  { key: 'tempComplianceRate', label: 'Temp Compliance', render: (v) => (v != null ? `${v}%` : '—') },
  { key: 'incidentCount', label: 'Incidents' },
  { key: 'fleetSize', label: 'Fleet Size' },
  { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
];

const detailFields = [
  { key: 'name', label: 'Carrier Name' },
  { key: 'code', label: 'Carrier Code' },
  { key: 'score', label: 'Score', type: 'number' },
  { key: 'onTimeRate', label: 'On-Time Rate (%)', type: 'number' },
  { key: 'tempComplianceRate', label: 'Temp Compliance (%)', type: 'number' },
  { key: 'incidentCount', label: 'Incident Count', type: 'number' },
  { key: 'fleetSize', label: 'Fleet Size', type: 'number' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Suspended'] },
  { key: 'routes', label: 'Routes' },
  { key: 'contactEmail', label: 'Contact Email', type: 'email' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'certification', label: 'Certifications' },
];

const emptyForm = {
  name: '',
  code: '',
  score: '',
  onTimeRate: '',
  tempComplianceRate: '',
  incidentCount: '',
  fleetSize: '',
  status: 'Active',
  routes: '',
  contactEmail: '',
  phone: '',
};

export default function CarriersPage() {
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(() => {
    fetchCarriers()
      .then((res) => setData(Array.isArray(res) ? res : res.data || []))
      .catch(() => {
        showToast('Failed to load carriers', 'error');
        setData([]);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { ...form };
      ['score', 'onTimeRate', 'tempComplianceRate', 'incidentCount', 'fleetSize'].forEach((k) => {
        if (payload[k]) payload[k] = Number(payload[k]);
      });
      await createCarrier(payload);
      showToast('Carrier created', 'success');
      setShowModal(false);
      setForm({ ...emptyForm });
      loadData();
    } catch (err) {
      showToast(err.message || 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id, updates) => {
    const payload = { ...updates };
    ['score', 'onTimeRate', 'tempComplianceRate', 'incidentCount', 'fleetSize'].forEach((k) => {
      if (payload[k]) payload[k] = Number(payload[k]);
    });
    await updateCarrier(id, payload);
    loadData();
    setSelectedRecord(null);
  };

  const handleDelete = async (id) => {
    await deleteCarrier(id);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiTruck style={{ marginRight: 8, verticalAlign: 'middle' }} />Carrier Scoring</h2>
          <p>Performance tracking and AI-powered carrier scoring</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> New Carrier
        </button>
      </div>

      <DataTable columns={columns} data={data} onRowClick={setSelectedRecord} />

      {selectedRecord && (
        <DetailPanel
          record={selectedRecord}
          fields={detailFields}
          onClose={() => setSelectedRecord(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAIAction={scoreCarrier}
          aiLabel="AI Score"
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Carrier">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Carrier Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Carrier Code</label>
              <input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Score</label>
              <input className="form-input" type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>Inactive</option><option>Suspended</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">On-Time Rate (%)</label>
              <input className="form-input" type="number" step="0.1" value={form.onTimeRate} onChange={(e) => setForm({ ...form, onTimeRate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Temp Compliance (%)</label>
              <input className="form-input" type="number" step="0.1" value={form.tempComplianceRate} onChange={(e) => setForm({ ...form, tempComplianceRate: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fleet Size</label>
              <input className="form-input" type="number" value={form.fleetSize} onChange={(e) => setForm({ ...form, fleetSize: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Incident Count</label>
              <input className="form-input" type="number" value={form.incidentCount} onChange={(e) => setForm({ ...form, incidentCount: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Routes</label>
              <input className="form-input" value={form.routes} onChange={(e) => setForm({ ...form, routes: e.target.value })} placeholder="e.g. US East Coast, Midwest" />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input className="form-input" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Carrier'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
