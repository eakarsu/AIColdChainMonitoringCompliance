/*
 * 3PL / pharma white-label: 3PL and pharma distributor multi-tenant config
 *
 * Custom Feature Suggestion (apply pass 6 — audit batch_01)
 * Suggestion: 3PL and pharma distributor multi-tenant config
 *
 * v0 scaffold: returns 503 when OPENROUTER_API_KEY missing; otherwise calls
 * OpenRouter via built-in https module. Lean handler — no DB writes.
 */
import express from 'express';
import https from 'https';

const router = express.Router();

// Best-effort auth — projects vary; fall through if not available.
let authMiddleware = (req, res, next) => next();
try {
  const m = await import('../middleware/auth.js');
  const cand = m.default || m.authenticate || m.authenticateToken || m.requireAuth;
  if (typeof cand === 'function') authMiddleware = cand;
} catch (_) { /* no auth available */ }

function callOpenRouter(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return reject(Object.assign(new Error('OPENROUTER_API_KEY not configured'), { code: 'MISSING_KEY' }));
    const body = JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
    });
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (resp) => {
      let data = '';
      resp.on('data', (c) => (data += c));
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('OpenRouter timeout')));
    req.write(body);
    req.end();
  });
}

function parseAIJson(text) {
  if (!text) return null;
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch (_) {}
  const fence = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) {} }
  const obj = String(text).match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch (_) {} }
  return { raw_response: String(text) };
}

router.use(authMiddleware);

router.post('/run', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI unavailable', missing: 'OPENROUTER_API_KEY', feature: 'three_pl_pharma' });
    }
    const payload = req.body || {};
    const userPrompt = `Context (JSON):\n${JSON.stringify(payload).slice(0, 4000)}\n\nTask: ${'3PL / pharma white-label'}\n\nReturn JSON {"summary": string, "actions": [string], "risks": [string], "confidence": number_0_to_1}.`;
    const systemPrompt = `You are a $'3PL/pharma distributor white-label provisioner'. Respond with strict JSON.`;
    const aiResp = await callOpenRouter(userPrompt, systemPrompt);
    const content = aiResp?.choices?.[0]?.message?.content ?? aiResp?.raw ?? '';
    const parsed = parseAIJson(content);
    return res.json({ feature: 'three_pl_pharma', model: aiResp?.model, parsed, raw: content });
  } catch (err) {
    if (err && err.code === 'MISSING_KEY') {
      return res.status(503).json({ error: 'AI unavailable', missing: 'OPENROUTER_API_KEY' });
    }
    return res.status(500).json({ error: 'Feature failed', details: String(err.message || err) });
  }
});

router.get('/health', (req, res) => res.json({ feature: 'three_pl_pharma', ok: true, ai_configured: !!process.env.OPENROUTER_API_KEY }));

// TODO: configure credentials — extend payload validation, persist results to
// the project's existing ai_results table, and wire frontend page.

export default router;
