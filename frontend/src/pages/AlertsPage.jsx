import React, { useEffect, useState, useCallback } from 'react';
import { FiBell, FiCheck, FiX, FiAlertTriangle, FiAlertOctagon } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import { fetchAlerts, acknowledgeAlert, dismissAlert, fetchAlertStats } from '../api';
import { showToast } from '../utils/toast';

const severityBadge = (val) => {
  const map = { critical: 'badge-danger', high: 'badge-orange', medium: 'badge-warning', low: 'badge-info' };
  return <span className={`badge ${map[val] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'sensorId', label: 'Sensor' },
  { key: 'location', label: 'Location' },
  { key: 'zone', label: 'Zone' },
  { key: 'temperature', label: 'Temp', render: (v) => v != null ? `${v}°` : '—' },
  { key: 'deviation', label: 'Deviation', render: (v) => v ? <span className="text-danger">±{v}°</span> : '—' },
  { key: 'severity', label: 'Severity', render: (v) => severityBadge(v) },
  { key: 'acknowledged', label: 'Status', render: (v) => v ? <span className="badge badge-success">Acknowledged</span> : <span className="badge badge-warning">Active</span> },
  { key: 'timestamp', label: 'Time', render: (v) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
];

export default function AlertsPage() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const loadData = useCallback(() => {
    const params = filter !== 'all' ? `?status=${filter}` : '';
    fetchAlerts(params)
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => { showToast('Failed to load alerts', 'error'); setData([]); });
    fetchAlertStats()
      .then(setStats)
      .catch(() => {});
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeAlert(id, { notes: 'Acknowledged from alerts page' });
      showToast('Alert acknowledged', 'success');
      loadData();
      setSelected(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDismiss = async (id) => {
    try {
      await dismissAlert(id);
      showToast('Alert acknowledgment removed', 'info');
      loadData();
      setSelected(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiBell style={{ marginRight: 8, verticalAlign: 'middle' }} />Alert Management</h2>
          <p>Temperature threshold breach alerts</p>
        </div>
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><FiAlertOctagon /></div>
            <div className="stat-card-value">{stats.totalAlerts || 0}</div>
            <div className="stat-card-label">Total Alerts</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><FiAlertTriangle /></div>
            <div className="stat-card-value">{stats.criticalCount || 0}</div>
            <div className="stat-card-label">Critical</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}><FiAlertTriangle /></div>
            <div className="stat-card-value">{stats.highCount || 0}</div>
            <div className="stat-card-label">High</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><FiAlertTriangle /></div>
            <div className="stat-card-value">{stats.mediumCount || 0}</div>
            <div className="stat-card-label">Medium</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
        <button className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`btn btn-sm ${filter === 'acknowledged' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('acknowledged')}>Acknowledged</button>
      </div>

      <DataTable columns={columns} data={data} onRowClick={setSelected} />

      {selected && (
        <>
          <div className="detail-panel-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="detail-panel-header">
              <h3>Alert Details</h3>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="detail-panel-body">
              <div className="detail-fields-grid">
                <div className="detail-field"><div className="detail-field-label">Sensor</div><div className="detail-field-value">{selected.sensorId}</div></div>
                <div className="detail-field"><div className="detail-field-label">Location</div><div className="detail-field-value">{selected.location}</div></div>
                <div className="detail-field"><div className="detail-field-label">Zone</div><div className="detail-field-value">{selected.zone}</div></div>
                <div className="detail-field"><div className="detail-field-label">Product</div><div className="detail-field-value">{selected.productType}</div></div>
                <div className="detail-field"><div className="detail-field-label">Temperature</div><div className="detail-field-value">{selected.temperature}°</div></div>
                <div className="detail-field"><div className="detail-field-label">Range</div><div className="detail-field-value">{selected.minThreshold}° — {selected.maxThreshold}°</div></div>
                <div className="detail-field"><div className="detail-field-label">Deviation</div><div className="detail-field-value text-danger">±{selected.deviation}°</div></div>
                <div className="detail-field"><div className="detail-field-label">Severity</div><div className="detail-field-value">{severityBadge(selected.severity)}</div></div>
              </div>
              {selected.acknowledgedBy && (
                <div className="detail-field" style={{ marginTop: 16 }}>
                  <div className="detail-field-label">Acknowledged By</div>
                  <div className="detail-field-value">{selected.acknowledgedBy} at {selected.acknowledgedAt ? new Date(selected.acknowledgedAt).toLocaleString() : '—'}</div>
                </div>
              )}
              {selected.alertNotes && (
                <div className="detail-field">
                  <div className="detail-field-label">Notes</div>
                  <div className="detail-field-value">{selected.alertNotes}</div>
                </div>
              )}
            </div>
            <div className="detail-panel-actions">
              {!selected.acknowledged ? (
                <button className="btn btn-success" onClick={() => handleAcknowledge(selected.id)}>
                  <FiCheck /> Acknowledge
                </button>
              ) : (
                <button className="btn btn-warning" onClick={() => handleDismiss(selected.id)}>
                  <FiX /> Remove Acknowledgment
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
