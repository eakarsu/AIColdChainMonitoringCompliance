const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('coldchain_token');
}

export function setToken(token) {
  localStorage.setItem('coldchain_token', token);
}

export function removeToken() {
  localStorage.removeItem('coldchain_token');
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// Auth
export const login = (email, password) =>
  apiRequest('/auth/login', { method: 'POST', body: { email, password } });

// Temperature
export const fetchTemperature = () => apiRequest('/temperature');
export const fetchTemperatureById = (id) => apiRequest(`/temperature/${id}`);
export const createTemperature = (data) =>
  apiRequest('/temperature', { method: 'POST', body: data });
export const updateTemperature = (id, data) =>
  apiRequest(`/temperature/${id}`, { method: 'PUT', body: data });
export const deleteTemperature = (id) =>
  apiRequest(`/temperature/${id}`, { method: 'DELETE' });
export const analyzeTemperature = (id) =>
  apiRequest(`/temperature/${id}/analyze`, { method: 'POST' });

// Spoilage
export const fetchSpoilage = () => apiRequest('/spoilage');
export const fetchSpoilageById = (id) => apiRequest(`/spoilage/${id}`);
export const createSpoilage = (data) =>
  apiRequest('/spoilage', { method: 'POST', body: data });
export const updateSpoilage = (id, data) =>
  apiRequest(`/spoilage/${id}`, { method: 'PUT', body: data });
export const deleteSpoilage = (id) =>
  apiRequest(`/spoilage/${id}`, { method: 'DELETE' });
export const predictSpoilage = (id) =>
  apiRequest(`/spoilage/${id}/predict`, { method: 'POST' });

// Compliance
export const fetchCompliance = () => apiRequest('/compliance');
export const fetchComplianceById = (id) => apiRequest(`/compliance/${id}`);
export const createCompliance = (data) =>
  apiRequest('/compliance', { method: 'POST', body: data });
export const updateCompliance = (id, data) =>
  apiRequest(`/compliance/${id}`, { method: 'PUT', body: data });
export const deleteCompliance = (id) =>
  apiRequest(`/compliance/${id}`, { method: 'DELETE' });
export const assessCompliance = (id) =>
  apiRequest(`/compliance/${id}/assess`, { method: 'POST' });

// Carriers
export const fetchCarriers = () => apiRequest('/carriers');
export const fetchCarriersById = (id) => apiRequest(`/carriers/${id}`);
export const createCarrier = (data) =>
  apiRequest('/carriers', { method: 'POST', body: data });
export const updateCarrier = (id, data) =>
  apiRequest(`/carriers/${id}`, { method: 'PUT', body: data });
export const deleteCarrier = (id) =>
  apiRequest(`/carriers/${id}`, { method: 'DELETE' });
export const scoreCarrier = (id) =>
  apiRequest(`/carriers/${id}/score`, { method: 'POST' });

// Incidents
export const fetchIncidents = () => apiRequest('/incidents');
export const fetchIncidentsById = (id) => apiRequest(`/incidents/${id}`);
export const createIncident = (data) =>
  apiRequest('/incidents', { method: 'POST', body: data });
export const updateIncident = (id, data) =>
  apiRequest(`/incidents/${id}`, { method: 'PUT', body: data });
export const deleteIncident = (id) =>
  apiRequest(`/incidents/${id}`, { method: 'DELETE' });
export const analyzeIncident = (id) =>
  apiRequest(`/incidents/${id}/analyze`, { method: 'POST' });

// Dashboard
export const fetchDashboardStats = () => apiRequest('/dashboard/stats');

// Alerts
export const fetchAlerts = (params = '') => apiRequest(`/alerts${params}`);
export const fetchAlertStats = () => apiRequest('/alerts/stats');
export const acknowledgeAlert = (id, data) =>
  apiRequest(`/alerts/${id}/acknowledge`, { method: 'POST', body: data });
export const dismissAlert = (id) =>
  apiRequest(`/alerts/${id}/dismiss`, { method: 'POST' });

// Reports
export const fetchReportSummary = () => apiRequest('/reports/summary');

// Users
export const fetchUsers = () => apiRequest('/users');
export const createUser = (data) =>
  apiRequest('/users', { method: 'POST', body: data });
export const updateUser = (id, data) =>
  apiRequest(`/users/${id}`, { method: 'PUT', body: data });
export const deleteUser = (id) =>
  apiRequest(`/users/${id}`, { method: 'DELETE' });

// Audit Log
export const fetchAuditLog = (params = '') => apiRequest(`/audit${params}`);
export const fetchAuditStats = () => apiRequest('/audit/stats');

// Facilities (NEW: Multi-Facility Aggregation)
export const fetchFacilities = (params = '') => apiRequest(`/facilities${params}`);
export const createFacility = (data) => apiRequest('/facilities', { method: 'POST', body: data });
export const updateFacility = (id, data) => apiRequest(`/facilities/${id}`, { method: 'PUT', body: data });
export const deleteFacility = (id) => apiRequest(`/facilities/${id}`, { method: 'DELETE' });
export const fetchFacilityRollup = () => apiRequest('/facilities/rollup');
export const generateFacilityInsights = () => apiRequest('/facilities/insights', { method: 'POST' });

// Regulatory (NEW: Regulatory Change Alerts)
export const fetchRegulatoryChanges = (params = '') => apiRequest(`/regulatory${params}`);
export const createRegulatoryChange = (data) => apiRequest('/regulatory', { method: 'POST', body: data });
export const updateRegulatoryChange = (id, data) => apiRequest(`/regulatory/${id}`, { method: 'PUT', body: data });
export const deleteRegulatoryChange = (id) => apiRequest(`/regulatory/${id}`, { method: 'DELETE' });
export const assessRegulatoryChange = (id) => apiRequest(`/regulatory/${id}/assess`, { method: 'POST' });
export const acknowledgeRegulatoryChange = (id) => apiRequest(`/regulatory/${id}/acknowledge`, { method: 'POST' });

// Predictive (NEW: Predictive Alerts + Trends + IoT Hub + Scheduled Reports)
export const fetchPredictiveAlerts = (params = '') => apiRequest(`/predictive/alerts${params}`);
export const generatePredictiveAlert = (sensorId, productType) => apiRequest(`/predictive/generate/${sensorId}`, { method: 'POST', body: { product_type: productType } });
export const dismissPredictiveAlert = (id) => apiRequest(`/predictive/alerts/${id}/dismiss`, { method: 'POST' });
export const fetchTrend = (sensorId, windowHours = 24) => apiRequest(`/predictive/trend/${sensorId}?window_hours=${windowHours}`);
export const fetchIoTSources = () => apiRequest('/predictive/iot/sources');
export const createIoTSource = (data) => apiRequest('/predictive/iot/sources', { method: 'POST', body: data });
export const revokeIoTSource = (id) => apiRequest(`/predictive/iot/sources/${id}`, { method: 'DELETE' });
export const fetchScheduledReports = () => apiRequest('/predictive/reports/scheduled');
export const createScheduledReport = (data) => apiRequest('/predictive/reports/scheduled', { method: 'POST', body: data });
export const deleteScheduledReport = (id) => apiRequest(`/predictive/reports/scheduled/${id}`, { method: 'DELETE' });

// Carrier performance (NEW)
export const fetchCarrierPerformance = (id) => apiRequest(`/carriers/${id}/performance`);

// Spoilage cost (NEW)
export const calculateSpoilageCostApi = (id) => apiRequest(`/spoilage/${id}/cost`, { method: 'POST' });

// AI assistant (NEW: route optimization + contamination risk)
export const aiRouteOptimization = (data) =>
  apiRequest('/ai/route-optimization', { method: 'POST', body: data });
export const aiContaminationRisk = (data) =>
  apiRequest('/ai/contamination-risk', { method: 'POST', body: data });
// Apply pass 4: regulatory-compliance check (RAG-style with inline excerpts)
export const aiRegulatoryComplianceCheck = (data) =>
  apiRequest('/ai/regulatory-compliance-check', { method: 'POST', body: data });
// Apply pass 4: single-step deviation investigation agent (root cause + CAPA)
export const aiDeviationInvestigation = (data) =>
  apiRequest('/ai/deviation-investigation', { method: 'POST', body: data });

// Notifications (NEW)
export const fetchNotifications = () => apiRequest('/notifications');
export const fetchNotificationsUnreadCount = () => apiRequest('/notifications/unread-count');
export const createNotification = (data) => apiRequest('/notifications', { method: 'POST', body: data });
export const markNotificationRead = (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
export const markAllNotificationsRead = () => apiRequest('/notifications/mark-all-read', { method: 'POST' });
export const deleteNotification = (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' });
