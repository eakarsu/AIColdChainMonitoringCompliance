BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS governed_lots (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, lot_code text NOT NULL, product_type text NOT NULL, jurisdiction text NOT NULL,
  min_temperature numeric NOT NULL, max_temperature numeric NOT NULL CHECK (max_temperature > min_temperature),
  disposition text NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending','quarantine','released','destroyed','recalled')),
  version integer NOT NULL DEFAULT 1, retention_until date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, lot_code)
);
CREATE TABLE IF NOT EXISTS calibrated_devices (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, external_id text NOT NULL, public_key_fingerprint text NOT NULL,
  calibrated_until timestamptz NOT NULL, revoked_at timestamptz, UNIQUE (tenant_id, external_id)
);
CREATE TABLE IF NOT EXISTS lot_telemetry (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL, lot_id uuid NOT NULL REFERENCES governed_lots(id),
  device_id uuid NOT NULL REFERENCES calibrated_devices(id), idempotency_key text NOT NULL, measured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), temperature numeric NOT NULL, payload_sha256 char(64) NOT NULL,
  calibration_valid boolean NOT NULL, out_of_range boolean NOT NULL, UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS lot_custody_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL, lot_id uuid NOT NULL REFERENCES governed_lots(id),
  actor_id text, event_type text NOT NULL, location text, prior_event_hash char(64), event_hash char(64) NOT NULL UNIQUE,
  event_data jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS lot_corrective_actions (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, lot_id uuid NOT NULL REFERENCES governed_lots(id), status text NOT NULL CHECK (status IN ('open','verified','closed')),
  action text NOT NULL, owner_id text NOT NULL, verified_by text, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cold_chain_sync_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL, provider text NOT NULL, external_key text,
  failure_code text NOT NULL, retry_count integer NOT NULL DEFAULT 0, next_retry_at timestamptz, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lot_telemetry_trace ON lot_telemetry(tenant_id, lot_id, measured_at);
COMMIT;
