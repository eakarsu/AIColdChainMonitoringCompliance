import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

const statusStyle = {
  ok: { background: '#dcfce7', color: '#166534' },
  'due-soon': { background: '#fef3c7', color: '#92400e' },
  overdue: { background: '#fee2e2', color: '#991b1b' },
};

export default function CalibrationScheduler() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    apiRequest('/custom-views/calibration-schedule').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return <div>Loading calibration schedule...</div>;

  const rows = data.sensors.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div data-testid="non-viz-calibration" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0b3d91' }}>Sensor Calibration Scheduler</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, padding: '4px 10px', background: '#dcfce7', color: '#166534', borderRadius: 4 }}>OK: {data.summary.ok}</span>
        <span style={{ fontSize: 12, padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: 4 }}>Due Soon: {data.summary.dueSoon}</span>
        <span style={{ fontSize: 12, padding: '4px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 4 }}>Overdue: {data.summary.overdue}</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, marginLeft: 'auto' }}>
          <option value="all">All</option>
          <option value="ok">OK</option>
          <option value="due-soon">Due Soon</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>Sensor</th>
              <th style={{ padding: 6 }}>Zone</th>
              <th style={{ padding: 6 }}>Model</th>
              <th style={{ padding: 6 }}>Last Cal</th>
              <th style={{ padding: 6 }}>Next Due</th>
              <th style={{ padding: 6 }}>Days</th>
              <th style={{ padding: 6 }}>Tech</th>
              <th style={{ padding: 6 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: 6, fontWeight: 600 }}>{s.id}</td>
                <td style={{ padding: 6 }}>{s.zone}</td>
                <td style={{ padding: 6 }}>{s.model}</td>
                <td style={{ padding: 6 }}>{s.lastCalibratedDate}</td>
                <td style={{ padding: 6 }}>{s.nextDueDate}</td>
                <td style={{ padding: 6 }}>{s.daysUntilDue}</td>
                <td style={{ padding: 6 }}>{s.technician}</td>
                <td style={{ padding: 6 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, ...statusStyle[s.status] }}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
