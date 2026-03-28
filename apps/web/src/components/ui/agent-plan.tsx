"use client";

import React, { useState, memo } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import type {
  AgentPlan,
  AgentTask,
  AgentSubtask,
} from "@viona/shared/progress-types";

// Re-export types for convenience
export type { AgentPlan, AgentTask, AgentSubtask };

// Agent color config — maps agent names to visual styles
const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  "Trim Editor":    { color: "#60a5fa", icon: "✂" },
  Planner:          { color: "#a78bfa", icon: "◈" },
  "Setup Agent":    { color: "#818cf8", icon: "⚙" },
  "Layout Editor":  { color: "#fbbf24", icon: "▦" },
  Animator:         { color: "#34d399", icon: "◆" },
  "Final Editor":   { color: "#c084fc", icon: "✓" },
};

// Reduced motion preference (static at module level for SSR safety)
const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const taskVariants = {
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: prefersReducedMotion ? "tween" : "spring",
      stiffness: 500,
      damping: 30,
      duration: prefersReducedMotion ? 0.2 : undefined,
    },
  },
};

const subtaskListVariants = {
  hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
  visible: {
    height: "auto" as const,
    opacity: 1,
    overflow: "visible" as const,
    transition: {
      duration: 0.25,
      staggerChildren: prefersReducedMotion ? 0 : 0.05,
      when: "beforeChildren" as const,
      ease: [0.2, 0.65, 0.3, 0.9],
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
    transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] },
  },
};

const subtaskVariants = {
  hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: prefersReducedMotion ? "tween" : "spring",
      stiffness: 500,
      damping: 25,
      duration: prefersReducedMotion ? 0.2 : undefined,
    },
  },
  exit: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : -10,
    transition: { duration: 0.15 },
  },
};

const statusBadgeVariants = {
  initial: { scale: 1 },
  animate: {
    scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
    transition: {
      duration: 0.35,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusIcon({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
        transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      >
        {status === "complete" ? (
          <CheckCircle2 className={cn(cls, "text-green-400")} />
        ) : status === "running" ? (
          <CircleDotDashed
            className={cn(cls, "text-blue-400 animate-spin")}
            style={{ animationDuration: "3s" }}
          />
        ) : status === "failed" ? (
          <CircleX className={cn(cls, "text-red-400")} />
        ) : (
          <Circle className={cn(cls, "text-white/20")} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "complete": return "done";
    case "running": return "working";
    case "failed": return "failed";
    default: return "queued";
  }
}

function statusBadgeColors(status: string): string {
  switch (status) {
    case "complete": return "bg-green-500/15 text-green-400";
    case "running": return "bg-blue-500/15 text-blue-400";
    case "failed": return "bg-red-500/15 text-red-400";
    default: return "bg-white/[0.06] text-white/40";
  }
}

// ---------------------------------------------------------------------------
// SubtaskRow
// ---------------------------------------------------------------------------

const SubtaskRow = memo(function SubtaskRow({ subtask }: { subtask: AgentSubtask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.li
      className="group flex flex-col py-0.5 pl-6"
      variants={subtaskVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <motion.div
        className="flex flex-1 items-center rounded-md p-1 cursor-pointer"
        whileHover={{
          backgroundColor: "rgba(255,255,255,0.03)",
          transition: { duration: 0.2 },
        }}
        onClick={() => setExpanded(!expanded)}
        layout
      >
        <div className="mr-2 flex-shrink-0">
          <StatusIcon status={subtask.status} />
        </div>

        <span
          className={cn(
            "text-xs flex-1",
            subtask.status === "complete"
              ? "text-white/30 line-through"
              : "text-white/60",
          )}
        >
          {subtask.title}
        </span>
      </motion.div>

      <AnimatePresence mode="wait">
        {expanded && subtask.tools && subtask.tools.length > 0 && (
          <motion.div
            className="mt-0.5 mb-1 ml-7 flex flex-wrap items-center gap-1.5 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: "auto",
              transition: { duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] },
            }}
            exit={{
              opacity: 0,
              height: 0,
              transition: { duration: 0.2 },
            }}
            layout
          >
            <span className="text-white/25 text-[10px] font-medium">Tools:</span>
            {subtask.tools.map((tool, idx) => (
              <motion.span
                key={idx}
                className="bg-white/[0.06] text-white/30 rounded px-1.5 py-0.5 text-[10px] font-medium border border-white/[0.04]"
                initial={{ opacity: 0, y: -5 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.2, delay: idx * 0.05 },
                }}
                whileHover={{
                  y: -1,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  transition: { duration: 0.2 },
                }}
              >
                {tool}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
});

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

const TaskRow = memo(function TaskRow({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(task.status === "running");
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const agentStyle = task.agent ? AGENT_STYLES[task.agent] : null;

  return (
    <motion.li
      initial="hidden"
      animate="visible"
      variants={taskVariants}
    >
      {/* Task header */}
      <motion.div
        className="group flex items-center px-3 py-1.5 rounded-md cursor-pointer"
        whileHover={{
          backgroundColor: "rgba(255,255,255,0.03)",
          transition: { duration: 0.2 },
        }}
        onClick={() => hasSubtasks && setExpanded(!expanded)}
      >
        <motion.div className="mr-2 flex-shrink-0" whileTap={{ scale: 0.9 }}>
          <StatusIcon status={task.status} size="md" />
        </motion.div>

        <div className="flex min-w-0 flex-grow items-center justify-between">
          <span
            className={cn(
              "text-sm flex-1 truncate mr-2",
              task.status === "complete"
                ? "text-white/30 line-through"
                : "text-white/80",
            )}
          >
            {task.title}
          </span>

          <div className="flex flex-shrink-0 items-center gap-2 text-xs">
            {agentStyle && task.status === "running" && (
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

            <motion.span
              className={cn("rounded px-1.5 py-0.5 text-[10px]", statusBadgeColors(task.status))}
              variants={statusBadgeVariants}
              initial="initial"
              animate="animate"
              key={task.status}
            >
              {statusLabel(task.status)}
            </motion.span>
          </div>
        </div>
      </motion.div>

      {/* Subtask list */}
      <AnimatePresence mode="wait">
        {expanded && hasSubtasks && (
          <motion.div
            className="relative overflow-hidden"
            variants={subtaskListVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
          >
            {/* Vertical connecting line */}
            <div className="absolute top-0 bottom-0 left-[20px] border-l-2 border-dashed border-white/[0.08]" />
            <ul className="mt-1 mr-2 mb-1.5 ml-3 space-y-0.5">
              {task.subtasks!.map((subtask) => (
                <SubtaskRow key={subtask.id} subtask={subtask} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
});

// ---------------------------------------------------------------------------
// AgentPlanView (main export)
// ---------------------------------------------------------------------------

interface AgentPlanViewProps {
  plan: AgentPlan;
  className?: string;
}

export const AgentPlanView = memo(function AgentPlanView({ plan, className }: AgentPlanViewProps) {
  const completedCount = plan.tasks.filter((t) => t.status === "complete").length;
  const totalCount = plan.tasks.length;

  return (
    <motion.div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: [0.2, 0.65, 0.3, 0.9] },
      }}
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
        <div className="p-2 overflow-hidden">
          <ul className="space-y-1 overflow-hidden">
            {plan.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      </LayoutGroup>
    </motion.div>
  );
});

export default AgentPlanView;
