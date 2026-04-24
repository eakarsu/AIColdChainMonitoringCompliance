import React, { useEffect, useState, useCallback } from 'react';
import { FiClock, FiFilter } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import { fetchAuditLog, fetchAuditStats } from '../api';
import { showToast } from '../utils/toast';

const actionBadge = (val) => {
  const map = { create: 'badge-success', update: 'badge-info', delete: 'badge-danger' };
  return <span className={`badge ${map[val] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'createdAt', label: 'Time', render: (v) => v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
  { key: 'action', label: 'Action', render: (v) => actionBadge(v) },
  { key: 'entityType', label: 'Entity' },
  { key: 'entityId', label: 'ID' },
  { key: 'userName', label: 'User' },
  { key: 'changes', label: 'Changes', render: (v) => {
    if (!v) return '—';
    try {
      const obj = typeof v === 'string' ? JSON.parse(v) : v;
      return <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{Object.keys(obj).join(', ')}</span>;
    } catch { return '—'; }
  }},
];

export default function AuditLogPage() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadData = useCallback(() => {
    let params = '?limit=200';
    if (entityFilter) params += `&entity=${entityFilter}`;
    if (actionFilter) params += `&action=${actionFilter}`;
    fetchAuditLog(params)
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => { showToast('Failed to load audit log', 'error'); setData([]); });
    fetchAuditStats()
      .then(setStats)
      .catch(() => {});
  }, [entityFilter, actionFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiClock style={{ marginRight: 8, verticalAlign: 'middle' }} />Audit Log</h2>
          <p>Track all system changes and activity</p>
        </div>
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-value">{stats.totalEntries || 0}</div>
            <div className="stat-card-label">Total Entries</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-value text-success">{stats.creates || 0}</div>
            <div className="stat-card-label">Creates</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-value text-info">{stats.updates || 0}</div>
            <div className="stat-card-label">Updates</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-card-value text-danger">{stats.deletes || 0}</div>
            <div className="stat-card-label">Deletes</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <FiFilter style={{ color: 'var(--text-muted)' }} />
        <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">All Entities</option>
          <option value="temperature_reading">Temperature</option>
          <option value="spoilage_prediction">Spoilage</option>
          <option value="compliance_record">Compliance</option>
          <option value="carrier">Carrier</option>
          <option value="incident">Incident</option>
          <option value="user">User</option>
        </select>
        <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      <DataTable columns={columns} data={data} onRowClick={setSelected} />

      {selected && (
        <>
          <div className="detail-panel-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="detail-panel-header">
              <h3>Audit Entry Details</h3>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="detail-panel-body">
              <div className="detail-field"><div className="detail-field-label">Time</div><div className="detail-field-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</div></div>
              <div className="detail-field"><div className="detail-field-label">Action</div><div className="detail-field-value">{actionBadge(selected.action)}</div></div>
              <div className="detail-field"><div className="detail-field-label">Entity</div><div className="detail-field-value">{selected.entityType} #{selected.entityId}</div></div>
              <div className="detail-field"><div className="detail-field-label">User</div><div className="detail-field-value">{selected.userName} ({selected.userEmail})</div></div>
              <div className="detail-field">
                <div className="detail-field-label">Changes</div>
                <div className="detail-field-value">
                  {selected.changes ? (
                    <pre style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(typeof selected.changes === 'string' ? JSON.parse(selected.changes) : selected.changes, null, 2)}
                    </pre>
                  ) : '—'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
