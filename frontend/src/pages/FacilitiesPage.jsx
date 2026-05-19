import React, { useEffect, useState, useCallback } from 'react';
import { FiPlus, FiZap, FiTrash2 } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import {
  fetchFacilities,
  fetchFacilityRollup,
  generateFacilityInsights,
  createFacility,
  deleteFacility,
} from '../api';
import { showToast } from '../utils/toast';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'parentCompany', label: 'Parent Company' },
  { key: 'region', label: 'Region' },
  { key: 'facilityType', label: 'Type' },
  { key: 'capacityUnits', label: 'Capacity' },
];

const rollupColumns = [
  { key: 'name', label: 'Facility' },
  { key: 'region', label: 'Region' },
  { key: 'totalReadings', label: 'Readings' },
  { key: 'alertCount', label: 'Alerts', render: (v) => <span className={Number(v) > 5 ? 'badge badge-danger' : 'badge badge-info'}>{v || 0}</span> },
  { key: 'avgTemp', label: 'Avg Temp (°C)', render: (v) => v != null ? Number(v).toFixed(1) : '—' },
  { key: 'totalIncidents', label: 'Incidents' },
  { key: 'criticalIncidents', label: 'Critical', render: (v) => <span className={Number(v) > 0 ? 'badge badge-danger' : 'badge badge-success'}>{v || 0}</span> },
];

const emptyForm = {
  name: '',
  code: '',
  parentCompany: '',
  region: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  facilityType: 'warehouse',
  capacityUnits: '',
};

export default function FacilitiesPage() {
  const [data, setData] = useState(null);
  const [rollup, setRollup] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadData = useCallback(() => {
    fetchFacilities()
      .then((r) => setData(r.data || []))
      .catch(() => { showToast('Failed to load facilities', 'error'); setData([]); });
    fetchFacilityRollup()
      .then((r) => setRollup(r.facilities || []))
      .catch(() => setRollup([]));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    try {
      await createFacility({ ...form, capacityUnits: form.capacityUnits ? Number(form.capacityUnits) : null });
      showToast('Facility created', 'success');
      setShowModal(false);
      setForm(emptyForm);
      loadData();
    } catch (err) {
      showToast(err.message || 'Create failed', 'error');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Deactivate facility "${row.name}"?`)) return;
    try {
      await deleteFacility(row.id);
      showToast('Facility deactivated', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await generateFacilityInsights();
      setInsights(res.summary || res);
      showToast('AI insights generated', 'success');
    } catch (err) {
      showToast(err.message || 'AI insights failed', 'error');
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Facilities (Multi-Site Aggregation)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleInsights} disabled={loadingInsights}>
            <FiZap /> {loadingInsights ? 'Analyzing…' : 'AI Insights'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Add Facility
          </button>
        </div>
      </div>

      {insights && (
        <div className="card" style={{ padding: 16, margin: '16px 0', background: '#f0f9ff' }}>
          <h3>AI Multi-Facility Insights</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'monospace' }}>{JSON.stringify(insights, null, 2)}</pre>
        </div>
      )}

      <h2>Performance Rollup</h2>
      <DataTable columns={rollupColumns} data={rollup} />

      <h2 style={{ marginTop: 32 }}>Facility Directory</h2>
      <DataTable
        columns={columns}
        data={data}
        actions={(row) => (
          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(row)} title="Deactivate">
            <FiTrash2 />
          </button>
        )}
      />

      {showModal && (
        <Modal title="Add Facility" onClose={() => setShowModal(false)}>
          <div className="form">
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label>Parent Company<input value={form.parentCompany} onChange={(e) => setForm({ ...form, parentCompany: e.target.value })} /></label>
            <label>Region<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
            <label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>Contact Email<input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
            <label>Contact Phone<input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label>Facility Type
              <select value={form.facilityType} onChange={(e) => setForm({ ...form, facilityType: e.target.value })}>
                <option value="warehouse">Warehouse</option>
                <option value="distribution_center">Distribution Center</option>
                <option value="cold_storage">Cold Storage</option>
                <option value="processing">Processing</option>
              </select>
            </label>
            <label>Capacity (units)<input type="number" value={form.capacityUnits} onChange={(e) => setForm({ ...form, capacityUnits: e.target.value })} /></label>
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
