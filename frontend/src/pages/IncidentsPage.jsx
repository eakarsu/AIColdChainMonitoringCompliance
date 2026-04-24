import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiFileText } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DetailPanel from '../components/DetailPanel';
import {
  fetchIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  analyzeIncident,
} from '../api';
import { showToast } from '../utils/toast';

const severityBadge = (val) => {
  const map = {
    low: 'badge-info',
    medium: 'badge-warning',
    high: 'badge-orange',
    critical: 'badge-danger',
  };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const statusBadge = (val) => {
  const map = {
    open: 'badge-danger',
    'in progress': 'badge-warning',
    investigating: 'badge-warning',
    resolved: 'badge-success',
    closed: 'badge-success',
  };
  return <span className={`badge ${map[(val || '').toLowerCase()] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'incidentType', label: 'Type' },
  { key: 'severity', label: 'Severity', render: (v) => severityBadge(v) },
  {
    key: 'date',
    label: 'Date',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
  { key: 'assignedTo', label: 'Assigned To' },
];

const detailFields = [
  { key: 'title', label: 'Title' },
  { key: 'incidentType', label: 'Type', options: ['Temperature Excursion', 'Equipment Failure', 'Power Outage', 'Transportation Delay', 'Contamination', 'Documentation', 'Other'] },
  { key: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High', 'Critical'] },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status', options: ['Open', 'In Progress', 'Investigating', 'Resolved', 'Closed'] },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'rootCause', label: 'Root Cause', type: 'textarea' },
  { key: 'correctiveAction', label: 'Corrective Action', type: 'textarea' },
  { key: 'reportedBy', label: 'Reported By' },
];

const emptyForm = {
  title: '',
  incidentType: 'Temperature Excursion',
  severity: 'Medium',
  date: '',
  location: '',
  status: 'Open',
  assignedTo: '',
  description: '',
  reportedBy: '',
};

export default function IncidentsPage() {
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(() => {
    fetchIncidents()
      .then((res) => setData(Array.isArray(res) ? res : res.data || []))
      .catch(() => {
        showToast('Failed to load incidents', 'error');
        setData([]);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createIncident(form);
      showToast('Incident created', 'success');
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
    await updateIncident(id, updates);
    loadData();
    setSelectedRecord(null);
  };

  const handleDelete = async (id) => {
    await deleteIncident(id);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiFileText style={{ marginRight: 8, verticalAlign: 'middle' }} />Incident Documentation</h2>
          <p>Track and manage cold chain incidents</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> New Incident
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
          onAIAction={analyzeIncident}
          aiLabel="AI Analyze"
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Incident">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.incidentType} onChange={(e) => setForm({ ...form, incidentType: e.target.value })}>
                <option>Temperature Excursion</option><option>Equipment Failure</option><option>Power Outage</option><option>Transportation Delay</option><option>Contamination</option><option>Documentation</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select className="form-select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Open</option><option>In Progress</option><option>Investigating</option><option>Resolved</option><option>Closed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned To</label>
              <input className="form-input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reported By</label>
            <input className="form-input" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Incident'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
