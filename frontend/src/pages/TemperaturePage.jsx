import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiThermometer } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DetailPanel from '../components/DetailPanel';
import {
  fetchTemperature,
  createTemperature,
  updateTemperature,
  deleteTemperature,
  analyzeTemperature,
} from '../api';
import { showToast } from '../utils/toast';

const statusBadge = (val) => {
  const map = {
    normal: 'badge-success',
    warning: 'badge-warning',
    critical: 'badge-danger',
  };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'sensorId', label: 'Sensor ID' },
  { key: 'location', label: 'Location' },
  { key: 'zone', label: 'Zone' },
  { key: 'temperature', label: 'Temperature', render: (v) => (v != null ? `${v}°F` : '—') },
  { key: 'humidity', label: 'Humidity', render: (v) => (v != null ? `${v}%` : '—') },
  { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
  {
    key: 'timestamp',
    label: 'Timestamp',
    render: (v) =>
      v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
  },
];

const detailFields = [
  { key: 'sensorId', label: 'Sensor ID' },
  { key: 'location', label: 'Location' },
  { key: 'zone', label: 'Zone' },
  { key: 'temperature', label: 'Temperature', type: 'number' },
  { key: 'humidity', label: 'Humidity', type: 'number' },
  {
    key: 'status',
    label: 'Status',
    options: ['Normal', 'Warning', 'Critical'],
  },
  { key: 'minThreshold', label: 'Min Temp', type: 'number' },
  { key: 'maxThreshold', label: 'Max Temp', type: 'number' },
  { key: 'timestamp', label: 'Timestamp', type: 'date', readOnly: true },
];

const emptyForm = {
  sensorId: '',
  location: '',
  zone: '',
  temperature: '',
  humidity: '',
  status: 'Normal',
  minThreshold: '',
  maxThreshold: '',
};

export default function TemperaturePage() {
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(() => {
    fetchTemperature()
      .then((res) => setData(Array.isArray(res) ? res : res.data || []))
      .catch(() => {
        showToast('Failed to load temperature data', 'error');
        setData([]);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...form,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        humidity: form.humidity ? Number(form.humidity) : undefined,
        minThreshold: form.minThreshold ? Number(form.minThreshold) : undefined,
        maxThreshold: form.maxThreshold ? Number(form.maxThreshold) : undefined,
      };
      await createTemperature(payload);
      showToast('Temperature reading created', 'success');
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
    if (payload.temperature) payload.temperature = Number(payload.temperature);
    if (payload.humidity) payload.humidity = Number(payload.humidity);
    if (payload.minThreshold) payload.minThreshold = Number(payload.minThreshold);
    if (payload.maxThreshold) payload.maxThreshold = Number(payload.maxThreshold);
    await updateTemperature(id, payload);
    loadData();
    setSelectedRecord(null);
  };

  const handleDelete = async (id) => {
    await deleteTemperature(id);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiThermometer style={{ marginRight: 8, verticalAlign: 'middle' }} />Temperature Monitoring</h2>
          <p>Real-time temperature readings across all zones</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> New Reading
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
          onAIAction={analyzeTemperature}
          aiLabel="AI Analyze"
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Temperature Reading">
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sensor ID</label>
              <input className="form-input" value={form.sensorId} onChange={(e) => setForm({ ...form, sensorId: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Zone</label>
              <input className="form-input" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Normal">Normal</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Temperature (°F)</label>
              <input className="form-input" type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Humidity (%)</label>
              <input className="form-input" type="number" step="0.1" value={form.humidity} onChange={(e) => setForm({ ...form, humidity: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Min Temp</label>
              <input className="form-input" type="number" step="0.1" value={form.minThreshold} onChange={(e) => setForm({ ...form, minThreshold: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Temp</label>
              <input className="form-input" type="number" step="0.1" value={form.maxThreshold} onChange={(e) => setForm({ ...form, maxThreshold: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Reading'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
