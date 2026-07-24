import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../db.js';

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin' &&
      !['1', 'true'].includes(process.env.ALLOW_SCHEMA_MIGRATION || '')) {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  const name = (process.env.PROVISION_ADMIN_NAME || 'Runtime Administrator').trim();
  if (!email || !name || password.length < 12) {
    throw new Error('Admin email, name, and a 12+ character password are required');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role, tenant_id, active)
     VALUES ($1, $2, $3, 'admin', $4, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       active = true,
       tenant_id = COALESCE(users.tenant_id, EXCLUDED.tenant_id)`,
    [email, passwordHash, name, randomUUID()]
  );
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
