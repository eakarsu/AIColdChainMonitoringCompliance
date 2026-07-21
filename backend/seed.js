import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cold_chain_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS incidents CASCADE;
      DROP TABLE IF EXISTS carriers CASCADE;
      DROP TABLE IF EXISTS compliance_records CASCADE;
      DROP TABLE IF EXISTS spoilage_predictions CASCADE;
      DROP TABLE IF EXISTS temperature_readings CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('Creating tables...');
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        tenant_id UUID NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE temperature_readings (
        id SERIAL PRIMARY KEY,
        sensor_id VARCHAR(100),
        location VARCHAR(255),
        zone VARCHAR(100),
        product_type VARCHAR(100),
        temperature NUMERIC,
        humidity NUMERIC,
        min_threshold NUMERIC,
        max_threshold NUMERIC,
        status VARCHAR(50) DEFAULT 'normal',
        unit VARCHAR(10) DEFAULT 'C',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE spoilage_predictions (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255),
        batch_id VARCHAR(100),
        product_type VARCHAR(100),
        current_temp NUMERIC,
        storage_temp NUMERIC,
        quantity INTEGER,
        unit VARCHAR(50),
        manufacture_date DATE,
        expiry_date DATE,
        predicted_spoilage_date DATE,
        risk_level VARCHAR(50) DEFAULT 'medium',
        confidence NUMERIC,
        status VARCHAR(50) DEFAULT 'active',
        ai_analysis TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE compliance_records (
        id SERIAL PRIMARY KEY,
        regulation VARCHAR(255),
        standard VARCHAR(255),
        category VARCHAR(100),
        facility VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        last_audit DATE,
        next_audit DATE,
        findings TEXT,
        corrective_actions TEXT,
        auditor VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE carriers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        code VARCHAR(50),
        contact_email VARCHAR(255),
        phone VARCHAR(50),
        score NUMERIC,
        on_time_rate NUMERIC,
        temp_compliance_rate NUMERIC,
        incident_count INTEGER DEFAULT 0,
        total_shipments INTEGER DEFAULT 0,
        routes TEXT,
        fleet_size INTEGER,
        certification VARCHAR(255),
        insurance_rating VARCHAR(50),
        last_review DATE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE incidents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        incident_type VARCHAR(100),
        severity VARCHAR(50),
        date TIMESTAMPTZ,
        location VARCHAR(255),
        facility VARCHAR(255),
        product_affected VARCHAR(255),
        temperature_recorded NUMERIC,
        description TEXT,
        root_cause TEXT,
        corrective_action TEXT,
        status VARCHAR(50) DEFAULT 'open',
        reported_by VARCHAR(255),
        assigned_to VARCHAR(255),
        resolution_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        reading_id INTEGER UNIQUE REFERENCES temperature_readings(id) ON DELETE CASCADE,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by VARCHAR(255),
        acknowledged_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE audit_log (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(100) NOT NULL,
        entity_id INTEGER,
        action VARCHAR(50) NOT NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        changes JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Seeding users...');
    if (!process.env.DEMO_ADMIN_PASSWORD || !process.env.DEMO_VIEWER_PASSWORD || !process.env.DEMO_MANAGER_PASSWORD) throw new Error('Explicit demo passwords are required');
    const passwordHash = await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD, 10);
    const viewerHash = await bcrypt.hash(process.env.DEMO_VIEWER_PASSWORD, 10);
    const managerHash = await bcrypt.hash(process.env.DEMO_MANAGER_PASSWORD, 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, tenant_id) VALUES
      ('admin@coldchain.com', $1, 'Admin User', 'admin', '00000000-0000-4000-8000-000000000001'),
      ('viewer@coldchain.com', $2, 'Viewer User', 'viewer', '00000000-0000-4000-8000-000000000001'),
      ('manager@coldchain.com', $3, 'Operations Manager', 'manager', '00000000-0000-4000-8000-000000000001'),
      ('auditor@coldchain.com', $1, 'Compliance Auditor', 'auditor', '00000000-0000-4000-8000-000000000001'),
      ('tech@coldchain.com', $2, 'Tech Support', 'technician', '00000000-0000-4000-8000-000000000001')
    `, [passwordHash, viewerHash, managerHash]);

    console.log('Seeding temperature_readings...');
    await client.query(`
      INSERT INTO temperature_readings (sensor_id, location, zone, product_type, temperature, humidity, min_threshold, max_threshold, status, unit, timestamp) VALUES
      ('SENS-001', 'Warehouse A - Bay 1', 'Cold Storage', 'Dairy', -2.5, 85, -4, 2, 'normal', 'C', '2026-03-19 08:00:00+00'),
      ('SENS-002', 'Warehouse A - Bay 2', 'Cold Storage', 'Meat', -1.8, 82, -2, 0, 'normal', 'C', '2026-03-19 08:05:00+00'),
      ('SENS-003', 'Warehouse B - Freezer 1', 'Frozen', 'Seafood', -18.2, 70, -22, -16, 'normal', 'C', '2026-03-19 08:10:00+00'),
      ('SENS-004', 'Warehouse B - Freezer 2', 'Frozen', 'Ice Cream', -20.5, 65, -24, -18, 'normal', 'C', '2026-03-19 08:15:00+00'),
      ('SENS-005', 'Distribution Center 1', 'Refrigerated', 'Produce', 4.2, 90, 2, 6, 'normal', 'C', '2026-03-19 08:20:00+00'),
      ('SENS-006', 'Distribution Center 1', 'Refrigerated', 'Pharmaceuticals', 5.8, 45, 2, 8, 'normal', 'C', '2026-03-19 08:25:00+00'),
      ('SENS-007', 'Transport Truck T-101', 'Mobile Cold', 'Vaccines', 3.1, 40, 2, 8, 'normal', 'C', '2026-03-19 08:30:00+00'),
      ('SENS-008', 'Transport Truck T-102', 'Mobile Frozen', 'Frozen Meals', -15.0, 60, -20, -15, 'warning', 'C', '2026-03-19 08:35:00+00'),
      ('SENS-009', 'Retail Store 5 - Deli', 'Display Case', 'Deli Meats', 6.5, 75, 0, 4, 'alert', 'C', '2026-03-19 08:40:00+00'),
      ('SENS-010', 'Retail Store 5 - Bakery', 'Ambient Cool', 'Pastries', 12.0, 55, 8, 15, 'normal', 'C', '2026-03-19 08:45:00+00'),
      ('SENS-011', 'Warehouse C - Bay 3', 'Cold Storage', 'Cheese', 7.8, 88, 2, 6, 'critical', 'C', '2026-03-19 09:00:00+00'),
      ('SENS-012', 'Processing Plant - Line A', 'Production', 'Poultry', 1.2, 80, 0, 4, 'normal', 'C', '2026-03-19 09:05:00+00'),
      ('SENS-013', 'Processing Plant - Line B', 'Production', 'Ground Beef', 2.0, 78, 0, 4, 'normal', 'C', '2026-03-19 09:10:00+00'),
      ('SENS-014', 'Warehouse A - Bay 3', 'Cold Storage', 'Yogurt', 5.5, 86, 2, 6, 'warning', 'C', '2026-03-19 09:15:00+00'),
      ('SENS-015', 'Transport Truck T-103', 'Mobile Cold', 'Blood Products', 4.8, 42, 2, 6, 'normal', 'C', '2026-03-19 09:20:00+00'),
      ('SENS-016', 'Warehouse D - Pharma Wing', 'Controlled', 'Insulin', 6.1, 38, 2, 8, 'normal', 'C', '2026-03-19 09:25:00+00'),
      ('SENS-017', 'Retail Store 12 - Frozen', 'Frozen Display', 'Frozen Vegetables', -12.3, 55, -20, -15, 'alert', 'C', '2026-03-19 09:30:00+00'),
      ('SENS-018', 'Distribution Center 2', 'Refrigerated', 'Fresh Fish', 0.5, 92, -1, 2, 'normal', 'C', '2026-03-19 09:35:00+00')
    `);

    console.log('Seeding spoilage_predictions...');
    await client.query(`
      INSERT INTO spoilage_predictions (product_name, batch_id, product_type, current_temp, storage_temp, quantity, unit, manufacture_date, expiry_date, predicted_spoilage_date, risk_level, confidence, status) VALUES
      ('Whole Milk 1L', 'BATCH-D001', 'Dairy', 3.5, 4.0, 500, 'liters', '2026-03-10', '2026-03-25', '2026-03-24', 'low', 92.5, 'active'),
      ('Atlantic Salmon Fillet', 'BATCH-S001', 'Seafood', -1.0, -2.0, 200, 'kg', '2026-03-17', '2026-03-22', '2026-03-21', 'medium', 85.0, 'active'),
      ('Chicken Breast', 'BATCH-M001', 'Meat', 2.0, 0.0, 350, 'kg', '2026-03-16', '2026-03-21', '2026-03-20', 'high', 88.3, 'active'),
      ('Greek Yogurt', 'BATCH-D002', 'Dairy', 5.2, 4.0, 1000, 'units', '2026-03-05', '2026-04-05', '2026-04-03', 'low', 90.0, 'active'),
      ('Moderna COVID Vaccine', 'BATCH-V001', 'Pharmaceutical', -19.5, -20.0, 5000, 'doses', '2026-02-15', '2026-08-15', '2026-08-10', 'low', 95.0, 'active'),
      ('Fresh Strawberries', 'BATCH-P001', 'Produce', 4.8, 2.0, 150, 'kg', '2026-03-18', '2026-03-23', '2026-03-21', 'high', 78.5, 'active'),
      ('Mozzarella Cheese Block', 'BATCH-D003', 'Dairy', 6.0, 4.0, 300, 'kg', '2026-03-01', '2026-04-15', '2026-04-12', 'medium', 82.0, 'active'),
      ('Ground Turkey', 'BATCH-M002', 'Meat', 1.5, 0.0, 250, 'kg', '2026-03-17', '2026-03-20', '2026-03-19', 'critical', 91.2, 'active'),
      ('Insulin Pens (Humalog)', 'BATCH-PH01', 'Pharmaceutical', 5.0, 4.0, 2000, 'units', '2026-01-10', '2026-07-10', '2026-07-05', 'low', 96.0, 'active'),
      ('Baby Spinach', 'BATCH-P002', 'Produce', 5.5, 3.0, 100, 'kg', '2026-03-17', '2026-03-22', '2026-03-20', 'high', 80.0, 'active'),
      ('Frozen Shrimp', 'BATCH-S002', 'Seafood', -17.5, -18.0, 400, 'kg', '2026-02-20', '2026-08-20', '2026-08-15', 'low', 93.0, 'active'),
      ('Probiotic Supplements', 'BATCH-PH02', 'Pharmaceutical', 7.5, 4.0, 800, 'bottles', '2026-03-01', '2026-09-01', '2026-08-20', 'medium', 75.0, 'active'),
      ('Cream Cheese', 'BATCH-D004', 'Dairy', 4.0, 4.0, 600, 'units', '2026-03-12', '2026-04-12', '2026-04-10', 'low', 91.0, 'active'),
      ('Pork Tenderloin', 'BATCH-M003', 'Meat', 3.0, 0.0, 180, 'kg', '2026-03-15', '2026-03-20', '2026-03-19', 'critical', 89.0, 'active'),
      ('Fresh Blueberries', 'BATCH-P003', 'Produce', 3.2, 2.0, 80, 'kg', '2026-03-18', '2026-03-25', '2026-03-24', 'medium', 83.0, 'active'),
      ('Blood Plasma', 'BATCH-BP01', 'Medical', 3.8, 4.0, 100, 'units', '2026-03-10', '2026-03-17', '2026-03-16', 'critical', 94.0, 'expired')
    `);

    console.log('Seeding compliance_records...');
    await client.query(`
      INSERT INTO compliance_records (regulation, standard, category, facility, status, priority, last_audit, next_audit, findings, corrective_actions, auditor, notes) VALUES
      ('FDA 21 CFR 110', 'HACCP', 'Food Safety', 'Warehouse A', 'compliant', 'high', '2026-01-15', '2026-07-15', 'All temperature logs maintained properly', 'None required', 'John Smith', 'Annual audit passed'),
      ('FDA 21 CFR 117', 'FSMA', 'Preventive Controls', 'Processing Plant', 'compliant', 'critical', '2026-02-10', '2026-08-10', 'Preventive controls plan up to date', 'Minor documentation update needed', 'Sarah Johnson', 'PCQI certification verified'),
      ('USDA FSIS', 'HACCP', 'Meat Processing', 'Processing Plant - Line A', 'compliant', 'critical', '2026-02-20', '2026-05-20', 'CCP monitoring records complete', 'None required', 'Mike Brown', 'Quarterly inspection'),
      ('FDA 21 CFR 1', 'FSMA', 'Sanitary Transport', 'Distribution Center 1', 'non-compliant', 'critical', '2026-03-01', '2026-04-01', 'Temperature monitoring gaps in transport logs', 'Install backup temperature loggers on all vehicles', 'Sarah Johnson', 'Follow-up required within 30 days'),
      ('EU Regulation 853/2004', 'ISO 22000', 'Food Safety Management', 'Warehouse B', 'compliant', 'high', '2026-01-20', '2026-07-20', 'FSMS certified and operational', 'Update hazard analysis for new product lines', 'Emily Davis', 'Export facility certification'),
      ('FDA 21 CFR 211', 'cGMP', 'Pharmaceutical Storage', 'Warehouse D - Pharma Wing', 'compliant', 'critical', '2026-03-05', '2026-06-05', 'All storage conditions within specification', 'Calibrate sensors on schedule', 'Dr. Robert Lee', 'DEA and FDA compliant'),
      ('WHO GDP', 'GDP', 'Pharma Distribution', 'Distribution Center 2', 'pending', 'high', '2025-12-15', '2026-06-15', 'Pending review of new cold chain procedures', 'Awaiting updated SOPs', 'Dr. Robert Lee', 'New distribution agreement'),
      ('OSHA 29 CFR 1910', 'OSHA', 'Worker Safety', 'Processing Plant', 'compliant', 'medium', '2026-02-01', '2026-08-01', 'PPE compliance at 98%', 'Replace worn cold storage gear', 'Tom Wilson', 'Annual safety audit'),
      ('FDA FSMA 204', 'FSMA', 'Traceability', 'Warehouse A', 'non-compliant', 'high', '2026-03-10', '2026-04-10', 'Traceability records incomplete for 3 product lines', 'Implement lot tracking system for all incoming products', 'Sarah Johnson', 'New traceability rule enforcement'),
      ('HACCP Codex', 'HACCP', 'Seafood Processing', 'Processing Plant - Line B', 'compliant', 'high', '2026-01-25', '2026-07-25', 'All 7 HACCP principles followed', 'None required', 'Mike Brown', 'Seafood HACCP plan reviewed'),
      ('FDA 21 CFR 1271', 'cGTP', 'Tissue Storage', 'Warehouse D - Pharma Wing', 'compliant', 'critical', '2026-02-28', '2026-05-28', 'Tissue storage at required -80C', 'None required', 'Dr. Robert Lee', 'HCT/P compliance verified'),
      ('EPA 40 CFR 82', 'EPA', 'Refrigerant Management', 'Warehouse B', 'pending', 'medium', '2025-11-20', '2026-05-20', 'Refrigerant leak detection system needs upgrade', 'Schedule system upgrade Q2 2026', 'Tom Wilson', 'EPA Section 608 compliance'),
      ('SQF Code Ed. 9', 'SQF', 'Food Quality', 'Distribution Center 1', 'compliant', 'high', '2026-02-15', '2026-08-15', 'SQF Level 3 certification maintained', 'Annual recertification due August', 'Emily Davis', 'GFSI benchmarked'),
      ('BRC Global Standard', 'BRC', 'Food Safety', 'Warehouse A', 'compliant', 'high', '2026-01-10', '2026-07-10', 'Grade A certification', 'Minor findings corrected on site', 'Emily Davis', 'Unannounced audit passed'),
      ('FDA 21 CFR 820', 'QSR', 'Medical Device Storage', 'Warehouse D - Pharma Wing', 'non-compliant', 'critical', '2026-03-12', '2026-04-12', 'Temperature excursion event not properly documented', 'Implement automated alert and documentation system', 'Dr. Robert Lee', 'CAPA initiated'),
      ('State Health Dept', 'Local', 'Retail Compliance', 'Retail Store 5', 'compliant', 'low', '2026-03-01', '2026-09-01', 'All display cases within temperature range', 'None required', 'Local Inspector', 'Routine inspection')
    `);

    console.log('Seeding carriers...');
    await client.query(`
      INSERT INTO carriers (name, code, contact_email, phone, score, on_time_rate, temp_compliance_rate, incident_count, total_shipments, routes, fleet_size, certification, insurance_rating, last_review, status) VALUES
      ('Arctic Express Logistics', 'AEL', 'ops@arcticexpress.com', '+1-555-0101', 94.5, 97.2, 99.1, 2, 1250, 'Northeast US, Midwest', 45, 'HACCP, GDP, C-TPAT', 'A+', '2026-03-01', 'active'),
      ('ColdStar Transport', 'CST', 'dispatch@coldstar.com', '+1-555-0102', 88.0, 93.5, 96.8, 5, 980, 'Southeast US, Gulf Coast', 32, 'HACCP, SmartWay', 'A', '2026-02-15', 'active'),
      ('FrostLine Carriers', 'FLC', 'info@frostline.com', '+1-555-0103', 91.2, 95.8, 98.5, 3, 1100, 'West Coast, Pacific NW', 38, 'HACCP, GDP, ISO 9001', 'A+', '2026-03-10', 'active'),
      ('PharmaFreight Inc', 'PFI', 'pharma@pharmafreight.com', '+1-555-0104', 96.8, 98.5, 99.8, 1, 650, 'Nationwide', 25, 'GDP, WHO-GDP, cGMP', 'A+', '2026-03-05', 'active'),
      ('TempGuard Shipping', 'TGS', 'service@tempguard.com', '+1-555-0105', 72.5, 85.0, 88.2, 12, 800, 'Midwest, Plains States', 28, 'HACCP', 'B+', '2026-02-20', 'under_review'),
      ('IceBridge Logistics', 'IBL', 'contact@icebridge.com', '+1-555-0106', 85.3, 91.0, 95.0, 7, 720, 'Northeast, Mid-Atlantic', 22, 'HACCP, SQF', 'A-', '2026-01-30', 'active'),
      ('BioTransit Solutions', 'BTS', 'ops@biotransit.com', '+1-555-0107', 97.2, 99.0, 99.5, 0, 420, 'Nationwide (Pharma Only)', 15, 'GDP, WHO-GDP, cGMP, DEA', 'A+', '2026-03-12', 'active'),
      ('QuickChill Delivery', 'QCD', 'fleet@quickchill.com', '+1-555-0108', 68.0, 80.5, 82.0, 18, 1500, 'Nationwide', 60, 'HACCP', 'B', '2026-03-15', 'suspended'),
      ('PolarRoute Express', 'PRE', 'dispatch@polarroute.com', '+1-555-0109', 90.0, 94.5, 97.0, 4, 880, 'Canada-US Cross-border', 30, 'HACCP, C-TPAT, PIP', 'A', '2026-02-28', 'active'),
      ('SeaBreeze Cold Chain', 'SBC', 'logistics@seabreeze.com', '+1-555-0110', 82.8, 89.0, 93.5, 8, 560, 'Gulf Coast, Caribbean', 20, 'HACCP, ISM Code', 'B+', '2026-01-15', 'active'),
      ('MedCold Logistics', 'MCL', 'medical@medcold.com', '+1-555-0111', 95.5, 97.8, 99.2, 1, 380, 'Northeast, Southeast', 18, 'GDP, cGMP, AABB', 'A+', '2026-03-08', 'active'),
      ('FreshFleet Transport', 'FFT', 'ops@freshfleet.com', '+1-555-0112', 79.5, 87.5, 90.0, 10, 1350, 'West Coast, Southwest', 50, 'HACCP, USDA', 'B+', '2026-02-10', 'active'),
      ('CryoShip International', 'CSI', 'global@cryoship.com', '+1-555-0113', 93.0, 96.0, 98.0, 2, 300, 'International', 12, 'GDP, WHO-GDP, IATA', 'A', '2026-03-01', 'active'),
      ('ValleyFresh Carriers', 'VFC', 'dispatch@valleyfresh.com', '+1-555-0114', 76.0, 84.0, 86.5, 14, 950, 'Central Valley, CA', 35, 'HACCP', 'B', '2026-01-20', 'under_review'),
      ('NorthStar Refrigerated', 'NSR', 'info@northstar-ref.com', '+1-555-0115', 87.5, 92.0, 95.5, 6, 700, 'Upper Midwest, Great Lakes', 24, 'HACCP, SmartWay', 'A-', '2026-02-25', 'active'),
      ('GreenCold Sustainable', 'GCS', 'eco@greencold.com', '+1-555-0116', 89.0, 93.0, 96.0, 4, 450, 'Pacific NW, Northern CA', 20, 'HACCP, SmartWay, ISO 14001', 'A', '2026-03-14', 'active')
    `);

    console.log('Seeding incidents...');
    await client.query(`
      INSERT INTO incidents (title, incident_type, severity, date, location, facility, product_affected, temperature_recorded, description, root_cause, corrective_action, status, reported_by, assigned_to, resolution_date) VALUES
      ('Freezer Unit Failure - Bay 3', 'equipment_failure', 'critical', '2026-03-18 14:30:00+00', 'Warehouse C - Bay 3', 'Warehouse C', 'Cheese (500kg)', 7.8, 'Freezer compressor failed causing temperature rise from -2C to 7.8C over 4 hours', 'Compressor motor burnout due to age', 'Emergency product transfer to Bay 1; compressor replacement ordered', 'investigating', 'Sensor Alert System', 'Mike Rodriguez', NULL),
      ('Transport Delay - Vaccine Shipment', 'transport_delay', 'critical', '2026-03-17 09:00:00+00', 'Interstate 95 Corridor', 'Distribution Center 2', 'COVID Vaccines (2000 doses)', 5.2, 'Vehicle breakdown caused 6-hour delay; backup cooling maintained but temps elevated', 'Alternator failure on truck T-107', 'Switched to backup vehicle; vaccines assessed by QA', 'resolved', 'Driver J. Thompson', 'Dr. Lisa Chen', '2026-03-17'),
      ('Temperature Excursion - Deli Case', 'temperature_excursion', 'high', '2026-03-19 06:40:00+00', 'Retail Store 5 - Deli', 'Retail Store 5', 'Deli Meats (assorted)', 6.5, 'Display case temperature exceeded 4C threshold overnight', 'Door gasket seal degraded', 'Product discarded; gasket replacement scheduled', 'open', 'Store Manager', 'Maintenance Team', NULL),
      ('Humidity Spike - Pharma Storage', 'environmental', 'medium', '2026-03-16 22:15:00+00', 'Warehouse D - Pharma Wing', 'Warehouse D', 'Insulin Pens', 5.0, 'Humidity rose to 72% in controlled area (limit 60%)', 'HVAC dehumidifier malfunction', 'Dehumidifier repaired; products inspected and cleared', 'resolved', 'Night Shift Supervisor', 'HVAC Team', '2026-03-17'),
      ('Loading Dock Door Left Open', 'procedural', 'medium', '2026-03-15 11:20:00+00', 'Warehouse A - Loading Dock 2', 'Warehouse A', 'Dairy Products (mixed)', 8.2, 'Loading dock door left open for 45 minutes during delivery causing cold zone temp increase', 'Delivery driver did not follow closing protocol', 'Retraining scheduled; auto-close timer installed', 'resolved', 'Warehouse Supervisor', 'Operations Manager', '2026-03-16'),
      ('Frozen Food Thaw Event', 'temperature_excursion', 'high', '2026-03-19 05:30:00+00', 'Retail Store 12 - Frozen', 'Retail Store 12', 'Frozen Vegetables (200 units)', -12.3, 'Frozen display case temperature rose above -15C threshold', 'Defrost cycle timer malfunction', 'Product assessed; defrost timer reset', 'open', 'Store Associate', 'Refrigeration Tech', NULL),
      ('Contamination Scare - Seafood', 'contamination', 'critical', '2026-03-14 16:00:00+00', 'Processing Plant - Line B', 'Processing Plant', 'Fresh Salmon (100kg batch)', 1.5, 'Potential cross-contamination detected during routine testing', 'Improper sanitization between product changeover', 'Batch quarantined; deep cleaning performed; retest scheduled', 'investigating', 'QA Lab Tech', 'QA Manager', NULL),
      ('Power Outage - Warehouse B', 'power_failure', 'critical', '2026-03-13 02:30:00+00', 'Warehouse B', 'Warehouse B', 'Frozen Seafood, Ice Cream (all units)', -16.0, 'Grid power outage lasted 3 hours; generators activated after 15-minute delay', 'Utility grid failure; generator auto-start delayed', 'Generator auto-start system repaired; UPS installed', 'resolved', 'Night Security', 'Facilities Manager', '2026-03-14'),
      ('Incorrect Temperature Setpoint', 'procedural', 'low', '2026-03-12 10:00:00+00', 'Distribution Center 1', 'Distribution Center 1', 'Fresh Produce', 8.0, 'Temperature setpoint accidentally changed from 4C to 8C during system maintenance', 'Technician error during calibration', 'Setpoint corrected; dual-approval required for changes', 'resolved', 'System Monitor', 'IT Manager', '2026-03-12'),
      ('Truck Refrigeration Malfunction', 'equipment_failure', 'high', '2026-03-11 07:45:00+00', 'Transport Truck T-102', 'Mobile', 'Frozen Meals (1200 units)', -10.0, 'Reefer unit intermittent failure during long-haul delivery', 'Refrigerant leak in transport unit', 'Emergency repair at truck stop; product temp verified on arrival', 'resolved', 'Driver K. Patel', 'Fleet Manager', '2026-03-11'),
      ('Sensor Calibration Drift', 'equipment_failure', 'medium', '2026-03-10 14:00:00+00', 'Warehouse A - Bay 2', 'Warehouse A', 'Meat Products', 0.5, 'Sensor SENS-002 reading 1.5C below actual temperature for 3 days', 'Sensor drift from calibration', 'Sensor recalibrated; readings verified with reference thermometer', 'resolved', 'Maintenance Tech', 'Calibration Team', '2026-03-11'),
      ('Pest Detection Near Cold Storage', 'contamination', 'medium', '2026-03-09 09:30:00+00', 'Warehouse A - Exterior', 'Warehouse A', 'No direct product impact', NULL, 'Rodent activity detected near loading dock area', 'Gaps in exterior building envelope', 'Pest control deployed; building gaps sealed', 'resolved', 'Warehouse Staff', 'Facilities Manager', '2026-03-10'),
      ('Mislabeled Product Temperature', 'procedural', 'low', '2026-03-08 13:15:00+00', 'Distribution Center 2', 'Distribution Center 2', 'Fresh Fish (50kg)', 0.5, 'Product labeled as frozen (-18C) but stored at refrigerated temps (0C)', 'Labeling error at origin facility', 'Product relabeled; origin facility notified', 'resolved', 'Receiving Clerk', 'QA Supervisor', '2026-03-08'),
      ('Emergency HVAC Shutdown', 'equipment_failure', 'high', '2026-03-07 20:00:00+00', 'Warehouse D - Pharma Wing', 'Warehouse D', 'Pharmaceutical Products (various)', 9.0, 'HVAC system emergency shutdown due to electrical fault', 'Electrical short in control panel', 'Portable cooling units deployed; HVAC repaired next day', 'resolved', 'Building Alarm System', 'Facilities Manager', '2026-03-08'),
      ('Driver Protocol Violation', 'procedural', 'low', '2026-03-06 16:30:00+00', 'Route: DC1 to Retail Store 5', 'Mobile', 'Mixed Perishables', 5.0, 'Driver made unauthorized 2-hour stop with reefer on economy mode', 'Driver deviation from route protocol', 'Written warning issued; GPS tracking enhanced', 'resolved', 'Fleet GPS System', 'Fleet Manager', '2026-03-07'),
      ('Blood Product Temperature Alert', 'temperature_excursion', 'critical', '2026-03-19 07:00:00+00', 'Transport Truck T-103', 'Mobile', 'Blood Plasma (50 units)', 6.8, 'Blood product transport temperature exceeded 6C threshold', 'Reefer unit thermostat malfunction', 'Products assessed by blood bank; thermostat replaced', 'open', 'Driver Alert System', 'Medical Logistics Lead', NULL)
    `);

    console.log('Seeding audit_log...');
    await client.query(`
      INSERT INTO audit_log (entity_type, entity_id, action, user_name, user_email, changes, created_at) VALUES
      ('temperature_reading', 11, 'create', 'Admin User', 'admin@coldchain.com', '{"sensor_id": "SENS-011", "location": "Warehouse C - Bay 3", "temperature": 7.8}', '2026-03-19 09:00:00+00'),
      ('incident', 1, 'create', 'Admin User', 'admin@coldchain.com', '{"title": "Freezer Unit Failure - Bay 3", "severity": "critical"}', '2026-03-18 14:35:00+00'),
      ('compliance_record', 4, 'update', 'Operations Manager', 'manager@coldchain.com', '{"status": {"from": "pending", "to": "non-compliant"}, "findings": "Temperature monitoring gaps"}', '2026-03-01 10:00:00+00'),
      ('carrier', 8, 'update', 'Admin User', 'admin@coldchain.com', '{"status": {"from": "under_review", "to": "suspended"}, "reason": "Too many incidents"}', '2026-03-15 14:00:00+00'),
      ('spoilage_prediction', 16, 'update', 'Admin User', 'admin@coldchain.com', '{"status": {"from": "active", "to": "expired"}}', '2026-03-17 08:00:00+00'),
      ('temperature_reading', 9, 'create', 'Admin User', 'admin@coldchain.com', '{"sensor_id": "SENS-009", "temperature": 6.5, "status": "alert"}', '2026-03-19 08:40:00+00'),
      ('incident', 3, 'create', 'Admin User', 'admin@coldchain.com', '{"title": "Temperature Excursion - Deli Case", "severity": "high"}', '2026-03-19 06:45:00+00'),
      ('carrier', 5, 'update', 'Operations Manager', 'manager@coldchain.com', '{"status": {"from": "active", "to": "under_review"}}', '2026-02-20 09:00:00+00'),
      ('user', 3, 'create', 'Admin User', 'admin@coldchain.com', '{"name": "Operations Manager", "role": "manager"}', '2026-01-15 10:00:00+00'),
      ('compliance_record', 15, 'create', 'Admin User', 'admin@coldchain.com', '{"regulation": "FDA 21 CFR 820", "status": "non-compliant"}', '2026-03-12 11:00:00+00')
    `);

    console.log('Seed complete!');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
