import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
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

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

app.use(express.json());

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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Cold Chain Backend running on port ${PORT}`);
});

export default app;
