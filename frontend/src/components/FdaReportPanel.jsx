import React, { useState } from 'react';
import { getToken } from '../api';

export default function FdaReportPanel() {
  const [facility, setFacility] = useState('Chicago Cold Vault #1');
  const [status, setStatus] = useState('');

  const download = async () => {
    setStatus('Generating PDF...');
    try {
      const resp = await fetch(`/api/custom-views/fda-report.pdf?facility=${encodeURIComponent(facility)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fda_compliance_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Downloaded.');
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  return (
    <div data-testid="non-viz-fda" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0b3d91' }}>FDA-Style Compliance Report (PDF)</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0 }}>
        21 CFR Part 11 / FSMA Sanitary Transportation Rule summary. Generates a signed PDF for the selected facility.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>Facility:&nbsp;
          <select value={facility} onChange={(e) => setFacility(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}>
            <option>Chicago Cold Vault #1</option>
            <option>Newark Pharma DC</option>
            <option>Seattle Frozen Hub</option>
            <option>Miami Cross-Dock</option>
          </select>
        </label>
        <button onClick={download}
          style={{ padding: '8px 14px', background: '#0b3d91', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Download PDF
        </button>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{status}</span>
      </div>
      <ul style={{ fontSize: 12, color: '#374151', marginTop: 12 }}>
        <li>Includes: Executive summary, zone uptime table, CAPA findings, attestation.</li>
        <li>Format: US Letter, Helvetica, signed PDF stream from backend (pdfkit).</li>
      </ul>
    </div>
  );
}
