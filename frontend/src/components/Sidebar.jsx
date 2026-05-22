import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiGrid, FiThermometer, FiAlertTriangle, FiShield, FiTruck, FiFileText, FiLogOut, FiMenu, FiX, FiBell, FiBarChart2, FiUsers, FiClock, FiHome, FiBookOpen, FiZap, FiCpu, FiLayers } from 'react-icons/fi';
import { removeToken } from '../api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: FiGrid },
  { path: '/temperature', label: 'Temperature Monitoring', icon: FiThermometer },
  { path: '/spoilage', label: 'Spoilage Predictions', icon: FiAlertTriangle },
  { path: '/compliance', label: 'FDA/HACCP Compliance', icon: FiShield },
  { path: '/carriers', label: 'Carrier Scoring', icon: FiTruck },
  { path: '/incidents', label: 'Incident Documentation', icon: FiFileText },
  { path: '/alerts', label: 'Alerts', icon: FiBell },
  { path: '/notifications', label: 'Notifications', icon: FiBell },
  { path: '/facilities', label: 'Facilities (Multi-Site)', icon: FiHome },
  { path: '/regulatory', label: 'Regulatory Changes', icon: FiBookOpen },
  { path: '/predictive', label: 'Predictive Ops', icon: FiZap },
  { path: '/ai-assistant', label: 'AI Assistant', icon: FiCpu },
  { path: '/lot-recall-trace', label: 'Lot Recall Trace', icon: FiAlertTriangle },
  { path: '/reports', label: 'Reports & Export', icon: FiBarChart2 },
  { path: '/users', label: 'User Management', icon: FiUsers },
  { path: '/audit', label: 'Audit Log', icon: FiClock },
  { path: '/custom-views', label: 'Cold Chain Views', icon: FiLayers },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <>
      <button className="mobile-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FiX /> : <FiMenu />}
      </button>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <FiThermometer />
          </div>
          <div>
            <h1>ColdChain AI</h1>
            <span>Monitoring & Compliance</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <FiLogOut />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
