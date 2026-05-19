import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiZap, FiCheck, FiTrash2 } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import {
  fetchRegulatoryChanges,
  createRegulatoryChange,
  assessRegulatoryChange,
  acknowledgeRegulatoryChange,
  deleteRegulatoryChange,
} from '../api';
import { showToast } from '../utils/toast';

const impactBadge = (val) => {
  const map = { Critical: 'badge-danger', High: 'badge-orange', Medium: 'badge-warning', Low: 'badge-info' };
  return <span className={`badge ${map[val] || 'badge-secondary'}`}>{val || '—'}</span>;
};

const statusBadge = (val) => {
  const map = { new: 'badge-info', acknowledged: 'badge-success', under_review: 'badge-warning' };
  return <span className={`badge ${map[val] || 'badge-secondary'}`}>{val}</span>;
};

const columns = [
  { key: 'source', label: 'Source' },
  { key: 'referenceCode', label: 'Reference' },
  { key: 'title', label: 'Title' },
  { key: 'effectiveDate', label: 'Effective Date', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'impactLevel', label: 'Impact', render: impactBadge },
  { key: 'status', label: 'Status', render: statusBadge },
];

const emptyForm = {
  source: 'FDA',
  referenceCode: '',
  title: '',
  description: '',
  effectiveDate: '',
  impactLevel: 'Medium',
};

export default function RegulatoryPage() {
  const [data, setData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [aiResults, setAiResults] = useState({});

  const loadData = useCallback(() => {
    fetchRegulatoryChanges()
      .then((r) => setData(r.data || []))
      .catch(() => { showToast('Failed to load regulatory changes', 'error'); setData([]); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    try {
      await createRegulatoryChange(form);
      showToast('Regulatory change recorded', 'success');
      setShowModal(false);
      setForm(emptyForm);
      loadData();
    } catch (err) {
      showToast(err.message || 'Create failed', 'error');
    }
  };

  const handleAssess = async (row) => {
    try {
      const res = await assessRegulatoryChange(row.id);
      setAiResults({ ...aiResults, [row.id]: res.parsed });
      showToast('AI impact assessment complete', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Assessment failed', 'error');
    }
  };

  const handleAcknowledge = async (row) => {
    try {
      await acknowledgeRegulatoryChange(row.id);
      showToast('Acknowledged', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Acknowledge failed', 'error');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete regulatory change "${row.title}"?`)) return;
    try {
      await deleteRegulatoryChange(row.id);
      showToast('Deleted', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Regulatory Change Alerts</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Track Change
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        actions={(row) => (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-icon btn-secondary" onClick={() => handleAssess(row)} title="AI Impact Assessment">
              <FiZap />
            </button>
            {row.status !== 'acknowledged' && (
              <button className="btn btn-icon btn-success" onClick={() => handleAcknowledge(row)} title="Acknowledge">
                <FiCheck />
              </button>
            )}
            <button className="btn btn-icon btn-danger" onClick={() => handleDelete(row)} title="Delete">
              <FiTrash2 />
            </button>
          </div>
        )}
      />

      {Object.entries(aiResults).map(([id, parsed]) => (
        <div key={id} className="card" style={{ padding: 12, margin: '8px 0', background: '#f0f9ff' }}>
          <strong>AI Assessment for change #{id}:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'monospace', marginTop: 8 }}>{JSON.stringify(parsed, null, 2)}</pre>
        </div>
      ))}

      {showModal && (
        <Modal title="Track Regulatory Change" onClose={() => setShowModal(false)}>
          <div className="form">
            <label>Source
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="FDA">FDA</option>
                <option value="HACCP">HACCP</option>
                <option value="FSMA">FSMA</option>
                <option value="USDA">USDA</option>
                <option value="EU">EU</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Reference Code<input value={form.referenceCode} onChange={(e) => setForm({ ...form, referenceCode: e.target.value })} /></label>
            <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></label>
            <label>Effective Date<input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></label>
            <label>Impact Level
              <select value={form.impactLevel} onChange={(e) => setForm({ ...form, impactLevel: e.target.value })}>
                <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
