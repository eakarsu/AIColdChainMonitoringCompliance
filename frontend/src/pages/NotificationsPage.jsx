import React, { useEffect, useState, useCallback } from 'react';
import { FiBell, FiCheck, FiTrash2, FiCheckCircle, FiPlus } from 'react-icons/fi';
import {
  fetchNotifications,
  fetchNotificationsUnreadCount,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../api';
import { showToast } from '../utils/toast';

const typeBadge = (val) => {
  const map = { info: 'badge-info', success: 'badge-success', warning: 'badge-warning', error: 'badge-danger' };
  return <span className={`badge ${map[val] || 'badge-info'}`}>{val || 'info'}</span>;
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', type: 'info', user_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchNotifications()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.notifications || res.items || res.data || []);
        setItems(list);
      })
      .catch(() => {
        showToast('Failed to load notifications', 'error');
        setItems([]);
      })
      .finally(() => setLoading(false));
    fetchNotificationsUnreadCount()
      .then((res) => setUnread(res.count ?? res.unread ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { ...form };
      if (!body.user_id) delete body.user_id;
      await createNotification(body);
      showToast('Notification created', 'success');
      setShowForm(false);
      setForm({ title: '', message: '', type: 'info', user_id: '' });
      load();
    } catch (err) {
      showToast(err.message || 'Failed to create', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id) => {
    try { await markNotificationRead(id); showToast('Marked read', 'success'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleMarkAll = async () => {
    try { await markAllNotificationsRead(); showToast('All marked read', 'success'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try { await deleteNotification(id); showToast('Deleted', 'info'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiBell style={{ marginRight: 8, verticalAlign: 'middle' }} />Notifications</h2>
          <p>{unread} unread</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleMarkAll}><FiCheckCircle /> Mark all read</button>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}><FiPlus /> {showForm ? 'Cancel' : 'New Notification'}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, marginBottom: 20, maxWidth: 600 }}>
          <div className="form-group">
            <label>Title</label>
            <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea className="form-control" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={3} />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="form-group">
            <label>User ID (optional)</label>
            <input className="form-control" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id}>
                  <td><strong>{n.title}</strong></td>
                  <td>{n.message}</td>
                  <td>{typeBadge(n.type)}</td>
                  <td>{(n.read || n.is_read) ? <span className="badge badge-success">read</span> : <span className="badge badge-warning">unread</span>}</td>
                  <td>{n.created_at ? new Date(n.created_at).toLocaleString() : '—'}</td>
                  <td>
                    {!(n.read || n.is_read) && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handleMarkRead(n.id)}><FiCheck /></button>
                    )}{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(n.id)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted, #888)' }}>No notifications</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
