import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { validateRuntime } from './config/runtime.js';
validateRuntime();
import { keysToCamel, keysToSnake } from './utils/caseConverter.js';

import authRoutes from './routes/auth.js';
import temperatureRoutes from './routes/temperature.js';
import spoilageRoutes from './routes/spoilage.js';
import complianceRoutes from './routes/compliance.js';
import carriersRoutes from './routes/carriers.js';
import incidentsRoutes from './routes/incidents.js';
import dashboardRoutes from './routes/dashboard.js';
import alertsRoutes from './routes/alerts.js';
import reportsRoutes from './routes/reports.js';
import usersRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import aiNewRoutes from './routes/aiNew.js';
import webhooksRoutes from './routes/webhooks.js';
import facilitiesRoutes from './routes/facilities.js';
import regulatoryRoutes from './routes/regulatory.js';
import predictiveRoutes from './routes/predictive.js';
import notificationsRoutes from './routes/notifications.js';
import customViewsRoutes from './routes/customViews.js';
import lotRecallTraceRoutes from './routes/lotRecallTrace.js';
import lotWorkflowRoutes from './routes/lotWorkflow.js';

import _route_coldChainAgent from './routes/coldChainAgent.js';
import _route_gdpCfrRag from './routes/gdpCfrRag.js';
import _route_sensorAnomalyStream from './routes/sensorAnomalyStream.js';
import _route_threePlPharmaWhiteLabel from './routes/threePlPharmaWhiteLabel.js';
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS - env-driven allowlist (CORS_ORIGINS=comma-separated, defaults to FRONTEND_URL or localhost)
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Convert incoming camelCase request bodies to snake_case for DB
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = keysToSnake(req.body);
  }
  next();
});

// Override res.json to convert snake_case response to camelCase for frontend
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (data && typeof data === 'object') {
      return originalJson(keysToCamel(data));
    }
    return originalJson(data);
  };
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/temperature', temperatureRoutes);
app.use('/api/spoilage', spoilageRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/carriers', carriersRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiNewRoutes);
// Webhooks router
app.use('/api/webhooks', webhooksRoutes);
// New custom non-CRUD features
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/regulatory', regulatoryRoutes);
app.use('/api/predictive', predictiveRoutes);
// Audit-recommended addition (notifications)
app.use('/api/notifications', notificationsRoutes);
// Custom views: 4 synthesized cold-chain endpoints
app.use('/api/custom-views', customViewsRoutes);
app.use('/api/lot-recall-trace', lotRecallTraceRoutes);
app.use('/api/lot-workflow', lotWorkflowRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});


app.use('/api/cold-chain-agent', _route_coldChainAgent); // apply pass 6 — audit custom suggestion

app.use('/api/gdp-cfr-rag', _route_gdpCfrRag); // apply pass 6 — audit custom suggestion

app.use('/api/sensor-anomaly', _route_sensorAnomalyStream); // apply pass 6 — audit custom suggestion

app.use('/api/three-pl-pharma', _route_threePlPharmaWhiteLabel); // apply pass 6 — audit custom suggestion
app.listen(PORT, () => {
  console.log(`Cold Chain Backend running on port ${PORT}`);
});

export default app;


// === Batch 01 Gaps & Frontend Mounts (disabled — pre-existing CJS require() in ESM project) ===
// app.use('/api/gap-0-mounted-chat-style-ai-endpoints-despite-ainew-js', require('./routes/gap_0_mounted_chat_style_ai_endpoints_despite_ainew_js'));
// app.use('/api/gap-no-ai-excursion-classification-real-vs-sensor-glit', require('./routes/gap_no_ai_excursion_classification_real_vs_sensor_glit'));
// app.use('/api/gap-no-ai-predictive-route-risk-scoring', require('./routes/gap_no_ai_predictive_route_risk_scoring'));
// app.use('/api/gap-no-ai-auto-generated-deviation-reports-for-regulat', require('./routes/gap_no_ai_auto_generated_deviation_reports_for_regulat'));
// app.use('/api/gap-no-ai-spoilage-forecast-at-lot-level', require('./routes/gap_no_ai_spoilage_forecast_at_lot_level'));
// app.use('/api/gap-notification-routes-exist-but-no-sms-push-delivery', require('./routes/gap_notification_routes_exist_but_no_sms_push_delivery'));
// app.use('/api/gap-no-live-iot-sensor-stream-ingestion-layer-only-sto', require('./routes/gap_no_live_iot_sensor_stream_ingestion_layer_only_sto'));
// app.use('/api/gap-no-direct-carrier-edi-api-for-eta-updates', require('./routes/gap_no_direct_carrier_edi_api_for_eta_updates'));
// app.use('/api/gap-no-multi-product-pharma-vs-food-regulatory-templat', require('./routes/gap_no_multi_product_pharma_vs_food_regulatory_templat'));
// app.use('/api/gap-no-customer-lot-recall-workflow', require('./routes/gap_no-customer-lot-recall-workflow'));
