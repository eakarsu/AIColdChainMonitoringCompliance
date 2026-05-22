import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

const EMPTY = { productType: '', minC: 2, maxC: 8, alarmMinC: 3, alarmMaxC: 7, regulator: 'FDA', notes: '' };

export default function ThresholdRulesEditor() {
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const reload = async () => {
    try {
      const d = await apiRequest('/custom-views/threshold-rules');
      setRules(d.rules || []);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { reload(); }, []);

  const startEdit = (r) => {
    setEditing(r.id);
    setForm({
      productType: r.productType,
      minC: r.minC,
      maxC: r.maxC,
      alarmMinC: r.alarmMinC,
      alarmMaxC: r.alarmMaxC,
      regulator: r.regulator,
      notes: r.notes || '',
    });
  };

  const cancel = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    setStatus('Saving...');
    try {
      if (editing) {
        await apiRequest(`/custom-views/threshold-rules/${editing}`, { method: 'PUT', body: form });
        setStatus(`Updated rule #${editing}.`);
      } else {
        const r = await apiRequest('/custom-views/threshold-rules', { method: 'POST', body: form });
        setStatus(`Created rule #${r.rule.id}.`);
      }
      cancel();
      await reload();
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  const remove = async (id) => {
    setStatus('Deleting...');
    try {
      await apiRequest(`/custom-views/threshold-rules/${id}`, { method: 'DELETE' });
      setStatus(`Deleted rule #${id}.`);
      await reload();
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  if (err) return <div style={{ color: '#dc2626' }}>Error: {err}</div>;

  return (
    <div data-testid="non-viz-thresholds" style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 6px', color: '#0b3d91' }}>Temperature Threshold Rules (per Product Type)</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        CRUD editor for storage thresholds. Min/Max define hard limits; Alarm Min/Max define soft alarm bands.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) auto', gap: 6, marginBottom: 12, alignItems: 'end' }}>
        <label style={{ fontSize: 11, color: '#374151', gridColumn: 'span 2' }}>
          Product Type
          <input value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}
            placeholder="e.g. Insulin"
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: '#374151' }}>
          Min °C
          <input type="number" value={form.minC} onChange={(e) => setForm({ ...form, minC: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: '#374151' }}>
          Max °C
          <input type="number" value={form.maxC} onChange={(e) => setForm({ ...form, maxC: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: '#374151' }}>
          Alarm Min
          <input type="number" value={form.alarmMinC} onChange={(e) => setForm({ ...form, alarmMinC: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: '#374151' }}>
          Alarm Max
          <input type="number" value={form.alarmMaxC} onChange={(e) => setForm({ ...form, alarmMaxC: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: '#374151' }}>
          Regulator
          <select value={form.regulator} onChange={(e) => setForm({ ...form, regulator: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}>
            <option>FDA</option>
            <option>FSMA</option>
            <option>AABB</option>
            <option>USDA</option>
            <option>EMA/GDP</option>
            <option>WHO</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save}
            style={{ padding: '8px 12px', background: '#0b3d91', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button onClick={cancel}
              style={{ padding: '8px 12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 10 }}>
        Notes
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Regulatory reference, e.g. 21 CFR 640.4"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
      </label>

      {status && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{status}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>ID</th>
              <th style={{ padding: 6 }}>Product Type</th>
              <th style={{ padding: 6 }}>Min °C</th>
              <th style={{ padding: 6 }}>Max °C</th>
              <th style={{ padding: 6 }}>Alarm Band</th>
              <th style={{ padding: 6 }}>Regulator</th>
              <th style={{ padding: 6 }}>Notes</th>
              <th style={{ padding: 6 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb', background: editing === r.id ? '#eff6ff' : 'transparent' }}>
                <td style={{ padding: 6 }}>{r.id}</td>
                <td style={{ padding: 6, fontWeight: 600 }}>{r.productType}</td>
                <td style={{ padding: 6 }}>{r.minC}</td>
                <td style={{ padding: 6 }}>{r.maxC}</td>
                <td style={{ padding: 6 }}>{r.alarmMinC} to {r.alarmMaxC}</td>
                <td style={{ padding: 6 }}><span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: 10, fontSize: 11 }}>{r.regulator}</span></td>
                <td style={{ padding: 6, color: '#6b7280' }}>{r.notes}</td>
                <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                  <button onClick={() => startEdit(r)}
                    style={{ padding: '4px 8px', background: '#fff', color: '#0b3d91', border: '1px solid #0b3d91', borderRadius: 4, cursor: 'pointer', fontSize: 11, marginRight: 4 }}>
                    Edit
                  </button>
                  <button onClick={() => remove(r.id)}
                    style={{ padding: '4px 8px', background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
