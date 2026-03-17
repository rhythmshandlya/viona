'use client';

import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProgressState } from './types';
import { AGENT_STYLES } from './types';

interface ProgressIndicatorProps {
  progress: ProgressState | null;
  isVisible: boolean;
}

function formatElapsed(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
}

export const ProgressIndicator = memo(function ProgressIndicator({
  progress,
  isVisible,
}: ProgressIndicatorProps) {
  const [, setTick] = useState(0);

  // Tick every second to update elapsed time
  useEffect(() => {
    if (!isVisible || !progress) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isVisible, progress]);

  const agentStyle = progress?.agentName ? AGENT_STYLES[progress.agentName] : null;

  return (
    <AnimatePresence>
      {isVisible && progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
          className="w-full my-1"
        >
          <div className="flex items-center gap-2.5 h-8 px-3 rounded-lg bg-[var(--chat-progress-bg)] backdrop-blur-xl">
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ backgroundColor: agentStyle?.color ?? '#60a5fa' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: agentStyle?.color ?? '#60a5fa' }}
              />
            </span>

            {/* Agent badge */}
            {progress.agentName && agentStyle && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border"
                style={{
                  color: agentStyle.color,
                  borderColor: `${agentStyle.color}33`,
                  backgroundColor: `${agentStyle.color}15`,
                }}
              >
                {agentStyle.icon} {progress.agentName}
              </span>
            )}

            {/* Status message */}
            <span className="flex-1 text-xs text-white/50 truncate">
              {progress.message}
            </span>

            {/* Elapsed time */}
            <span className="text-xs text-white/30 tabular-nums">
              {formatElapsed(progress.startedAt)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
