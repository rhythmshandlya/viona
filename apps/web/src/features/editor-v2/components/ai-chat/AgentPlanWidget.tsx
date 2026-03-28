'use client';

import React, { memo } from 'react';
import { AgentPlanView } from '@/components/ui/agent-plan';
import type { AgentPlan } from '@/components/ui/agent-plan';

interface AgentPlanWidgetProps {
  plan: AgentPlan;
}

export const AgentPlanWidget = memo(function AgentPlanWidget({ plan }: AgentPlanWidgetProps) {
  return (
    <AgentPlanView
      plan={plan}
      className="my-2 bg-[var(--chat-plan-bg,rgba(255,255,255,0.02))] border-[var(--chat-plan-border,rgba(255,255,255,0.06))]"
    />
  );
});
