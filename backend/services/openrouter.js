import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(systemPrompt, userPrompt) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Cold Chain Monitoring',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
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

export async function analyzeSpoilage(product) {
  const systemPrompt = `You are an expert food safety and cold chain analyst. Analyze spoilage risk for perishable products. Provide your response in a structured format with these sections:
- Risk Level (Critical / High / Medium / Low)
- Confidence (percentage)
- Predicted Spoilage Date
- Key Risk Factors (bullet points)
- Recommendations (bullet points)`;

  const userPrompt = `Analyze spoilage risk for the following product:
Product: ${product.product_name || 'Unknown'}
Type: ${product.product_type || 'Unknown'}
Current Temperature: ${product.current_temp}°C
Required Storage Temperature: ${product.storage_temp}°C
Quantity: ${product.quantity} ${product.unit || 'units'}
Manufacture Date: ${product.manufacture_date || 'N/A'}
Expiry Date: ${product.expiry_date || 'N/A'}
Batch ID: ${product.batch_id || 'N/A'}

Based on cold chain best practices, predict the spoilage timeline and risk factors.`;

  return callOpenRouter(systemPrompt, userPrompt);
}

export async function assessCompliance(record) {
  const systemPrompt = `You are an FDA and HACCP compliance expert specializing in cold chain regulations. Assess compliance status and provide actionable findings. Structure your response with:
- Compliance Status (Compliant / Non-Compliant / Needs Review)
- Risk Rating (Critical / High / Medium / Low)
- Key Findings (bullet points)
- Regulatory References
- Corrective Actions Required (bullet points)
- Timeline for Remediation`;

  const userPrompt = `Assess compliance for the following record:
Regulation: ${record.regulation || 'N/A'}
Standard: ${record.standard || 'N/A'}
Category: ${record.category || 'N/A'}
Facility: ${record.facility || 'N/A'}
Current Status: ${record.status || 'N/A'}
Priority: ${record.priority || 'N/A'}
Last Audit: ${record.last_audit || 'N/A'}
Next Audit: ${record.next_audit || 'N/A'}
Findings: ${record.findings || 'None recorded'}
Notes: ${record.notes || 'None'}

Provide a thorough compliance assessment based on FDA 21 CFR Part 1, FSMA, and HACCP standards.`;

  return callOpenRouter(systemPrompt, userPrompt);
}

export async function scoreCarrier(carrier) {
  const systemPrompt = `You are a cold chain logistics analyst. Evaluate carrier performance and provide a comprehensive scoring analysis. Structure your response with:
- Overall Score (out of 100)
- Performance Rating (Excellent / Good / Average / Below Average / Poor)
- Strengths (bullet points)
- Weaknesses (bullet points)
- Risk Assessment
- Recommendations for Improvement (bullet points)
- Comparison to Industry Benchmarks`;

  const userPrompt = `Score and analyze the following carrier:
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
Status: ${carrier.status || 'N/A'}

Evaluate this carrier's reliability for cold chain transportation.`;

  return callOpenRouter(systemPrompt, userPrompt);
}

export async function analyzeIncident(incident) {
  const systemPrompt = `You are a cold chain incident investigation specialist. Analyze incidents and provide root cause analysis with corrective actions. Structure your response with:
- Severity Assessment (Critical / High / Medium / Low)
- Root Cause Analysis
- Contributing Factors (bullet points)
- Immediate Corrective Actions (bullet points)
- Long-term Preventive Measures (bullet points)
- Regulatory Implications
- Estimated Impact`;

  const userPrompt = `Analyze the following cold chain incident:
Title: ${incident.title}
Type: ${incident.incident_type || 'N/A'}
Severity: ${incident.severity || 'N/A'}
Date: ${incident.date || 'N/A'}
Location: ${incident.location || 'N/A'}
Facility: ${incident.facility || 'N/A'}
Product Affected: ${incident.product_affected || 'N/A'}
Temperature Recorded: ${incident.temperature_recorded || 'N/A'}°C
Description: ${incident.description || 'No description provided'}
Current Status: ${incident.status || 'N/A'}

Provide a thorough incident analysis with root cause and corrective actions.`;

  return callOpenRouter(systemPrompt, userPrompt);
}

export async function analyzeTemperature(reading) {
  const systemPrompt = `You are a cold chain temperature monitoring expert. Analyze temperature readings for anomalies and compliance issues. Structure your response with:
- Status Assessment (Normal / Warning / Critical / Alert)
- Anomaly Detection (any deviations found)
- Compliance Check (within thresholds or not)
- Risk to Product Quality
- Recommended Actions (bullet points)
- Trend Analysis`;

  const userPrompt = `Analyze the following temperature reading:
Sensor ID: ${reading.sensor_id || 'N/A'}
Location: ${reading.location || 'N/A'}
Zone: ${reading.zone || 'N/A'}
Product Type: ${reading.product_type || 'N/A'}
Temperature: ${reading.temperature}°${reading.unit || 'C'}
Humidity: ${reading.humidity || 'N/A'}%
Min Threshold: ${reading.min_threshold || 'N/A'}°${reading.unit || 'C'}
Max Threshold: ${reading.max_threshold || 'N/A'}°${reading.unit || 'C'}
Current Status: ${reading.status || 'N/A'}
Timestamp: ${reading.timestamp || 'N/A'}

Determine if this reading indicates any anomalies or compliance issues for cold chain storage.`;

  return callOpenRouter(systemPrompt, userPrompt);
}
