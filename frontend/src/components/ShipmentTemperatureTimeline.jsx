import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function ShipmentTemperatureTimeline() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    apiRequest('/custom-views/shipment-timeline')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return <div>Loading shipment timelines...</div>;

  const shipments = data.shipments || [];
  const ship = shipments[selected] || shipments[0];
  const W = 720, H = 220, P = 40;
  const temps = ship.timeline.map((p) => p.tempC);
  const minT = Math.min(...temps, ship.rangeLowC) - 2;
  const maxT = Math.max(...temps, ship.rangeHighC) + 2;
  const xStep = (W - P * 2) / (ship.timeline.length - 1);
  const yScale = (t) => H - P - ((t - minT) / (maxT - minT)) * (H - P * 2);

  const path = ship.timeline.map((p, i) => `${i === 0 ? 'M' : 'L'} ${P + i * xStep} ${yScale(p.tempC)}`).join(' ');
  const bandTop = yScale(ship.rangeHighC);
  const bandBot = yScale(ship.rangeLowC);

  return (
    <div data-testid="viz-timeline" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0b3d91' }}>Shipment Temperature Timeline (24h)</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {shipments.map((s, i) => (
          <button key={s.shipmentId} onClick={() => setSelected(i)}
            style={{
              padding: '6px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              border: '1px solid ' + (i === selected ? '#0b3d91' : '#d1d5db'),
              background: i === selected ? '#0b3d91' : '#fff',
              color: i === selected ? '#fff' : '#374151',
            }}>
            {s.shipmentId} · {s.product}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        Range: {ship.rangeLowC}°C to {ship.rangeHighC}°C · Breaches: <b style={{ color: ship.breaches ? '#dc2626' : '#16a34a' }}>{ship.breaches}</b> · Excursion Risk: {ship.excursionRiskPct}%
      </div>
      <svg width={W} height={H} style={{ maxWidth: '100%', height: 'auto', background: '#f9fafb' }}>
        <rect x={P} y={bandTop} width={W - P * 2} height={bandBot - bandTop} fill="rgba(16,185,129,0.15)" />
        <line x1={P} y1={bandTop} x2={W - P} y2={bandTop} stroke="#10b981" strokeDasharray="4 3" />
        <line x1={P} y1={bandBot} x2={W - P} y2={bandBot} stroke="#10b981" strokeDasharray="4 3" />
        <path d={path} fill="none" stroke="#0b3d91" strokeWidth="2" />
        {ship.timeline.map((p, i) => (
          <circle key={i} cx={P + i * xStep} cy={yScale(p.tempC)} r={p.inRange ? 3 : 5}
            fill={p.inRange ? '#0b3d91' : '#dc2626'} />
        ))}
        <text x={P} y={H - 8} fontSize="10" fill="#6b7280">0h</text>
        <text x={W - P - 18} y={H - 8} fontSize="10" fill="#6b7280">24h</text>
        <text x={5} y={P} fontSize="10" fill="#6b7280">{maxT.toFixed(1)}°C</text>
        <text x={5} y={H - P} fontSize="10" fill="#6b7280">{minT.toFixed(1)}°C</text>
      </svg>
    </div>
  );
}
