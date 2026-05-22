import { Router } from 'express';
import fetch from 'node-fetch';
import authenticate from '../middleware/auth.js';
import aiRateLimiter from '../middleware/rateLimiter.js';

const router = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const SYSTEM_PROMPT =
  'You are an expert cold chain compliance specialist with deep knowledge of FDA, FSMA, GDP, and WHO temperature-controlled logistics requirements.';

async function callOpenRouter(userPrompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    const err = new Error('OpenRouter API key is not configured.');
    err.status = 503;
    throw err;
  }
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Cold Chain Monitoring',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

// ─── Input validation helper ──────────────────────────────────────────────────
function validate(body, required) {
  const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
  return missing;
}

// ─── POST /api/ai/route-optimization ─────────────────────────────────────────
router.post('/route-optimization', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { shipment_data, temperature_requirements, available_carriers } = req.body;

    const missing = validate(req.body, ['shipment_data', 'temperature_requirements', 'available_carriers']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!Array.isArray(available_carriers) || available_carriers.length === 0) {
      return res.status(400).json({ error: 'available_carriers must be a non-empty array' });
    }

    const prompt = `
You are optimizing cold chain routing for the following shipment. Provide a structured recommendation.

SHIPMENT DATA:
${typeof shipment_data === 'object' ? JSON.stringify(shipment_data, null, 2) : shipment_data}

TEMPERATURE REQUIREMENTS:
${typeof temperature_requirements === 'object' ? JSON.stringify(temperature_requirements, null, 2) : temperature_requirements}

AVAILABLE CARRIERS:
${Array.isArray(available_carriers) ? available_carriers.map((c, i) => `${i + 1}. ${typeof c === 'object' ? JSON.stringify(c) : c}`).join('\n') : available_carriers}

Please provide:
1. **Optimal Carrier Selection** — which carrier is recommended and why
2. **Recommended Route** — origin → waypoints → destination with estimated transit times
3. **Risk Assessment** — temperature excursion probability, critical control points
4. **Contingency Plan** — backup carriers and alternate routes if primary fails
5. **Regulatory Compliance Notes** — FDA/FSMA/GDP requirements applicable to this shipment
6. **Estimated Compliance Score** — projected compliance score (0–100)

Format your response in clear sections with bullet points where appropriate.
    `.trim();

    const analysis = await callOpenRouter(prompt);

    res.json({
      recommendation: analysis,
      shipment_data,
      temperature_requirements,
      available_carriers,
      model: MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in route-optimization:', err);
    const status = err.status || 500;
    res.status(status).json({ error: 'Failed to generate route optimization', details: err.message });
  }
});

// ─── POST /api/ai/contamination-risk ─────────────────────────────────────────
router.post('/contamination-risk', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { temperature_excursions, product_type, exposure_duration } = req.body;

    const missing = validate(req.body, ['temperature_excursions', 'product_type', 'exposure_duration']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!Array.isArray(temperature_excursions)) {
      return res.status(400).json({ error: 'temperature_excursions must be an array' });
    }

    const prompt = `
Assess the contamination and safety risk for the following cold chain excursion event.

PRODUCT TYPE: ${product_type}
EXPOSURE DURATION: ${exposure_duration} (e.g., "2 hours", "45 minutes")

TEMPERATURE EXCURSIONS:
${temperature_excursions.map((e, i) => `${i + 1}. ${typeof e === 'object' ? JSON.stringify(e) : e}`).join('\n')}

Provide a comprehensive safety assessment including:
1. **Contamination Risk Level** — Critical / High / Medium / Low with percentage confidence
2. **Product Safety Assessment** — Is the product safe for distribution? Explain in detail.
3. **Discard Recommendation** — Should the product be discarded? Provide clear yes/no with justification.
4. **Microbial Growth Analysis** — Likely pathogens of concern for this product type and exposure profile
5. **Regulatory Reporting Requirements** — Which FDA/FSMA/GDP events must be reported, timelines, and to whom
6. **Corrective Actions** — Immediate steps to take (ranked by priority)
7. **Documentation Requirements** — What records must be retained for regulatory purposes
8. **Consumer Safety Statement** — If product were to reach consumers, what are the health risks?

Base your analysis on current FDA, USDA, WHO, and HACCP guidelines.
    `.trim();

    const assessment = await callOpenRouter(prompt);

    res.json({
      assessment,
      product_type,
      exposure_duration,
      temperature_excursions,
      model: MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in contamination-risk:', err);
    const status = err.status || 500;
    res.status(status).json({ error: 'Failed to generate contamination risk assessment', details: err.message });
  }
});

// ─── POST /api/ai/regulatory-compliance-check ───────────────────────────────
// Mechanical RAG-style check: caller passes the regulatory text excerpts + the
// shipment / facility scenario, and the LLM grades compliance against each cited rule.
router.post('/regulatory-compliance-check', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { scenario, regulatory_excerpts, jurisdiction } = req.body;

    const missing = validate(req.body, ['scenario', 'regulatory_excerpts']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!Array.isArray(regulatory_excerpts) || regulatory_excerpts.length === 0) {
      return res.status(400).json({ error: 'regulatory_excerpts must be a non-empty array' });
    }

    const prompt = `
Grade the following cold-chain scenario against the cited regulatory excerpts. For each excerpt, decide compliance.

JURISDICTION: ${jurisdiction || 'United States (FDA / FSMA / USDA)'}

SCENARIO:
${typeof scenario === 'object' ? JSON.stringify(scenario, null, 2) : scenario}

REGULATORY EXCERPTS:
${regulatory_excerpts.map((e, i) => `--- Excerpt ${i + 1} ---\n${typeof e === 'object' ? JSON.stringify(e, null, 2) : e}`).join('\n\n')}

Respond with strict JSON only of the form:
{
  "overall_status": "compliant|non_compliant|requires_review",
  "overall_score": 0-100,
  "findings": [
    {
      "excerpt_index": <int>,
      "rule_summary": "<string>",
      "status": "compliant|non_compliant|requires_review",
      "evidence_from_scenario": "<string>",
      "gap": "<string-or-empty>",
      "remediation": "<string-or-empty>",
      "severity": "low|medium|high|critical"
    }
  ],
  "narrative_summary": "<string>",
  "next_actions": ["<string>"]
}
    `.trim();

    const raw = await callOpenRouter(prompt);
    let structured = null;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) structured = JSON.parse(m[0]);
    } catch (_) {}

    res.json({
      structured,
      raw,
      jurisdiction: jurisdiction || 'United States (FDA / FSMA / USDA)',
      excerpts_evaluated: regulatory_excerpts.length,
      model: MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in regulatory-compliance-check:', err);
    const status = err.status || 500;
    res.status(status).json({ error: 'Failed to grade regulatory compliance', details: err.message });
  }
});

// ─── POST /api/ai/deviation-investigation ────────────────────────────────────
// Mechanical single-step "deviation investigation agent" — takes a breach record
// and returns a structured root-cause / 5-whys / CAPA report.
router.post('/deviation-investigation', authenticate, aiRateLimiter, async (req, res) => {
  try {
    const { breach_event, sensor_history, facility_context } = req.body;

    const missing = validate(req.body, ['breach_event']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const prompt = `
Investigate the following cold-chain temperature deviation as a quality investigator.
Apply 5-Whys + fishbone reasoning to identify likely root causes and propose CAPA.

BREACH EVENT:
${typeof breach_event === 'object' ? JSON.stringify(breach_event, null, 2) : breach_event}

SENSOR HISTORY (recent readings, optional):
${sensor_history ? (typeof sensor_history === 'object' ? JSON.stringify(sensor_history, null, 2) : sensor_history) : 'none provided'}

FACILITY / EQUIPMENT CONTEXT (optional):
${facility_context ? (typeof facility_context === 'object' ? JSON.stringify(facility_context, null, 2) : facility_context) : 'none provided'}

Respond with strict JSON only of the form:
{
  "headline": "<string>",
  "five_whys": [{"why": "<string>", "answer": "<string>"}],
  "likely_root_causes": [{"category": "people|process|equipment|environment|materials", "cause": "<string>", "confidence": "low|medium|high"}],
  "immediate_containment": ["<string>"],
  "corrective_actions": ["<string>"],
  "preventive_actions": ["<string>"],
  "regulatory_reportability": {"reportable": true|false, "rules": ["<string>"], "deadline": "<string-or-empty>"},
  "documentation_to_retain": ["<string>"]
}
    `.trim();

    const raw = await callOpenRouter(prompt);
    let structured = null;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) structured = JSON.parse(m[0]);
    } catch (_) {}

    res.json({
      structured,
      raw,
      breach_event,
      model: MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in deviation-investigation:', err);
    const status = err.status || 500;
    res.status(status).json({ error: 'Failed to investigate deviation', details: err.message });
  }
});

export default router;
