import React, { useEffect, useState, useCallback } from 'react';
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { fetchUsers, createUser, updateUser, deleteUser } from '../api';
import { showToast } from '../utils/toast';

const roleBadge = (val) => {
  const map = { admin: 'badge-danger', manager: 'badge-warning', auditor: 'badge-info', technician: 'badge-cyan', viewer: 'badge-success' };
  return <span className={`badge ${map[val] || 'badge-info'}`}>{val || '—'}</span>;
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', render: (v) => roleBadge(v) },
  { key: 'createdAt', label: 'Created', render: (v) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
];

const emptyForm = { name: '', email: '', password: '', role: 'viewer' };

export default function UsersPage() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(() => {
    fetchUsers()
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => { showToast('Failed to load users', 'error'); setData([]); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setForm({ ...emptyForm }); setEditMode(false); setShowModal(true); };
  const openEdit = (user) => { setForm({ name: user.name, email: user.email, role: user.role, password: '' }); setEditMode(true); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editMode && selected) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await updateUser(selected.id, payload);
        showToast('User updated', 'success');
      } else {
        await createUser(form);
        showToast('User created', 'success');
      }
      setShowModal(false);
      setSelected(null);
      loadData();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      showToast('User deleted', 'success');
      setSelected(null);
      loadData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiUsers style={{ marginRight: 8, verticalAlign: 'middle' }} />User Management</h2>
          <p>Manage system users and roles</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Add User</button>
      </div>

      <DataTable columns={columns} data={data} onRowClick={setSelected} />

      {selected && (
        <>
          <div className="detail-panel-overlay" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="detail-panel-header">
              <h3>User Details</h3>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}><FiX /></button>
            </div>
            <div className="detail-panel-body">
              <div className="detail-field"><div className="detail-field-label">Name</div><div className="detail-field-value">{selected.name}</div></div>
              <div className="detail-field"><div className="detail-field-label">Email</div><div className="detail-field-value">{selected.email}</div></div>
              <div className="detail-field"><div className="detail-field-label">Role</div><div className="detail-field-value">{roleBadge(selected.role)}</div></div>
              <div className="detail-field"><div className="detail-field-label">Created</div><div className="detail-field-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</div></div>
            </div>
            <div className="detail-panel-actions">
              <button className="btn btn-primary" onClick={() => openEdit(selected)}><FiEdit2 /> Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}><FiTrash2 /> Delete</button>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editMode ? 'Edit User' : 'New User'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">{editMode ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} {...(!editMode ? { required: true } : {})} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="viewer">Viewer</option>
              <option value="technician">Technician</option>
              <option value="manager">Manager</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-color)', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : editMode ? 'Update User' : 'Create User'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
