import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { apiRequest } from '../api';
import { showToast } from '../utils/toast';

const emptyDraft = {
  lotCode: '',
  productName: '',
  facility: '',
  affectedShipments: 0,
  excursionWindow: '',
  recallStatus: 'monitoring',
  riskLevel: 'medium',
  nextAction: '',
};

export default function LotRecallTracePage() {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiRequest('/lot-recall-trace')
      .then(setRows)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = (e) => {
    e.preventDefault();
    apiRequest('/lot-recall-trace', { method: 'POST', body: draft })
      .then(() => {
        setDraft(emptyDraft);
        showToast('Recall trace added', 'success');
        load();
      })
      .catch((err) => showToast(err.message, 'error'));
  };

  const remove = (id) => {
    apiRequest(`/lot-recall-trace/${id}`, { method: 'DELETE' })
      .then(load)
      .catch((err) => showToast(err.message, 'error'));
  };

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiAlertTriangle style={{ marginRight: 8, verticalAlign: 'middle' }} />Lot Recall Trace</h2>
          <p>Trace affected lots, excursions, facilities and containment actions.</p>
        </div>
        <button className="btn-secondary" onClick={load}><FiRefreshCw /> Refresh</button>
      </div>

      <form className="card" style={{ padding: 20, marginBottom: 24 }} onSubmit={save}>
        <div className="form-grid">
          {[
            ['lotCode', 'Lot Code'],
            ['productName', 'Product'],
            ['facility', 'Facility'],
            ['excursionWindow', 'Excursion Window'],
            ['nextAction', 'Next Action'],
          ].map(([key, label]) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input value={draft[key]} onChange={(e) => setField(key, e.target.value)} />
            </div>
          ))}
          <div className="form-group">
            <label>Affected Shipments</label>
            <input type="number" value={draft.affectedShipments} onChange={(e) => setField('affectedShipments', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={draft.recallStatus} onChange={(e) => setField('recallStatus', e.target.value)}>
              <option value="monitoring">Monitoring</option>
              <option value="containment">Containment</option>
              <option value="customer_notice">Customer Notice</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Risk</label>
            <select value={draft.riskLevel} onChange={(e) => setField('riskLevel', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <button className="btn-primary" type="submit">Add Trace</button>
      </form>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading traces...</span></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Lot</th><th>Product</th><th>Facility</th><th>Shipments</th><th>Status</th><th>Risk</th><th>Next Action</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.lotCode}</td>
                  <td>{row.productName}</td>
                  <td>{row.facility}</td>
                  <td>{row.affectedShipments}</td>
                  <td>{row.recallStatus}</td>
                  <td>{row.riskLevel}</td>
                  <td>{row.nextAction}</td>
                  <td><button className="icon-btn" onClick={() => remove(row.id)}><FiTrash2 /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
