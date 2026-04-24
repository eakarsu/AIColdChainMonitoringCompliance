import React, { useEffect, useState } from 'react';
import { FiDownload, FiBarChart2, FiThermometer, FiAlertTriangle, FiShield, FiTruck, FiFileText } from 'react-icons/fi';
import { fetchReportSummary } from '../api';
import { showToast } from '../utils/toast';
import { getToken } from '../api';

const exportItems = [
  { key: 'temperature', label: 'Temperature Readings', icon: FiThermometer, color: '#3b82f6' },
  { key: 'spoilage', label: 'Spoilage Predictions', icon: FiAlertTriangle, color: '#f59e0b' },
  { key: 'compliance', label: 'Compliance Records', icon: FiShield, color: '#10b981' },
  { key: 'carriers', label: 'Carrier Data', icon: FiTruck, color: '#06b6d4' },
  { key: 'incidents', label: 'Incident Reports', icon: FiFileText, color: '#ef4444' },
];

function downloadCsv(entityKey) {
  const token = getToken();
  fetch(`/api/reports/export/${entityKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityKey}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${entityKey} exported successfully`, 'success');
    })
    .catch(() => showToast('Export failed', 'error'));
}

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiBarChart2 style={{ marginRight: 8, verticalAlign: 'middle' }} />Reports & Export</h2>
          <p>Download data exports and view summary reports</p>
        </div>
      </div>

      <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }}>Data Exports</h3>
      <div className="export-grid">
        {exportItems.map((item) => (
          <div key={item.key} className="export-card card" onClick={() => downloadCsv(item.key)}>
            <div className="stat-card-icon" style={{ background: `${item.color}20`, color: item.color }}>
              <item.icon />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Download as CSV</div>
            </div>
            <FiDownload style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }} />
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: '1.1rem' }}>Summary Report</h3>
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Generating report...</span></div>
      ) : summary ? (
        <div className="summary-grid">
          <div className="card summary-section">
            <h4><FiThermometer style={{ marginRight: 8 }} />Temperature Overview</h4>
            <div className="summary-metrics">
              <div className="summary-metric"><span className="summary-metric-label">Total Readings</span><span className="summary-metric-value">{summary.temperature?.total}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Normal</span><span className="summary-metric-value text-success">{summary.temperature?.normal}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Warning</span><span className="summary-metric-value text-warning">{summary.temperature?.warning}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Critical</span><span className="summary-metric-value text-danger">{summary.temperature?.critical}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Avg Temp</span><span className="summary-metric-value">{summary.temperature?.avgTemp}°</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Locations</span><span className="summary-metric-value">{summary.temperature?.locations}</span></div>
            </div>
          </div>

          <div className="card summary-section">
            <h4><FiAlertTriangle style={{ marginRight: 8 }} />Spoilage Risk</h4>
            <div className="summary-metrics">
              <div className="summary-metric"><span className="summary-metric-label">Total Predictions</span><span className="summary-metric-value">{summary.spoilage?.total}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Low Risk</span><span className="summary-metric-value text-success">{summary.spoilage?.lowRisk}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Medium Risk</span><span className="summary-metric-value text-warning">{summary.spoilage?.mediumRisk}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">High Risk</span><span className="summary-metric-value text-danger">{summary.spoilage?.highRisk}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Critical Risk</span><span className="summary-metric-value text-danger">{summary.spoilage?.criticalRisk}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Expired</span><span className="summary-metric-value">{summary.spoilage?.expired}</span></div>
            </div>
          </div>

          <div className="card summary-section">
            <h4><FiShield style={{ marginRight: 8 }} />Compliance Status</h4>
            <div className="summary-metrics">
              <div className="summary-metric"><span className="summary-metric-label">Total Records</span><span className="summary-metric-value">{summary.compliance?.total}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Compliant</span><span className="summary-metric-value text-success">{summary.compliance?.compliant}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Non-Compliant</span><span className="summary-metric-value text-danger">{summary.compliance?.nonCompliant}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Pending</span><span className="summary-metric-value text-warning">{summary.compliance?.pending}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Critical Priority</span><span className="summary-metric-value text-danger">{summary.compliance?.criticalPriority}</span></div>
            </div>
          </div>

          <div className="card summary-section">
            <h4><FiTruck style={{ marginRight: 8 }} />Carrier Performance</h4>
            <div className="summary-metrics">
              <div className="summary-metric"><span className="summary-metric-label">Total Carriers</span><span className="summary-metric-value">{summary.carriers?.total}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Avg Score</span><span className="summary-metric-value">{summary.carriers?.avgScore}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Avg On-Time</span><span className="summary-metric-value">{summary.carriers?.avgOnTime}%</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Avg Temp Compliance</span><span className="summary-metric-value">{summary.carriers?.avgTempCompliance}%</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Active</span><span className="summary-metric-value text-success">{summary.carriers?.active}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Suspended</span><span className="summary-metric-value text-danger">{summary.carriers?.suspended}</span></div>
            </div>
          </div>

          <div className="card summary-section">
            <h4><FiFileText style={{ marginRight: 8 }} />Incidents</h4>
            <div className="summary-metrics">
              <div className="summary-metric"><span className="summary-metric-label">Total Incidents</span><span className="summary-metric-value">{summary.incidents?.total}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Open</span><span className="summary-metric-value text-warning">{summary.incidents?.open}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Investigating</span><span className="summary-metric-value text-info">{summary.incidents?.investigating}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Resolved</span><span className="summary-metric-value text-success">{summary.incidents?.resolved}</span></div>
              <div className="summary-metric"><span className="summary-metric-label">Critical Severity</span><span className="summary-metric-value text-danger">{summary.incidents?.criticalSeverity}</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Failed to load summary report</div>
      )}

      {summary && (
        <div style={{ marginTop: 16, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Report generated at {new Date(summary.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
