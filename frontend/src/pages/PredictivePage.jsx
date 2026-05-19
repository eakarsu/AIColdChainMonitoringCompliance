import React, { useEffect, useState } from 'react';
import { FiPlay, FiX, FiKey, FiPlus, FiTrash2 } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import {
  fetchPredictiveAlerts,
  generatePredictiveAlert,
  dismissPredictiveAlert,
  fetchTrend,
  fetchIoTSources,
  createIoTSource,
  revokeIoTSource,
  fetchScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
} from '../api';
import { showToast } from '../utils/toast';

const severityBadge = (val) => {
  const map = { Critical: 'badge-danger', High: 'badge-orange', Medium: 'badge-warning', Low: 'badge-info' };
  return <span className={`badge ${map[val] || 'badge-secondary'}`}>{val || '—'}</span>;
};

const alertCols = [
  { key: 'sensorId', label: 'Sensor' },
  { key: 'productType', label: 'Product Type' },
  { key: 'alertProbabilityPct', label: 'Probability', render: (v) => v != null ? `${v}%` : '—' },
  { key: 'predictedAlertWindowHours', label: 'Window (h)' },
  { key: 'predictedSeverity', label: 'Severity', render: severityBadge },
  { key: 'trendDirection', label: 'Trend' },
  { key: 'status', label: 'Status' },
];

const iotCols = [
  { key: 'name', label: 'Source Name' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'totalReadings', label: 'Total Readings' },
  { key: 'lastIngestAt', label: 'Last Ingest', render: (v) => v ? new Date(v).toLocaleString() : 'Never' },
  { key: 'active', label: 'Active', render: (v) => v ? 'Yes' : 'No' },
];

const reportCols = [
  { key: 'name', label: 'Name' },
  { key: 'reportType', label: 'Type' },
  { key: 'format', label: 'Format' },
  { key: 'scheduleCron', label: 'Schedule' },
  { key: 'lastRunAt', label: 'Last Run', render: (v) => v ? new Date(v).toLocaleString() : 'Never' },
];

export default function PredictivePage() {
  const [alerts, setAlerts] = useState([]);
  const [iotSources, setIotSources] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('alerts');

  const [showGenerate, setShowGenerate] = useState(false);
  const [genSensorId, setGenSensorId] = useState('');
  const [genProductType, setGenProductType] = useState('');

  const [showIotModal, setShowIotModal] = useState(false);
  const [iotForm, setIotForm] = useState({ name: '', vendor: '' });
  const [issuedKey, setIssuedKey] = useState(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ name: '', reportType: 'compliance', format: 'pdf', scheduleCron: '0 0 * * MON', recipients: '' });

  const [trendData, setTrendData] = useState(null);
  const [trendSensorId, setTrendSensorId] = useState('');

  const loadAll = async () => {
    try {
      const [a, i, r] = await Promise.all([
        fetchPredictiveAlerts(),
        fetchIoTSources(),
        fetchScheduledReports(),
      ]);
      setAlerts(a.data || []);
      setIotSources(i || []);
      setReports(r || []);
    } catch (err) {
      showToast(err.message || 'Failed to load data', 'error');
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleGenerateAlert = async () => {
    if (!genSensorId) return showToast('Sensor ID required', 'error');
    try {
      await generatePredictiveAlert(genSensorId, genProductType);
      showToast('Predictive alert generated', 'success');
      setShowGenerate(false);
      setGenSensorId('');
      setGenProductType('');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Generation failed', 'error');
    }
  };

  const handleDismiss = async (row) => {
    try {
      await dismissPredictiveAlert(row.id);
      showToast('Alert dismissed', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Dismiss failed', 'error');
    }
  };

  const handleFetchTrend = async () => {
    if (!trendSensorId) return showToast('Sensor ID required', 'error');
    try {
      const t = await fetchTrend(trendSensorId, 24);
      setTrendData(t);
    } catch (err) {
      showToast(err.message || 'Trend fetch failed', 'error');
    }
  };

  const handleCreateIot = async () => {
    if (!iotForm.name) return showToast('Name required', 'error');
    try {
      const res = await createIoTSource(iotForm);
      setIssuedKey(res.apiKey);
      showToast('IoT source created — copy the API key now!', 'success');
      setIotForm({ name: '', vendor: '' });
      loadAll();
    } catch (err) {
      showToast(err.message || 'IoT source create failed', 'error');
    }
  };

  const handleRevokeIot = async (row) => {
    if (!window.confirm(`Revoke IoT source "${row.name}"?`)) return;
    try {
      await revokeIoTSource(row.id);
      showToast('Revoked', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Revoke failed', 'error');
    }
  };

  const handleCreateReport = async () => {
    if (!reportForm.name) return showToast('Name required', 'error');
    try {
      await createScheduledReport({
        ...reportForm,
        recipients: reportForm.recipients.split(',').map(s => s.trim()).filter(Boolean),
      });
      showToast('Scheduled report created', 'success');
      setShowReportModal(false);
      setReportForm({ name: '', reportType: 'compliance', format: 'pdf', scheduleCron: '0 0 * * MON', recipients: '' });
      loadAll();
    } catch (err) {
      showToast(err.message || 'Schedule create failed', 'error');
    }
  };

  const handleDeleteReport = async (row) => {
    if (!window.confirm(`Delete scheduled report "${row.name}"?`)) return;
    try {
      await deleteScheduledReport(row.id);
      showToast('Deleted', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Predictive Operations</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #ccc' }}>
        {['alerts', 'trend', 'iot', 'reports'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'alerts' && 'Predictive Alerts'}
            {tab === 'trend' && 'Trend Analysis'}
            {tab === 'iot' && 'IoT Hub'}
            {tab === 'reports' && 'Scheduled Reports'}
          </button>
        ))}
      </div>

      {activeTab === 'alerts' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
              <FiPlay /> Generate Predictive Alert
            </button>
          </div>
          <DataTable
            columns={alertCols}
            data={alerts}
            actions={(row) => row.status === 'active' && (
              <button className="btn btn-icon btn-secondary" onClick={() => handleDismiss(row)} title="Dismiss">
                <FiX />
              </button>
            )}
          />
          {showGenerate && (
            <Modal title="Generate Predictive Alert" onClose={() => setShowGenerate(false)}>
              <div className="form">
                <label>Sensor ID<input value={genSensorId} onChange={(e) => setGenSensorId(e.target.value)} /></label>
                <label>Product Type (optional)<input value={genProductType} onChange={(e) => setGenProductType(e.target.value)} /></label>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={handleGenerateAlert}>Generate</button>
                  <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {activeTab === 'trend' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="Sensor ID"
              value={trendSensorId}
              onChange={(e) => setTrendSensorId(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
            <button className="btn btn-primary" onClick={handleFetchTrend}>Load 24h Trend</button>
          </div>
          {trendData && (
            <div className="card" style={{ padding: 16 }}>
              <h3>Trend for {trendData.sensorId} (last {trendData.windowHours}h)</h3>
              <p>Total anomalies in window: <strong>{trendData.totalAnomalies}</strong></p>
              <DataTable
                columns={[
                  { key: 'bucket', label: 'Hour', render: (v) => new Date(v).toLocaleString() },
                  { key: 'avgTemp', label: 'Avg °C' },
                  { key: 'minTemp', label: 'Min' },
                  { key: 'maxTemp', label: 'Max' },
                  { key: 'avgHumidity', label: 'Avg Humidity' },
                  { key: 'readings', label: 'Readings' },
                  { key: 'anomalies', label: 'Anomalies', render: (v) => <span className={Number(v) > 0 ? 'badge badge-danger' : 'badge badge-success'}>{v}</span> },
                ]}
                data={trendData.buckets || []}
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'iot' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowIotModal(true)}>
              <FiKey /> Issue API Key
            </button>
          </div>
          {issuedKey && (
            <div className="card" style={{ padding: 12, margin: '8px 0', background: '#fff3cd', border: '1px solid #ffc107' }}>
              <strong>Save this API key — it will not be shown again:</strong>
              <pre style={{ background: '#f8f9fa', padding: 8, marginTop: 8, fontSize: 12 }}>{issuedKey}</pre>
              <button className="btn btn-secondary" onClick={() => setIssuedKey(null)}>Dismiss</button>
            </div>
          )}
          <DataTable
            columns={iotCols}
            data={iotSources}
            actions={(row) => row.active && (
              <button className="btn btn-icon btn-danger" onClick={() => handleRevokeIot(row)} title="Revoke">
                <FiTrash2 />
              </button>
            )}
          />
          {showIotModal && (
            <Modal title="Issue IoT Source API Key" onClose={() => setShowIotModal(false)}>
              <div className="form">
                <label>Source Name<input value={iotForm.name} onChange={(e) => setIotForm({ ...iotForm, name: e.target.value })} /></label>
                <label>Vendor<input value={iotForm.vendor} onChange={(e) => setIotForm({ ...iotForm, vendor: e.target.value })} /></label>
                <p style={{ fontSize: 12, color: '#666' }}>POST readings to /api/predictive/iot/ingest with header X-IoT-API-Key.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={handleCreateIot}>Issue Key</button>
                  <button className="btn btn-secondary" onClick={() => setShowIotModal(false)}>Cancel</button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {activeTab === 'reports' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowReportModal(true)}>
              <FiPlus /> Schedule Report
            </button>
          </div>
          <DataTable
            columns={reportCols}
            data={reports}
            actions={(row) => (
              <button className="btn btn-icon btn-danger" onClick={() => handleDeleteReport(row)} title="Delete">
                <FiTrash2 />
              </button>
            )}
          />
          {showReportModal && (
            <Modal title="Schedule Compliance Report" onClose={() => setShowReportModal(false)}>
              <div className="form">
                <label>Name<input value={reportForm.name} onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })} /></label>
                <label>Report Type
                  <select value={reportForm.reportType} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })}>
                    <option value="compliance">Compliance Summary</option>
                    <option value="incident">Incident Summary</option>
                    <option value="temperature">Temperature Logs</option>
                    <option value="carrier">Carrier Performance</option>
                  </select>
                </label>
                <label>Format
                  <select value={reportForm.format} onChange={(e) => setReportForm({ ...reportForm, format: e.target.value })}>
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                  </select>
                </label>
                <label>Cron Schedule<input value={reportForm.scheduleCron} onChange={(e) => setReportForm({ ...reportForm, scheduleCron: e.target.value })} placeholder="0 0 * * MON" /></label>
                <label>Recipients (comma-separated emails)<input value={reportForm.recipients} onChange={(e) => setReportForm({ ...reportForm, recipients: e.target.value })} /></label>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={handleCreateReport}>Schedule</button>
                  <button className="btn btn-secondary" onClick={() => setShowReportModal(false)}>Cancel</button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
