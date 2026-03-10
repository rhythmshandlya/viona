import React, { useState } from 'react';
import type { ActivityEvent } from '@viona/shared';

interface ActivityLogProps {
  events: ActivityEvent[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ events }) => {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  return (
    <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          cursor: 'pointer',
          padding: '4px 0',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          display: 'inline-block',
        }}>
          ▶
        </span>
        Activity Log ({events.length})
      </button>

      {expanded && (
        <div style={{
          maxHeight: 200,
          overflowY: 'auto',
          paddingLeft: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {events.map((event, i) => {
            const time = new Date(event.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const icon = event.type === 'error' ? '✗' :
                         event.type === 'health' ? '⚡' :
                         event.type === 'phase' ? '●' : '✓';
            const color = event.type === 'error' ? 'rgb(239, 68, 68)' :
                          event.type === 'health' ? 'rgb(250, 204, 21)' :
                          'rgba(255, 255, 255, 0.4)';

            return (
              <div key={i} style={{ display: 'flex', gap: 8, color }}>
                <span style={{ opacity: 0.6, flexShrink: 0 }}>{time}</span>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{event.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
