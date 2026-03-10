import React from 'react';
import type { HealthState } from '@viona/shared';

interface HealthIndicatorProps {
  health: HealthState | null;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  isActive: boolean;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  health,
  connectionStatus,
  isActive,
}) => {
  if (!isActive) return null;

  let color: string;
  let label: string;

  if (connectionStatus === 'disconnected') {
    color = 'rgb(250, 204, 21)';
    label = 'Reconnecting...';
  } else if (connectionStatus === 'reconnecting') {
    color = 'rgb(251, 146, 60)';
    label = 'Reconnecting...';
  } else if (!health) {
    color = 'rgb(34, 197, 94)';
    label = 'Connected';
  } else if (!health.processAlive && health.retriesUsed >= health.retriesMax) {
    color = 'rgb(239, 68, 68)';
    label = 'Process failed';
  } else if (!health.processAlive && health.retriesUsed < health.retriesMax) {
    color = 'rgb(251, 146, 60)';
    label = `Restarting (attempt ${health.retriesUsed + 1})...`;
  } else {
    const msSinceHeartbeat = Date.now() - health.lastHeartbeat;
    if (msSinceHeartbeat > 30_000) {
      color = 'rgb(250, 204, 21)';
      label = 'Waiting on AI response...';
    } else {
      color = 'rgb(34, 197, 94)';
      label = 'Agent working';
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.5)',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: color,
        animation: connectionStatus === 'reconnecting' ? 'pulse 1s infinite' : undefined,
      }} />
      {label}
    </div>
  );
};
