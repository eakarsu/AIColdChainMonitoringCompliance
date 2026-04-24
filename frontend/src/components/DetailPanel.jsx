import React, { useState } from 'react';
import { FiX, FiEdit2, FiTrash2, FiSave, FiXCircle } from 'react-icons/fi';
import AIAnalysisDisplay from './AIAnalysisDisplay';
import { showToast } from '../utils/toast';

export default function DetailPanel({
  record,
  fields,
  onClose,
  onUpdate,
  onDelete,
  onAIAction,
  aiLabel = 'AI Analyze',
}) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!record) return null;

  const startEdit = () => {
    const data = {};
    fields.forEach((f) => {
      data[f.key] = record[f.key] ?? '';
    });
    setFormData(data);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormData({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(record._id || record.id, formData);
      showToast('Record updated successfully', 'success');
      setEditing(false);
    } catch (err) {
      showToast(err.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(record._id || record.id);
      showToast('Record deleted successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleAI = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await onAIAction(record._id || record.id);
      // Extract analysis from response (backend returns { reading/product/..., analysis })
      setAiResult(result?.analysis || result);
    } catch (err) {
      showToast(err.message || 'AI analysis failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const formatValue = (field, value) => {
    if (value == null || value === '') return '—';
    if (field.type === 'date' && value) {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (field.render) return field.render(value, record);
    return String(value);
  };

  return (
    <>
      <div className="detail-panel-overlay" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-panel-header">
          <h3>{editing ? 'Edit Record' : 'Record Details'}</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="detail-panel-body">
          {editing ? (
            <div>
              {fields
                .filter((f) => !f.readOnly)
                .map((field) => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label">{field.label}</label>
                    {field.options ? (
                      <select
                        className="form-select"
                        value={formData[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        className="form-textarea"
                        value={formData[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="form-input"
                        type={field.type || 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <>
              <div className="detail-fields-grid">
                {fields.map((field) => (
                  <div className="detail-field" key={field.key}>
                    <div className="detail-field-label">{field.label}</div>
                    <div className="detail-field-value">{formatValue(field, record[field.key])}</div>
                  </div>
                ))}
              </div>

              <AIAnalysisDisplay analysis={aiResult} loading={aiLoading} />
            </>
          )}
        </div>

        <div className="detail-panel-actions">
          {editing ? (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <FiSave />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-secondary" onClick={cancelEdit}>
                <FiXCircle />
                Cancel
              </button>
            </>
          ) : confirmDelete ? (
            <>
              <span style={{ color: 'var(--color-danger)', fontSize: '0.9rem', alignSelf: 'center' }}>
                Confirm delete?
              </span>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                Yes, Delete
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ai" onClick={handleAI} disabled={aiLoading}>
                {aiLabel}
              </button>
              <button className="btn btn-secondary" onClick={startEdit}>
                <FiEdit2 />
                Edit
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <FiTrash2 />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
