import React, { useState } from 'react';
import { FiPlay, FiTruck, FiAlertTriangle, FiFileText, FiSearch } from 'react-icons/fi';
import AIAnalysisDisplay from '../components/AIAnalysisDisplay';
import { aiRouteOptimization, aiContaminationRisk, aiRegulatoryComplianceCheck, aiDeviationInvestigation } from '../api';
import { showToast } from '../utils/toast';

const SAMPLE_SHIPMENT = `{
  "id": "SHP-1042",
  "origin": "Newark, NJ",
  "destination": "Miami, FL",
  "product": "mRNA vaccine",
  "weight_kg": 320
}`;

const SAMPLE_TEMP_REQS = `{
  "min_celsius": -80,
  "max_celsius": -60,
  "max_excursion_minutes": 15
}`;

const SAMPLE_CARRIERS = `[
  { "name": "ColdLogix", "score": 92, "fleet": "ULT freezer trucks" },
  { "name": "PolarTrans", "score": 87, "fleet": "dry-ice reefers" },
  { "name": "FrostExpress", "score": 78, "fleet": "passive PCM containers" }
]`;

const SAMPLE_EXCURSIONS = `[
  { "timestamp": "2025-04-12T03:14:00Z", "celsius": -45, "duration_min": 22 },
  { "timestamp": "2025-04-12T05:01:00Z", "celsius": -52, "duration_min": 8 }
]`;

const SAMPLE_REG_SCENARIO = `{
  "shipment_id": "SHP-1042",
  "product": "mRNA vaccine",
  "required_temp_range_c": [-80, -60],
  "actual_excursions_min": 38,
  "documentation_on_file": ["bill_of_lading", "temperature_log"],
  "missing_documentation": ["chain_of_custody"]
}`;

const SAMPLE_REG_EXCERPTS = `[
  "21 CFR 203.32 — Drug samples must be stored under conditions that will maintain their stability, integrity, and effectiveness.",
  "FSMA Sanitary Transportation Rule §1.908(c) — Carriers must ensure that mechanically refrigerated transport equipment is pre-cooled.",
  "21 CFR 211.142 — Storage and distribution must include written procedures for warehousing including identification and quarantine of unsuitable product."
]`;

const SAMPLE_BREACH = `{
  "event_id": "BR-2031",
  "started_at": "2025-04-12T03:14:00Z",
  "ended_at": "2025-04-12T03:36:00Z",
  "duration_min": 22,
  "celsius_peak": -45,
  "expected_range_c": [-80, -60],
  "carrier": "ColdLogix",
  "vehicle_id": "CLX-12",
  "product": "mRNA vaccine",
  "shipment_id": "SHP-1042"
}`;

const SAMPLE_SENSOR_HISTORY = `{
  "last_24h_readings": [
    { "timestamp": "2025-04-12T01:00:00Z", "celsius": -78 },
    { "timestamp": "2025-04-12T02:00:00Z", "celsius": -72 },
    { "timestamp": "2025-04-12T03:00:00Z", "celsius": -55 }
  ],
  "alarm_count_24h": 1
}`;

const SAMPLE_FACILITY_CONTEXT = `{
  "facility": "Newark Distribution Hub",
  "equipment_age_years": 7,
  "last_pm_date": "2025-01-04",
  "open_dock_doors_at_event": 2,
  "ambient_temp_c": 24
}`;

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState('route');

  // Route optimization state
  const [shipment, setShipment] = useState(SAMPLE_SHIPMENT);
  const [tempReqs, setTempReqs] = useState(SAMPLE_TEMP_REQS);
  const [carriers, setCarriers] = useState(SAMPLE_CARRIERS);
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Contamination risk state
  const [productType, setProductType] = useState('mRNA vaccine');
  const [exposureDuration, setExposureDuration] = useState('30 minutes');
  const [excursions, setExcursions] = useState(SAMPLE_EXCURSIONS);
  const [riskResult, setRiskResult] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // Regulatory compliance check state
  const [regScenario, setRegScenario] = useState(SAMPLE_REG_SCENARIO);
  const [regExcerpts, setRegExcerpts] = useState(SAMPLE_REG_EXCERPTS);
  const [jurisdiction, setJurisdiction] = useState('United States (FDA / FSMA / USDA)');
  const [regResult, setRegResult] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  // Deviation investigation state
  const [breachEvent, setBreachEvent] = useState(SAMPLE_BREACH);
  const [sensorHistory, setSensorHistory] = useState(SAMPLE_SENSOR_HISTORY);
  const [facilityContext, setFacilityContext] = useState(SAMPLE_FACILITY_CONTEXT);
  const [devResult, setDevResult] = useState(null);
  const [devLoading, setDevLoading] = useState(false);

  function tryParse(label, raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`${label}: invalid JSON (${e.message})`);
    }
  }

  function handleApiError(err) {
    const msg = err.message || 'AI request failed';
    if (msg.includes('503') || /no.*key|api key/i.test(msg)) {
      showToast('AI service unavailable — OPENROUTER_API_KEY not configured on the backend.', 'error');
    } else {
      showToast(msg, 'error');
    }
  }

  const handleRouteOptimization = async () => {
    setRouteResult(null);
    setRouteLoading(true);
    try {
      const body = {
        shipment_data: tryParse('Shipment data', shipment),
        temperature_requirements: tryParse('Temperature requirements', tempReqs),
        available_carriers: tryParse('Available carriers', carriers),
      };
      const data = await aiRouteOptimization(body);
      setRouteResult(data.recommendation || data);
      showToast('Route optimization generated', 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleContaminationRisk = async () => {
    setRiskResult(null);
    setRiskLoading(true);
    try {
      const body = {
        temperature_excursions: tryParse('Temperature excursions', excursions),
        product_type: productType,
        exposure_duration: exposureDuration,
      };
      const data = await aiContaminationRisk(body);
      setRiskResult(data.assessment || data);
      showToast('Contamination risk assessment generated', 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setRiskLoading(false);
    }
  };

  const handleRegCheck = async () => {
    setRegResult(null);
    setRegLoading(true);
    try {
      const body = {
        scenario: tryParse('Scenario', regScenario),
        regulatory_excerpts: tryParse('Regulatory excerpts', regExcerpts),
        jurisdiction,
      };
      const data = await aiRegulatoryComplianceCheck(body);
      setRegResult(data.structured ? JSON.stringify(data.structured, null, 2) : (data.raw || JSON.stringify(data, null, 2)));
      showToast('Regulatory compliance grading generated', 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setRegLoading(false);
    }
  };

  const handleDeviationInvestigation = async () => {
    setDevResult(null);
    setDevLoading(true);
    try {
      const body = {
        breach_event: tryParse('Breach event', breachEvent),
      };
      // Optional fields — only attach when valid JSON
      if (sensorHistory && sensorHistory.trim()) {
        try { body.sensor_history = JSON.parse(sensorHistory); } catch { body.sensor_history = sensorHistory; }
      }
      if (facilityContext && facilityContext.trim()) {
        try { body.facility_context = JSON.parse(facilityContext); } catch { body.facility_context = facilityContext; }
      }
      const data = await aiDeviationInvestigation(body);
      setDevResult(data.structured ? JSON.stringify(data.structured, null, 2) : (data.raw || JSON.stringify(data, null, 2)));
      showToast('Deviation investigation generated', 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setDevLoading(false);
    }
  };

  const fieldLabel = { display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4, marginTop: 12 };
  const textareaStyle = { width: '100%', minHeight: 120, padding: 10, fontFamily: 'monospace', fontSize: '0.85rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input, #fff)', color: 'inherit', boxSizing: 'border-box' };
  const inputStyle = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input, #fff)', color: 'inherit', boxSizing: 'border-box' };

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI Assistant</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Cold-chain route optimization and contamination-risk analysis powered by an LLM.
        </p>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #ccc', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'route' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('route')}
        >
          <FiTruck /> Route Optimization
        </button>
        <button
          className={`btn ${activeTab === 'risk' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('risk')}
        >
          <FiAlertTriangle /> Contamination Risk
        </button>
        <button
          className={`btn ${activeTab === 'regulatory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('regulatory')}
        >
          <FiFileText /> Regulatory Check
        </button>
        <button
          className={`btn ${activeTab === 'deviation' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('deviation')}
        >
          <FiSearch /> Deviation Investigation
        </button>
      </div>

      {activeTab === 'route' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)', gap: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Inputs</h3>

            <label style={fieldLabel}>Shipment data (JSON)</label>
            <textarea
              value={shipment}
              onChange={(e) => setShipment(e.target.value)}
              style={textareaStyle}
            />

            <label style={fieldLabel}>Temperature requirements (JSON)</label>
            <textarea
              value={tempReqs}
              onChange={(e) => setTempReqs(e.target.value)}
              style={textareaStyle}
            />

            <label style={fieldLabel}>Available carriers (JSON array)</label>
            <textarea
              value={carriers}
              onChange={(e) => setCarriers(e.target.value)}
              style={textareaStyle}
            />

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={handleRouteOptimization}
                disabled={routeLoading}
              >
                <FiPlay /> {routeLoading ? 'Generating…' : 'Optimize Route'}
              </button>
            </div>
          </div>

          <div>
            <AIAnalysisDisplay analysis={routeResult} loading={routeLoading} />
            {!routeResult && !routeLoading && (
              <div className="card" style={{ padding: 16, color: 'var(--text-muted)' }}>
                Submit shipment, temperature requirements, and carriers to receive an
                AI-generated routing recommendation, risk assessment, and compliance
                notes.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)', gap: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Inputs</h3>

            <label style={fieldLabel}>Product type</label>
            <input
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              style={inputStyle}
            />

            <label style={fieldLabel}>Exposure duration</label>
            <input
              value={exposureDuration}
              onChange={(e) => setExposureDuration(e.target.value)}
              placeholder="e.g. 2 hours"
              style={inputStyle}
            />

            <label style={fieldLabel}>Temperature excursions (JSON array)</label>
            <textarea
              value={excursions}
              onChange={(e) => setExcursions(e.target.value)}
              style={{ ...textareaStyle, minHeight: 180 }}
            />

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={handleContaminationRisk}
                disabled={riskLoading}
              >
                <FiPlay /> {riskLoading ? 'Assessing…' : 'Assess Contamination Risk'}
              </button>
            </div>
          </div>

          <div>
            <AIAnalysisDisplay analysis={riskResult} loading={riskLoading} />
            {!riskResult && !riskLoading && (
              <div className="card" style={{ padding: 16, color: 'var(--text-muted)' }}>
                Provide product type, exposure duration, and the excursion log to get
                a structured FDA/FSMA-aware contamination assessment.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'regulatory' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)', gap: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Inputs</h3>

            <label style={fieldLabel}>Jurisdiction</label>
            <input
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              style={inputStyle}
            />

            <label style={fieldLabel}>Scenario (JSON)</label>
            <textarea
              value={regScenario}
              onChange={(e) => setRegScenario(e.target.value)}
              style={{ ...textareaStyle, minHeight: 160 }}
            />

            <label style={fieldLabel}>Regulatory excerpts (JSON array of strings)</label>
            <textarea
              value={regExcerpts}
              onChange={(e) => setRegExcerpts(e.target.value)}
              style={{ ...textareaStyle, minHeight: 160 }}
            />

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={handleRegCheck}
                disabled={regLoading}
              >
                <FiPlay /> {regLoading ? 'Grading…' : 'Run Compliance Check'}
              </button>
            </div>
          </div>

          <div>
            <AIAnalysisDisplay analysis={regResult} loading={regLoading} />
            {!regResult && !regLoading && (
              <div className="card" style={{ padding: 16, color: 'var(--text-muted)' }}>
                Paste your scenario and the regulatory excerpts you want graded
                against (FDA, FSMA, USDA, GDP, WHO, etc.). The LLM grades each
                excerpt and returns a structured findings list with remediation.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'deviation' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,1fr) minmax(320px,1fr)', gap: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Inputs</h3>

            <label style={fieldLabel}>Breach event (JSON)</label>
            <textarea
              value={breachEvent}
              onChange={(e) => setBreachEvent(e.target.value)}
              style={{ ...textareaStyle, minHeight: 160 }}
            />

            <label style={fieldLabel}>Sensor history (JSON, optional)</label>
            <textarea
              value={sensorHistory}
              onChange={(e) => setSensorHistory(e.target.value)}
              style={textareaStyle}
            />

            <label style={fieldLabel}>Facility context (JSON, optional)</label>
            <textarea
              value={facilityContext}
              onChange={(e) => setFacilityContext(e.target.value)}
              style={textareaStyle}
            />

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={handleDeviationInvestigation}
                disabled={devLoading}
              >
                <FiPlay /> {devLoading ? 'Investigating…' : 'Investigate Deviation'}
              </button>
            </div>
          </div>

          <div>
            <AIAnalysisDisplay analysis={devResult} loading={devLoading} />
            {!devResult && !devLoading && (
              <div className="card" style={{ padding: 16, color: 'var(--text-muted)' }}>
                Submit a breach record (and optional sensor history + facility
                context) to receive a structured 5-Whys analysis, root-cause
                hypotheses, containment, CAPA, and reportability assessment.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
