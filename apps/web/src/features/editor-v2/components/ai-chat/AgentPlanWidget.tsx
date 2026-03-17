'use client';

import React, { useState, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { CheckCircle2, Circle, CircleDotDashed, CircleX, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentPlan, AgentTask, AgentSubtask } from './types';
import { AGENT_STYLES } from './types';

interface AgentPlanWidgetProps {
  plan: AgentPlan;
}

const StatusIcon = memo(function StatusIcon({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  switch (status) {
    case 'complete':
      return <CheckCircle2 className={cn(cls, 'text-green-400')} />;
    case 'running':
      return <CircleDotDashed className={cn(cls, 'text-blue-400 animate-spin')} style={{ animationDuration: '3s' }} />;
    case 'failed':
      return <CircleX className={cn(cls, 'text-red-400')} />;
    default:
      return <Circle className={cn(cls, 'text-white/20')} />;
  }
});

const SubtaskRow = memo(function SubtaskRow({ subtask }: { subtask: AgentSubtask }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-0.5 pl-6"
    >
      <StatusIcon status={subtask.status} />
      <span className={cn(
        'text-xs',
        subtask.status === 'complete' ? 'text-white/30 line-through' : 'text-white/60',
      )}>
        {subtask.title}
      </span>
      {subtask.tools && subtask.tools.length > 0 && (
        <div className="flex gap-1 ml-auto">
          {subtask.tools.map((t, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-white/30 border border-white/[0.04]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
});

const TaskRow = memo(function TaskRow({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(task.status === 'running');
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const agentStyle = task.agent ? AGENT_STYLES[task.agent] : null;

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
        onClick={() => hasSubtasks && setExpanded(!expanded)}
        layout
      >
        {hasSubtasks && (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="h-3 w-3 text-white/20" />
          </motion.div>
        )}
        {!hasSubtasks && <div className="w-3" />}

        <StatusIcon status={task.status} size="md" />

        <span className={cn(
          'text-sm flex-1',
          task.status === 'complete' ? 'text-white/40 line-through' : 'text-white/80',
        )}>
          {task.title}
        </span>

        {agentStyle && task.status === 'running' && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-full border"
            style={{
              color: agentStyle.color,
              borderColor: `${agentStyle.color}33`,
              backgroundColor: `${agentStyle.color}15`,
            }}
          >
            {agentStyle.icon} {task.agent}
          </span>
        )}
      </motion.div>

      <AnimatePresence>
        {expanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden relative"
          >
            <div className="absolute top-0 bottom-0 left-[22px] border-l border-dashed border-white/[0.08]" />
            {task.subtasks!.map((st) => (
              <SubtaskRow key={st.id} subtask={st} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const AgentPlanWidget = memo(function AgentPlanWidget({ plan }: AgentPlanWidgetProps) {
  const completedCount = plan.tasks.filter(t => t.status === 'complete').length;
  const totalCount = plan.tasks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
      className="w-full my-2 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-xs text-white/50 font-normal">{plan.title}</span>
        <span className="text-[10px] text-white/30">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Task list */}
      <LayoutGroup>
        <div className="p-1.5 space-y-0.5">
          {plan.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </LayoutGroup>
    </motion.div>
  );
});
