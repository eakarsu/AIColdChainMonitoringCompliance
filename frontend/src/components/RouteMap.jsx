import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function RouteMap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiRequest('/custom-views/route-map').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#dc2626' }}>Error: {err}</div>;
  if (!data) return <div>Loading route map...</div>;

  const { routes, mapBounds } = data;
  const W = 720, H = 360, P = 30;
  const proj = (lat, lon) => ({
    x: P + ((lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * (W - P * 2),
    y: H - P - ((lat - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * (H - P * 2),
  });
  const colors = { 'RT-A': '#0b3d91', 'RT-B': '#7c3aed', 'RT-C': '#0891b2' };
  const statusColor = { ok: '#16a34a', warn: '#f59e0b', breach: '#dc2626' };

  return (
    <div data-testid="viz-routemap" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0b3d91' }}>Cold-Chain Route Map (US)</h3>
      <svg width={W} height={H} style={{ maxWidth: '100%', height: 'auto', background: '#eff6ff' }}>
        <rect x={P} y={P} width={W - P * 2} height={H - P * 2} fill="none" stroke="#cbd5e1" strokeDasharray="3 3" />
        {routes.map((r) => {
          const pts = r.waypoints.map((w) => proj(w.lat, w.lon));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={r.id}>
              <path d={d} fill="none" stroke={colors[r.id]} strokeWidth="2.5" opacity="0.8" />
              {r.waypoints.map((w, i) => {
                const p = pts[i];
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="7" fill={statusColor[w.status]} stroke="#fff" strokeWidth="2" />
                    <text x={p.x + 9} y={p.y + 3} fontSize="10" fill="#1f2937">{w.label} ({w.tempC}°C)</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <g transform={`translate(${W - 150}, 20)`}>
          {routes.map((r, i) => (
            <g key={r.id} transform={`translate(0, ${i * 16})`}>
              <line x1="0" y1="6" x2="20" y2="6" stroke={colors[r.id]} strokeWidth="3" />
              <text x="24" y="10" fontSize="11" fill="#1f2937">{r.id}: {r.from} → {r.to}</text>
            </g>
          ))}
        </g>
      </svg>
      <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#16a34a', marginRight: 4 }}></span>In Range</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#f59e0b', marginRight: 4 }}></span>Warning</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#dc2626', marginRight: 4 }}></span>Breach</span>
      </div>
    </div>
  );
}
