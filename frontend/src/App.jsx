import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TemperaturePage from './pages/TemperaturePage';
import SpoilagePage from './pages/SpoilagePage';
import CompliancePage from './pages/CompliancePage';
import CarriersPage from './pages/CarriersPage';
import IncidentsPage from './pages/IncidentsPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RegulatoryPage from './pages/RegulatoryPage';
import PredictivePage from './pages/PredictivePage';
import NotificationsPage from './pages/NotificationsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import CustomViewsPage from './pages/CustomViewsPage';

function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

function App() {
  const [, setForceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => setForceUpdate((n) => n + 1), []);

  return (
    <>
      <div className="toast-container" id="toast-container"></div>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={triggerUpdate} />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/temperature"
          element={
            <ProtectedRoute>
              <TemperaturePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spoilage"
          element={
            <ProtectedRoute>
              <SpoilagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compliance"
          element={
            <ProtectedRoute>
              <CompliancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/carriers"
          element={
            <ProtectedRoute>
              <CarriersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidents"
          element={
            <ProtectedRoute>
              <IncidentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/facilities"
          element={
            <ProtectedRoute>
              <FacilitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/regulatory"
          element={
            <ProtectedRoute>
              <RegulatoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/predictive"
          element={
            <ProtectedRoute>
              <PredictivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute>
              <AIAssistantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/custom-views"
          element={
            <ProtectedRoute>
              <CustomViewsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
