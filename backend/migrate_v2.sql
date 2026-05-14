-- Migration v2: ai_results JSONB columns + new tables for custom non-CRUD features

-- Add ai_results JSONB column to all entity tables for storing parsed AI output
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='temperature_readings' AND column_name='ai_results') THEN
    ALTER TABLE temperature_readings ADD COLUMN ai_results JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spoilage_predictions' AND column_name='ai_results') THEN
    ALTER TABLE spoilage_predictions ADD COLUMN ai_results JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compliance_records' AND column_name='ai_results') THEN
    ALTER TABLE compliance_records ADD COLUMN ai_results JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carriers' AND column_name='ai_results') THEN
    ALTER TABLE carriers ADD COLUMN ai_results JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='ai_results') THEN
    ALTER TABLE incidents ADD COLUMN ai_results JSONB;
  END IF;
END$$;

-- Add cost calculation column to spoilage_predictions for spoilage cost calculator
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spoilage_predictions' AND column_name='cost_analysis') THEN
    ALTER TABLE spoilage_predictions ADD COLUMN cost_analysis JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spoilage_predictions' AND column_name='estimated_loss_usd') THEN
    ALTER TABLE spoilage_predictions ADD COLUMN estimated_loss_usd NUMERIC(12,2);
  END IF;
END$$;

-- Facilities table for multi-facility aggregation
CREATE TABLE IF NOT EXISTS facilities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  parent_company VARCHAR(255),
  region VARCHAR(100),
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  facility_type VARCHAR(50),
  capacity_units INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Regulatory changes tracking
CREATE TABLE IF NOT EXISTS regulatory_changes (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  reference_code VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  effective_date DATE,
  affected_categories JSONB DEFAULT '[]',
  impact_level VARCHAR(20),
  ai_results JSONB,
  status VARCHAR(20) DEFAULT 'new',
  acknowledged_by INTEGER,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Predictive alerts (NEW)
CREATE TABLE IF NOT EXISTS predictive_alerts (
  id SERIAL PRIMARY KEY,
  sensor_id VARCHAR(100),
  product_type VARCHAR(100),
  alert_probability_pct INTEGER,
  predicted_alert_window_hours INTEGER,
  predicted_severity VARCHAR(20),
  trend_direction VARCHAR(50),
  ai_results JSONB,
  status VARCHAR(20) DEFAULT 'active',
  triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled reports (NEW: Compliance Report Auto-Generation)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  format VARCHAR(20) DEFAULT 'pdf',
  schedule_cron VARCHAR(100),
  recipients JSONB DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  facility_id INTEGER,
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- IoT integration sources (NEW: IoT Integration Hub)
CREATE TABLE IF NOT EXISTS iot_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(255) UNIQUE NOT NULL,
  vendor VARCHAR(100),
  last_ingest_at TIMESTAMP,
  total_readings INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trend analyses for time-series anomaly detection
CREATE TABLE IF NOT EXISTS trend_analyses (
  id SERIAL PRIMARY KEY,
  sensor_id VARCHAR(100),
  facility_id INTEGER,
  window_start TIMESTAMP,
  window_end TIMESTAMP,
  metrics JSONB,
  anomalies_detected INTEGER DEFAULT 0,
  ai_results JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add facility_id to existing tables (optional linkage)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='temperature_readings' AND column_name='facility_id') THEN
    ALTER TABLE temperature_readings ADD COLUMN facility_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='facility_id') THEN
    ALTER TABLE incidents ADD COLUMN facility_id INTEGER;
  END IF;
END$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_temperature_timestamp ON temperature_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_temperature_sensor_id ON temperature_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_temperature_facility ON temperature_readings(facility_id);
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_status ON predictive_alerts(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_changes_status ON regulatory_changes(status);
