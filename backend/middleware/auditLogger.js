import pool from '../db.js';

export async function logAudit(entityType, entityId, action, user, changes = null) {
  try {
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action, user_name, user_email, changes) VALUES ($1, $2, $3, $4, $5, $6)',
      [entityType, entityId, action, user?.name || 'System', user?.email || 'system', changes ? JSON.stringify(changes) : null]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
