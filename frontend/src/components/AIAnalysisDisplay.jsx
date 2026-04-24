import React from 'react';
import { FiCpu, FiAlertCircle, FiCheckCircle, FiTrendingUp, FiList, FiShield, FiInfo } from 'react-icons/fi';

function parseAnalysisContent(analysis) {
  if (!analysis) return null;

  // If it's a string, try to parse as JSON first
  let data = analysis;
  if (typeof analysis === 'string') {
    try {
      data = JSON.parse(analysis);
    } catch {
      // It's a plain text analysis - parse it into sections
      return parseTextAnalysis(analysis);
    }
  }

  // Handle object-based analysis
  if (typeof data === 'object') {
    return parseObjectAnalysis(data);
  }

  return { sections: [{ type: 'text', title: 'Analysis', content: String(data) }] };
}

function parseTextAnalysis(text) {
  const sections = [];
  const lines = text.split('\n').filter((l) => l.trim());

  let currentSection = null;
  let currentItems = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers (lines ending with : or starting with ## or **)
    const headerMatch =
      trimmed.match(/^#{1,3}\s*(.+)/) ||
      trimmed.match(/^\*\*(.+?)\*\*:?\s*$/) ||
      (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.startsWith('-')
        ? [null, trimmed.replace(/:$/, '')]
        : null);

    if (headerMatch) {
      if (currentSection) {
        sections.push({ type: 'list', title: currentSection, items: currentItems });
      }
      currentSection = headerMatch[1].replace(/\*\*/g, '').trim();
      currentItems = [];
      continue;
    }

    // Detect risk level lines
    const riskMatch = trimmed.match(/risk\s*(?:level)?[:\s]*(\w+)/i);
    if (riskMatch && trimmed.length < 50) {
      sections.push({ type: 'risk', level: riskMatch[1].toLowerCase() });
      continue;
    }

    // Detect score/percentage lines
    const scoreMatch = trimmed.match(/(\w[\w\s]+?):\s*(\d+(?:\.\d+)?)\s*(%|\/100|\/10|points?)?/i);
    if (scoreMatch && !currentSection) {
      sections.push({
        type: 'metric',
        label: scoreMatch[1].trim(),
        value: parseFloat(scoreMatch[2]),
        unit: scoreMatch[3] || '',
      });
      continue;
    }

    // Bullet point items
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+[.)]\s+(.+)/);
    if (bulletMatch) {
      currentItems.push(bulletMatch[1]);
      continue;
    }

    // Regular text
    if (currentSection) {
      currentItems.push(trimmed);
    } else {
      sections.push({ type: 'text', content: trimmed });
    }
  }

  if (currentSection && currentItems.length > 0) {
    sections.push({ type: 'list', title: currentSection, items: currentItems });
  }

  // If no sections were parsed, just show the text
  if (sections.length === 0) {
    sections.push({ type: 'text', title: 'Analysis Result', content: text });
  }

  return { sections };
}

function parseObjectAnalysis(obj) {
  const sections = [];

  // Extract common AI response fields
  const fieldMappings = {
    riskLevel: 'risk',
    risk_level: 'risk',
    risk: 'risk',
    severity: 'risk',
    score: 'score',
    overallScore: 'score',
    overall_score: 'score',
    complianceScore: 'score',
    compliance_score: 'score',
  };

  for (const [key, type] of Object.entries(fieldMappings)) {
    if (obj[key] !== undefined) {
      if (type === 'risk') {
        sections.push({ type: 'risk', level: String(obj[key]).toLowerCase() });
      } else if (type === 'score') {
        sections.push({ type: 'score', label: formatLabel(key), value: Number(obj[key]) });
      }
    }
  }

  // Process remaining fields
  for (const [key, value] of Object.entries(obj)) {
    if (fieldMappings[key]) continue;
    if (key === '_id' || key === 'id' || key === '__v') continue;

    const label = formatLabel(key);

    if (Array.isArray(value)) {
      sections.push({
        type: 'list',
        title: label,
        items: value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))),
      });
    } else if (typeof value === 'object' && value !== null) {
      const metrics = [];
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'number') {
          metrics.push({ label: formatLabel(k), value: v });
        }
      }
      if (metrics.length > 0) {
        sections.push({ type: 'metrics', title: label, items: metrics });
      } else {
        sections.push({ type: 'text', title: label, content: JSON.stringify(value, null, 2) });
      }
    } else if (typeof value === 'number') {
      sections.push({ type: 'metric', label, value, unit: '' });
    } else if (typeof value === 'string' && value.length > 80) {
      sections.push({ type: 'text', title: label, content: value });
    } else if (typeof value === 'string') {
      sections.push({ type: 'metric', label, value, unit: '' });
    }
  }

  return { sections };
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function getRiskColor(level) {
  const l = (level || '').toLowerCase();
  if (l.includes('critical') || l.includes('very high')) return 'var(--color-danger)';
  if (l.includes('high')) return '#f97316';
  if (l.includes('medium') || l.includes('moderate')) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function getRiskClass(level) {
  const l = (level || '').toLowerCase();
  if (l.includes('critical') || l.includes('very high')) return 'ai-risk-critical';
  if (l.includes('high')) return 'ai-risk-high';
  if (l.includes('medium') || l.includes('moderate')) return 'ai-risk-medium';
  return 'ai-risk-low';
}

function getScoreColor(val) {
  const n = typeof val === 'number' ? val : 0;
  if (n >= 90) return 'var(--color-success)';
  if (n >= 70) return 'var(--color-warning)';
  if (n >= 50) return '#f97316';
  return 'var(--color-danger)';
}

function getSectionIcon(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('recommend') || t.includes('action') || t.includes('suggestion')) return <FiList />;
  if (t.includes('risk') || t.includes('alert') || t.includes('warning')) return <FiAlertCircle />;
  if (t.includes('complian') || t.includes('status') || t.includes('pass')) return <FiCheckCircle />;
  if (t.includes('trend') || t.includes('forecast') || t.includes('predict')) return <FiTrendingUp />;
  if (t.includes('regulation') || t.includes('standard')) return <FiShield />;
  return <FiInfo />;
}

export default function AIAnalysisDisplay({ analysis, loading }) {
  if (loading) {
    return (
      <div className="ai-analysis-container">
        <div className="ai-analysis-header">
          <FiCpu />
          AI Analysis
        </div>
        <div className="ai-analysis-body">
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <span>Running AI analysis...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const parsed = parseAnalysisContent(analysis);
  if (!parsed) return null;

  return (
    <div className="ai-analysis-container">
      <div className="ai-analysis-header">
        <FiCpu />
        AI Analysis Results
      </div>
      <div className="ai-analysis-body">
        {parsed.sections.map((section, idx) => {
          switch (section.type) {
            case 'risk':
              return (
                <div key={idx} className={`ai-risk-indicator ${getRiskClass(section.level)}`}>
                  <FiAlertCircle style={{ color: getRiskColor(section.level), fontSize: '1.3rem' }} />
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Risk Level</div>
                    <div className="ai-risk-label" style={{ color: getRiskColor(section.level) }}>
                      {section.level.charAt(0).toUpperCase() + section.level.slice(1)}
                    </div>
                  </div>
                </div>
              );

            case 'score': {
              const pct = section.value > 1 ? section.value : section.value * 100;
              return (
                <div key={idx} className="ai-section">
                  <div className="ai-section-title">
                    <FiTrendingUp />
                    {section.label}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: getScoreColor(pct) }}>
                    {pct.toFixed(1)}
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> / 100</span>
                  </div>
                  <div className="ai-progress-bar">
                    <div
                      className="ai-progress-fill"
                      style={{ width: `${Math.min(pct, 100)}%`, background: getScoreColor(pct) }}
                    />
                  </div>
                </div>
              );
            }

            case 'metric':
              return (
                <div key={idx} className="ai-metric">
                  <span className="ai-metric-label">{section.label}</span>
                  <span className="ai-metric-value">
                    {typeof section.value === 'number'
                      ? section.value.toLocaleString()
                      : section.value}
                    {section.unit && ` ${section.unit}`}
                  </span>
                </div>
              );

            case 'metrics':
              return (
                <div key={idx} className="ai-section">
                  <div className="ai-section-title">
                    {getSectionIcon(section.title)}
                    {section.title}
                  </div>
                  {section.items.map((m, i) => {
                    const pct = m.value > 1 ? Math.min(m.value, 100) : m.value * 100;
                    return (
                      <div key={i}>
                        <div className="ai-metric">
                          <span className="ai-metric-label">{m.label}</span>
                          <span className="ai-metric-value" style={{ color: getScoreColor(pct) }}>
                            {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                          </span>
                        </div>
                        {typeof m.value === 'number' && m.value <= 100 && (
                          <div className="ai-progress-bar">
                            <div
                              className="ai-progress-fill"
                              style={{ width: `${pct}%`, background: getScoreColor(pct) }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );

            case 'list':
              return (
                <div key={idx} className="ai-section">
                  <div className="ai-section-title">
                    {getSectionIcon(section.title)}
                    {section.title}
                  </div>
                  {section.items.map((item, i) => (
                    <div key={i} className="ai-recommendation">
                      <span className="ai-recommendation-icon">
                        <FiCheckCircle />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              );

            case 'text':
              return (
                <div key={idx} className="ai-section">
                  {section.title && (
                    <div className="ai-section-title">
                      {getSectionIcon(section.title)}
                      {section.title}
                    </div>
                  )}
                  <div className="ai-text-block">{section.content}</div>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
