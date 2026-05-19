import React from 'react';
import ShipmentTemperatureTimeline from '../components/ShipmentTemperatureTimeline';
import BreachHeatmap from '../components/BreachHeatmap';
import FdaReportPanel from '../components/FdaReportPanel';
import ThresholdRulesEditor from '../components/ThresholdRulesEditor';

export default function CustomViewsPage() {
  return (
    <div data-testid="custom-views-page" style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ color: '#0b3d91', marginBottom: 4 }}>Cold Chain Views</h1>
        <p style={{ color: '#6b7280', marginTop: 0 }}>
          4 custom cold-chain logistics + compliance views (2 visualizations, 2 operations panels).
        </p>
      </div>
      <ShipmentTemperatureTimeline />
      <BreachHeatmap />
      <FdaReportPanel />
      <ThresholdRulesEditor />
    </div>
  );
}
