import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiShield } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DetailPanel from '../components/DetailPanel';
import {
  fetchCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  assessCompliance,
} from '../api';
import { showToast } from '../utils/toast';

const statusBadge = (val) => {
  const map = {
    compliant: 'badge-success',
    'non-compliant': 'badge-danger',
    pending: 'badge-warning',
    'under review': 'badge-info',
  };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const priorityBadge = (val) => {
  const map = { high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'regulation', label: 'Regulation' },
  { key: 'standard', label: 'Standard' },
  { key: 'category', label: 'Category' },
  { key: 'facility', label: 'Facility' },
  { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
  { key: 'priority', label: 'Priority', render: (v) => priorityBadge(v) },
  {
    key: 'nextAudit',
    label: 'Next Audit',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
];

const detailFields = [
  { key: 'regulation', label: 'Regulation' },
  { key: 'standard', label: 'Standard' },
  { key: 'category', label: 'Category', options: ['FDA', 'HACCP', 'ISO 22000', 'GMP', 'FSMA', 'EU Regulations'] },
  { key: 'facility', label: 'Facility' },
  { key: 'status', label: 'Status', options: ['Compliant', 'Non-Compliant', 'Pending', 'Under Review'] },
  { key: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High'] },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'correctiveActions', label: 'Corrective Actions', type: 'textarea' },
  { key: 'nextAudit', label: 'Next Audit Date', type: 'date' },
  { key: 'lastAudit', label: 'Last Audit Date', type: 'date', readOnly: true },
  { key: 'auditor', label: 'Auditor' },
  { key: 'findings', label: 'Findings', type: 'textarea' },
];

const emptyForm = {
  regulation: '',
  standard: '',
  category: 'FDA',
  facility: '',
  status: 'Pending',
  priority: 'Medium',
  notes: '',
  nextAudit: '',
  auditor: '',
};

export default function CompliancePage() {
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(() => {
    fetchCompliance()
      .then((res) => setData(Array.isArray(res) ? res : res.data || []))
      .catch(() => {
        showToast('Failed to load compliance data', 'error');
        setData([]);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createCompliance(form);
      showToast('Compliance record created', 'success');
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
    await updateCompliance(id, updates);
    loadData();
    setSelectedRecord(null);
  };

  const handleDelete = async (id) => {
    await deleteCompliance(id);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiShield style={{ marginRight: 8, verticalAlign: 'middle' }} />FDA/HACCP Compliance</h2>
          <p>Regulatory compliance tracking and assessment</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> New Record
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
          onAIAction={assessCompliance}
          aiLabel="AI Assess"
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Compliance Record">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Regulation</label>
              <input className="form-input" value={form.regulation} onChange={(e) => setForm({ ...form, regulation: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Standard</label>
              <input className="form-input" value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>FDA</option><option>HACCP</option><option>ISO 22000</option><option>GMP</option><option>FSMA</option><option>EU Regulations</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Facility</label>
              <input className="form-input" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Compliant</option><option>Non-Compliant</option><option>Pending</option><option>Under Review</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Auditor</label>
              <input className="form-input" value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Next Audit Date</label>
              <input className="form-input" type="date" value={form.nextAudit} onChange={(e) => setForm({ ...form, nextAudit: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Record'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
