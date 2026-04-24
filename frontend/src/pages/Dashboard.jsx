import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiThermometer,
  FiAlertTriangle,
  FiShield,
  FiTruck,
  FiFileText,
  FiActivity,
} from 'react-icons/fi';
import { fetchDashboardStats } from '../api';

const statCards = [
  {
    key: 'totalReadings',
    label: 'Total Readings',
    icon: FiThermometer,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    route: '/temperature',
  },
  {
    key: 'activeAlerts',
    label: 'Active Alerts',
    icon: FiAlertTriangle,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    route: '/temperature',
  },
  {
    key: 'complianceRate',
    label: 'Compliance Rate',
    icon: FiShield,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    route: '/compliance',
    suffix: '%',
  },
  {
    key: 'avgCarrierScore',
    label: 'Avg Carrier Score',
    icon: FiTruck,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)',
    route: '/carriers',
  },
  {
    key: 'openIncidents',
    label: 'Open Incidents',
    icon: FiFileText,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    route: '/incidents',
  },
  {
    key: 'spoilagePredictions',
    label: 'Spoilage Predictions',
    icon: FiActivity,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
    route: '/spoilage',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Cold chain monitoring overview</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((card) => {
            const value = stats?.[card.key] ?? '—';
            return (
              <div
                key={card.key}
                className="stat-card"
                onClick={() => navigate(card.route)}
              >
                <div className="stat-card-icon" style={{ background: card.bg, color: card.color }}>
                  <card.icon />
                </div>
                <div className="stat-card-value">
                  {value !== '—' ? `${value}${card.suffix || ''}` : '—'}
                </div>
                <div className="stat-card-label">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
