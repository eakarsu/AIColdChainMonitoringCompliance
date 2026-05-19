import fetch from 'node-fetch';
import { parseAIJson } from '../utils/parseAIJson.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(systemPrompt, userPrompt, opts = {}) {
  if (!OPENROUTER_API_KEY) {
    return { success: false, content: null, error: 'OpenRouter API key not configured' };
  }
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cold Chain Monitoring',
      },
      body: JSON.stringify({
        model: opts.model || OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.max_tokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, content: null, error: `OpenRouter API error ${response.status}: ${errBody}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { success: true, content, usage: data.usage };
  } catch (err) {
    return { success: false, content: null, error: err.message };
  }
}

// Helper for structured JSON responses (3-strategy parser)
export async function callOpenRouterJson(systemPrompt, userPrompt, opts = {}) {
  const result = await callOpenRouter(systemPrompt, userPrompt, opts);
  if (!result.success) return result;
  const parsed = parseAIJson(result.content);
  return { success: true, content: result.content, parsed: parsed.data, parseStrategy: parsed.strategy, parseSuccess: parsed.success, usage: result.usage };
}

export async function analyzeSpoilage(product) {
  const systemPrompt = `You are an expert food safety and cold chain analyst. Analyze spoilage risk for perishable products. Always respond with VALID JSON only matching the schema requested.`;

  const userPrompt = `Analyze spoilage risk for the following product and respond ONLY with valid JSON matching this schema:
{
  "risk_level": "Critical|High|Medium|Low",
  "confidence_pct": 85,
  "predicted_spoilage_date": "YYYY-MM-DD",
  "key_risk_factors": ["factor 1", "factor 2"],
  "recommendations": ["action 1", "action 2"],
  "estimated_shelf_life_hours": 48,
  "summary": "brief assessment"
}

Product Information:
Product: ${product.product_name || 'Unknown'}
Type: ${product.product_type || 'Unknown'}
Current Temperature: ${product.current_temp}°C
Required Storage Temperature: ${product.storage_temp}°C
Quantity: ${product.quantity} ${product.unit || 'units'}
Manufacture Date: ${product.manufacture_date || 'N/A'}
Expiry Date: ${product.expiry_date || 'N/A'}
Batch ID: ${product.batch_id || 'N/A'}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

export async function assessCompliance(record) {
  const systemPrompt = `You are an FDA and HACCP compliance expert specializing in cold chain regulations. Always respond with valid JSON only.`;

  const userPrompt = `Assess compliance for the record below. Respond ONLY with valid JSON matching this schema:
{
  "compliance_status": "Compliant|Non-Compliant|Needs Review",
  "risk_rating": "Critical|High|Medium|Low",
  "key_findings": ["finding 1", "finding 2"],
  "regulatory_references": ["FDA 21 CFR 1.900", "HACCP 5.1"],
  "corrective_actions": ["action 1", "action 2"],
  "remediation_timeline_days": 30,
  "summary": "brief"
}

Record:
Regulation: ${record.regulation || 'N/A'}
Standard: ${record.standard || 'N/A'}
Category: ${record.category || 'N/A'}
Facility: ${record.facility || 'N/A'}
Status: ${record.status || 'N/A'}
Priority: ${record.priority || 'N/A'}
Last Audit: ${record.last_audit || 'N/A'}
Next Audit: ${record.next_audit || 'N/A'}
Findings: ${record.findings || 'None recorded'}
Notes: ${record.notes || 'None'}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

export async function scoreCarrier(carrier) {
  const systemPrompt = `You are a cold chain logistics analyst. Always respond with valid JSON only.`;

  const userPrompt = `Score the carrier and respond ONLY with valid JSON matching this schema:
{
  "overall_score": 85,
  "performance_rating": "Excellent|Good|Average|Below Average|Poor",
  "strengths": ["strength 1"],
  "weaknesses": ["weakness 1"],
  "risk_assessment": "brief description",
  "recommendations": ["recommendation 1"],
  "industry_benchmark_comparison": "brief comparison"
}

Carrier Information:
Name: ${carrier.name}
Code: ${carrier.code || 'N/A'}
Current Score: ${carrier.score || 'Unrated'}
On-Time Rate: ${carrier.on_time_rate || 'N/A'}%
Temperature Compliance Rate: ${carrier.temp_compliance_rate || 'N/A'}%
Incident Count: ${carrier.incident_count || 0}
Total Shipments: ${carrier.total_shipments || 0}
Routes: ${carrier.routes || 'N/A'}
Fleet Size: ${carrier.fleet_size || 'N/A'}
Certification: ${carrier.certification || 'N/A'}
Insurance Rating: ${carrier.insurance_rating || 'N/A'}
Status: ${carrier.status || 'N/A'}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

export async function analyzeIncident(incident) {
  const systemPrompt = `You are a cold chain incident investigation specialist. Always respond with valid JSON only.`;

  const userPrompt = `Analyze the incident and respond ONLY with valid JSON matching this schema:
{
  "severity_assessment": "Critical|High|Medium|Low",
  "root_cause": "primary root cause",
  "contributing_factors": ["factor 1"],
  "immediate_corrective_actions": ["action 1"],
  "long_term_preventive_measures": ["measure 1"],
  "regulatory_implications": "brief description",
  "estimated_impact_usd": 5000,
  "estimated_resolution_hours": 24
}

Incident:
Title: ${incident.title}
Type: ${incident.incident_type || 'N/A'}
Severity: ${incident.severity || 'N/A'}
Date: ${incident.date || 'N/A'}
Location: ${incident.location || 'N/A'}
Facility: ${incident.facility || 'N/A'}
Product Affected: ${incident.product_affected || 'N/A'}
Temperature Recorded: ${incident.temperature_recorded || 'N/A'}°C
Description: ${incident.description || 'No description provided'}
Status: ${incident.status || 'N/A'}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

export async function analyzeTemperature(reading) {
  const systemPrompt = `You are a cold chain temperature monitoring expert. Always respond with valid JSON only.`;

  const userPrompt = `Analyze the temperature reading and respond ONLY with valid JSON matching this schema:
{
  "status_assessment": "Normal|Warning|Critical|Alert",
  "anomaly_detected": true,
  "compliance_check": "within_thresholds|out_of_thresholds",
  "risk_to_quality": "high|medium|low|none",
  "recommended_actions": ["action 1"],
  "trend": "stable|increasing|decreasing",
  "confidence_pct": 90,
  "summary": "brief"
}

Reading:
Sensor ID: ${reading.sensor_id || 'N/A'}
Location: ${reading.location || 'N/A'}
Zone: ${reading.zone || 'N/A'}
Product Type: ${reading.product_type || 'N/A'}
Temperature: ${reading.temperature}°${reading.unit || 'C'}
Humidity: ${reading.humidity || 'N/A'}%
Min Threshold: ${reading.min_threshold || 'N/A'}°${reading.unit || 'C'}
Max Threshold: ${reading.max_threshold || 'N/A'}°${reading.unit || 'C'}
Status: ${reading.status || 'N/A'}
Timestamp: ${reading.timestamp || 'N/A'}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

// NEW: Predictive alert (NEW custom feature)
export async function predictAlert(historicalData) {
  const systemPrompt = `You are a predictive analytics expert for cold chain monitoring. Predict future alerts based on historical patterns. Always respond with valid JSON only.`;

  const userPrompt = `Analyze historical patterns and predict potential alerts. Respond ONLY with valid JSON:
{
  "alert_probability_pct": 75,
  "predicted_alert_window_hours": 6,
  "predicted_severity": "Critical|High|Medium|Low",
  "trend_direction": "deteriorating|improving|stable",
  "primary_risk_factor": "description",
  "preventive_recommendations": ["action 1", "action 2"],
  "confidence_pct": 85
}

Historical Data:
${JSON.stringify(historicalData, null, 2).slice(0, 4000)}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

// NEW: Spoilage Cost Calculator
export async function calculateSpoilageCost(spoilage) {
  const systemPrompt = `You are a financial analyst specializing in cold chain loss valuation. Always respond with valid JSON only.`;

  const userPrompt = `Calculate the estimated financial impact of this spoilage. Respond ONLY with valid JSON:
{
  "estimated_loss_usd": 12500,
  "loss_breakdown": {
    "product_value_usd": 10000,
    "disposal_cost_usd": 500,
    "regulatory_fines_usd": 1000,
    "reputation_impact_usd": 1000
  },
  "insurance_claim_eligible": true,
  "recommended_claim_amount_usd": 11500,
  "documentation_needed": ["temperature logs", "receipts"],
  "preventive_roi_estimate": "calculation details"
}

Spoilage Information:
Product: ${spoilage.product_name}
Quantity: ${spoilage.quantity} ${spoilage.unit || 'units'}
Risk Level: ${spoilage.risk_level}
Predicted Spoilage Date: ${spoilage.predicted_spoilage_date || 'N/A'}
Storage Temp: ${spoilage.storage_temp}°C
Current Temp: ${spoilage.current_temp}°C`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

// NEW: Multi-Facility Aggregation Insights
export async function analyzeMultiFacility(facilitySummaries) {
  const systemPrompt = `You are a cold chain operations analyst. Compare and benchmark performance across facilities. Always respond with valid JSON only.`;

  const userPrompt = `Analyze the performance across facilities. Respond ONLY with valid JSON:
{
  "top_performers": ["facility 1"],
  "needs_attention": ["facility 2"],
  "compliance_leaders": ["facility 1"],
  "compliance_laggards": ["facility 3"],
  "key_insights": ["insight 1", "insight 2"],
  "recommended_actions": ["action 1"],
  "benchmark_compliance_rate": 92,
  "executive_summary": "brief"
}

Facility Data:
${JSON.stringify(facilitySummaries, null, 2).slice(0, 4000)}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}

// NEW: Regulatory Change Impact Assessment
export async function assessRegulatoryChange(change) {
  const systemPrompt = `You are a regulatory compliance expert tracking FDA, HACCP, and FSMA updates. Always respond with valid JSON only.`;

  const userPrompt = `Assess the impact of this regulatory change. Respond ONLY with valid JSON:
{
  "impact_level": "Critical|High|Medium|Low",
  "affected_categories": ["dairy", "meat"],
  "compliance_changes_required": ["change 1"],
  "implementation_priority": "Immediate|High|Medium|Low",
  "estimated_implementation_days": 30,
  "training_recommendations": ["topic 1"],
  "documentation_updates_needed": ["doc 1"],
  "summary": "brief"
}

Regulatory Change:
${JSON.stringify(change, null, 2).slice(0, 2000)}`;

  return callOpenRouterJson(systemPrompt, userPrompt);
}
