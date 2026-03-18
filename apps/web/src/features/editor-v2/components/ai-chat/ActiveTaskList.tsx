'use client';

import React, { memo, useState, useEffect } from 'react';
import type { ActiveTask } from './types';
import { AGENT_STYLES } from './types';

interface ActiveTaskListProps {
  tasks: ActiveTask[];
  busy: boolean;
  isVisible: boolean;
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return <span className="text-[10px] tabular-nums opacity-60">{min > 0 ? `${min}m ${sec}s` : `${sec}s`}</span>;
}

function TaskRow({ task }: { task: ActiveTask }) {
  const style = AGENT_STYLES[task.agent] ?? { color: '#94a3b8', icon: '●' };
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 transition-opacity duration-[2000ms] ${isCompleted ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Pulsing dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCompleted ? '' : 'animate-pulse'}`}
        style={{ backgroundColor: style.color }}
      />
      {/* Agent badge */}
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: `${style.color}20`, color: style.color }}
      >
        {style.icon} {task.agent}
      </span>
      {/* Action text */}
      <span className="text-xs text-[var(--editor-text-secondary)] truncate flex-1">
        {task.action}
      </span>
      {/* Target (e.g., scene name) */}
      {task.target && (
        <span className="text-[10px] text-[var(--editor-text-muted)] flex-shrink-0">
          {task.target}
        </span>
      )}
      {/* Elapsed time */}
      <ElapsedTime startedAt={task.startedAt} />
    </div>
  );
}

export const ActiveTaskList = memo(function ActiveTaskList({ tasks, busy, isVisible }: ActiveTaskListProps) {
  // Stable fallback timestamp — avoids creating new Date.now() on every render
  const fallbackStartRef = React.useRef(Date.now());

  if (!isVisible || !busy) return null;

  // If busy but no tasks, show fallback
  const activeTasks = tasks.length > 0 ? tasks : [
    { id: 'fallback', agent: 'Viona', action: 'Working...', startedAt: fallbackStartRef.current, status: 'active' as const },
  ];

  return (
    <div className="rounded-xl border border-[var(--chat-bubble-assistant-border)] bg-[var(--chat-bubble-assistant-bg)] backdrop-blur-xl overflow-hidden">
      {activeTasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
});
