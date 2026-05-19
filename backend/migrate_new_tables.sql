-- Migration: Add tables for alert thresholds and webhook configs

-- Alert thresholds per product category
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) UNIQUE NOT NULL,
  min_temp NUMERIC(6,2),
  max_temp NUMERIC(6,2),
  humidity_min NUMERIC(5,2),
  humidity_max NUMERIC(5,2),
  response_time_sla_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook configurations per user
CREATE TABLE IF NOT EXISTS webhook_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add carrier_id column to compliance_records if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='compliance_records' AND column_name='carrier_id'
  ) THEN
    ALTER TABLE compliance_records ADD COLUMN carrier_id INTEGER REFERENCES carriers(id) ON DELETE SET NULL;
  END IF;
END$$;
