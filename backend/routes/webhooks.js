/**
 * Webhook routes — re-exports the webhook configuration endpoint from alerts.js
 * so the /api/webhooks prefix is served by a dedicated file.
 *
 * Full implementation (deliverWebhook, fireCriticalWebhooks, POST /webhook/configure)
 * lives in alerts.js to avoid circular imports, since the temperature route also
 * imports fireCriticalWebhooks from there.
 */
import { Router } from 'express';
import pool from '../db.js';
import authenticate from '../middleware/auth.js';
import fetch from 'node-fetch';

const router = Router();

// ─── Webhook delivery with retry (exponential backoff, 3 attempts) ────────────
async function deliverWebhook(webhookUrl, payload, attempt = 1) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      setTimeout(() => deliverWebhook(webhookUrl, payload, attempt + 1), delay);
    } else {
      console.error(`Webhook delivery failed after 3 attempts to ${webhookUrl}:`, err.message);
    }
  }
}

// ─── POST /api/webhooks/configure — store webhook URL per user ────────────────
router.post('/configure', authenticate, async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url is required' });
    }

    // Basic URL validation
    try {
      new URL(webhook_url);
    } catch {
      return res.status(400).json({ error: 'webhook_url must be a valid URL' });
    }

    const userId = req.user.id;
    try {
      await pool.query(`
        INSERT INTO webhook_configs (user_id, webhook_url, active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET webhook_url = EXCLUDED.webhook_url, active = true, updated_at = NOW()
      `, [userId, webhook_url]);
    } catch (dbErr) {
      console.error('DB error saving webhook:', dbErr.message);
      return res.status(500).json({ error: 'Failed to save webhook — ensure webhook_configs table exists' });
    }

    res.json({ message: 'Webhook configured successfully', webhook_url, active: true });
  } catch (err) {
    console.error('Error configuring webhook:', err);
    res.status(500).json({ error: 'Failed to configure webhook' });
  }
});

// ─── GET /api/webhooks — list webhooks for current user ──────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT id, webhook_url, active, created_at, updated_at FROM webhook_configs WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing webhooks:', err);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// ─── DELETE /api/webhooks/:id — deactivate a webhook ─────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'UPDATE webhook_configs SET active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ message: 'Webhook deactivated', webhook: result.rows[0] });
  } catch (err) {
    console.error('Error deactivating webhook:', err);
    res.status(500).json({ error: 'Failed to deactivate webhook' });
  }
});

export { deliverWebhook };
export default router;
