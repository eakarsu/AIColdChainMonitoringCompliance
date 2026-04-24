import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiAlertTriangle } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DetailPanel from '../components/DetailPanel';
import {
  fetchSpoilage,
  createSpoilage,
  updateSpoilage,
  deleteSpoilage,
  predictSpoilage,
} from '../api';
import { showToast } from '../utils/toast';

const riskBadge = (val) => {
  const map = {
    low: 'badge-success',
    medium: 'badge-warning',
    high: 'badge-orange',
    critical: 'badge-danger',
  };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'productName', label: 'Product Name' },
  { key: 'batchId', label: 'Batch ID' },
  { key: 'productType', label: 'Product Type' },
  { key: 'currentTemp', label: 'Current Temp', render: (v) => (v != null ? `${v}°F` : '—') },
  { key: 'riskLevel', label: 'Risk Level', render: (v) => riskBadge(v) },
  {
    key: 'predictedSpoilageDate',
    label: 'Predicted Spoilage',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  { key: 'status', label: 'Status', render: (v) => <span className={`badge ${(v || '').toLowerCase() === 'active' ? 'badge-success' : 'badge-warning'}`}>{v || '—'}</span> },
];

const detailFields = [
  { key: 'productName', label: 'Product Name' },
  { key: 'batchId', label: 'Batch ID' },
  { key: 'productType', label: 'Product Type', options: ['Dairy', 'Meat', 'Seafood', 'Produce', 'Frozen', 'Pharmaceutical'] },
  { key: 'currentTemp', label: 'Current Temp (°F)', type: 'number' },
  { key: 'storageTemp', label: 'Storage Temp (°F)', type: 'number' },
  { key: 'riskLevel', label: 'Risk Level', options: ['Low', 'Medium', 'High', 'Critical'] },
  { key: 'predictedSpoilageDate', label: 'Predicted Spoilage Date', type: 'date' },
  { key: 'status', label: 'Status', options: ['Active', 'Monitoring', 'Expired', 'Disposed'] },
  { key: 'manufactureDate', label: 'Manufacture Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'confidence', label: 'Confidence (%)', type: 'number' },
];

const emptyForm = {
  productName: '',
  batchId: '',
  productType: 'Dairy',
  currentTemp: '',
  storageTemp: '',
  riskLevel: 'Low',
  status: 'Active',
  manufactureDate: '',
  expiryDate: '',
  quantity: '',
};

export default function SpoilagePage() {
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(() => {
    fetchSpoilage()
      .then((res) => setData(Array.isArray(res) ? res : res.data || []))
      .catch(() => {
        showToast('Failed to load spoilage data', 'error');
        setData([]);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...form,
        currentTemp: form.currentTemp ? Number(form.currentTemp) : undefined,
        storageTemp: form.storageTemp ? Number(form.storageTemp) : undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
      };
      await createSpoilage(payload);
      showToast('Spoilage prediction created', 'success');
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
    ['currentTemp', 'storageTemp', 'quantity'].forEach((k) => {
      if (payload[k]) payload[k] = Number(payload[k]);
    });
    await updateSpoilage(id, payload);
    loadData();
    setSelectedRecord(null);
  };

  const handleDelete = async (id) => {
    await deleteSpoilage(id);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiAlertTriangle style={{ marginRight: 8, verticalAlign: 'middle' }} />Spoilage Predictions</h2>
          <p>AI-powered spoilage risk analysis</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> New Prediction
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
          onAIAction={predictSpoilage}
          aiLabel="AI Predict"
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Spoilage Prediction">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Batch ID</label>
              <input className="form-input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Product Type</label>
              <select className="form-select" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                <option>Dairy</option><option>Meat</option><option>Seafood</option><option>Produce</option><option>Frozen</option><option>Pharmaceutical</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Risk Level</label>
              <select className="form-select" value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Current Temp (°F)</label>
              <input className="form-input" type="number" step="0.1" value={form.currentTemp} onChange={(e) => setForm({ ...form, currentTemp: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Storage Temp (°F)</label>
              <input className="form-input" type="number" step="0.1" value={form.storageTemp} onChange={(e) => setForm({ ...form, storageTemp: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Manufacture Date</label>
              <input className="form-input" type="date" value={form.manufactureDate} onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input className="form-input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="form-group" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Active</option><option>Monitoring</option><option>Expired</option><option>Disposed</option>
            </select>
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Prediction'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
