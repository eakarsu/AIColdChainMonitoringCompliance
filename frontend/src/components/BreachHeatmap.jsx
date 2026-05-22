import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

const SEVERITY_COLOR = {
  0: '#dcfce7',
  1: '#fef3c7',
  2: '#fecaca',
  3: '#dc2626',
};

export default function BreachHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [hover, setHover] = useState(null);

  useEffect(() => {
    apiRequest('/custom-views/breach-heatmap').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return <div>Loading breach heatmap...</div>;

  const hours = data.hours || 24;
  const CELL = 22;
  const LABEL_W = 220;
  const TOP_H = 28;
  const W = LABEL_W + hours * CELL + 12;
  const H = TOP_H + data.shipments.length * CELL + 12;

  return (
    <div data-testid="viz-heatmap" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 6px', color: '#0b3d91' }}>Breach Heatmap (Shipment x Hour)</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        Severity of temperature excursions across 24 hours for each active shipment.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ background: '#f9fafb' }}>
          {Array.from({ length: hours }).map((_, h) => (
            <text key={h} x={LABEL_W + h * CELL + CELL / 2} y={TOP_H - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{h}</text>
          ))}
          {data.shipments.map((s, si) => (
            <g key={s.shipmentId} transform={`translate(0, ${TOP_H + si * CELL})`}>
              <text x={8} y={CELL - 7} fontSize="11" fill="#1f2937" fontWeight="600">{s.shipmentId}</text>
              <text x={88} y={CELL - 7} fontSize="11" fill="#6b7280">{s.product}</text>
              {s.cells.map((c) => (
                <rect
                  key={c.hour}
                  x={LABEL_W + c.hour * CELL}
                  y={2}
                  width={CELL - 2}
                  height={CELL - 4}
                  fill={SEVERITY_COLOR[c.severity]}
                  stroke="#fff"
                  onMouseEnter={() => setHover({ ship: s.shipmentId, product: s.product, hour: c.hour, severity: c.severity })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {data.legend.map((l) => (
          <span key={l.severity} style={{ fontSize: 12, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, background: l.color, border: '1px solid #d1d5db' }} />
            {l.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {hover
            ? `${hover.ship} (${hover.product}) @ ${hover.hour}h: severity ${hover.severity}`
            : `${data.shipments.length} shipments × ${hours} hours`}
        </span>
      </div>
      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>Shipment</th>
              <th style={{ padding: 6 }}>Product</th>
              <th style={{ padding: 6 }}>Range</th>
              <th style={{ padding: 6 }}>Breach Hours</th>
              <th style={{ padding: 6 }}>Severity Score</th>
            </tr>
          </thead>
          <tbody>
            {data.shipments.map((s) => (
              <tr key={s.shipmentId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: 6, fontWeight: 600 }}>{s.shipmentId}</td>
                <td style={{ padding: 6 }}>{s.product}</td>
                <td style={{ padding: 6 }}>{s.rangeLowC}°C to {s.rangeHighC}°C</td>
                <td style={{ padding: 6, color: s.breachCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{s.breachCount}</td>
                <td style={{ padding: 6 }}>{s.severityScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
