'use client';

import React, { memo, useState } from 'react';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';
import type { WidgetBlock } from './types';
import type { AgentPlan } from '@viona/shared/progress-types';
import { ScenePlanCard } from '../agent-widgets/ScenePlanCard';

interface WidgetRendererProps {
  block: WidgetBlock;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string, planJobId: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
  disabled?: boolean;
}

// Multi-question choice widget with accumulated answers
function MultiQuestionChoice({
  widget,
  response,
  onWidgetResponse,
  disabled,
}: {
  widget: WidgetBlock['widget'];
  response: unknown;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const questions = widget.questions as any[];
  const title = (widget.title ?? widget.message) as string | undefined;
  const isApproved = response != null;
  const [selections, setSelections] = useState<Record<string, string>>({});
  const allAnswered = questions.every((q: any) => selections[q.id] != null);

  return (
    <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl space-y-3">
      {title && <p className="text-sm font-medium text-white/80">{title}</p>}
      {questions.map((q: any, qi: number) => (
        <div key={q.id ?? qi}>
          <p className="text-sm text-white/60 mb-1.5">{q.question}</p>
          <div className="flex flex-wrap gap-2">
            {((q.options as any[]) ?? []).map((opt: any, oi: number) => {
              const optId = opt.id ?? opt.value ?? opt.label ?? String(oi);
              const isSelected = isApproved
                ? typeof response === 'object' && (response as any)?.[q.id] === optId
                : selections[q.id] === optId;
              return (
                <button
                  key={oi}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 ${
                    isSelected
                      ? 'bg-[var(--editor-accent)]/20 border-[var(--editor-accent)]/40 text-white/90'
                      : 'bg-[var(--chat-chip-bg)] border-white/[0.08] text-white/80 hover:bg-white/[0.12]'
                  }`}
                  disabled={disabled || isApproved}
                  onClick={() => setSelections((prev) => ({ ...prev, [q.id]: optId }))}
                  title={opt.description}
                >
                  {opt.label ?? opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!isApproved && (
        <button
          className="mt-1 px-4 py-1.5 text-sm rounded-lg bg-[var(--editor-accent)]/20 border border-[var(--editor-accent)]/30 text-white/90 hover:bg-[var(--editor-accent)]/30 transition-colors disabled:opacity-30"
          disabled={disabled || !allAnswered}
          onClick={() => onWidgetResponse(widget.id, selections)}
        >
          Continue
        </button>
      )}
    </div>
  );
}

export const WidgetRenderer = memo(function WidgetRenderer({
  block,
  onWidgetResponse,
  onEditScene,
  onScenesUpdate,
  disabled,
}: WidgetRendererProps) {
  const { widget } = block;
  const isApproved = block.response != null;

  switch (widget.kind) {
    case 'scene_plan': {
      const planJobId = widget.planJobId || '';
      const approvedValue = isApproved && typeof block.response === 'object' && block.response !== null && 'approved' in (block.response as Record<string, unknown>)
        ? (block.response as { approved: boolean }).approved
        : undefined;
      // Build metadata from either widget.metadata (structured) or flat widget fields
      const widgetMetadata = (widget.metadata as Record<string, unknown>) ?? {};
      const metadata = {
        ...widgetMetadata,
        summary: widgetMetadata.summary ?? widget.summary,
        title: widgetMetadata.title ?? widget.title,
        totalScenes: widgetMetadata.totalScenes ?? (widget.scenes as any[])?.length,
      };
      return (
        <div className="w-full my-2">
          <ScenePlanCard
            scenes={(widget.scenes as any[]) ?? []}
            scenePlanMarkdown={widget.scenePlanMarkdown as string | undefined}
            metadata={metadata as any}
            planJobId={planJobId}
            onApprove={(iconSelections) =>
              onWidgetResponse(widget.id, {
                approved: true,
                planJobId,
                ...(iconSelections ? { selectedIcons: iconSelections } : {}),
              })
            }
            onReject={() => onWidgetResponse(widget.id, { approved: false, planJobId })}
            onEditScene={onEditScene
              ? (sceneIndex: number, sceneTitle: string) => onEditScene(sceneIndex, sceneTitle, planJobId)
              : undefined}
            onScenesUpdate={onScenesUpdate}
            disabled={disabled || isApproved}
            approved={approvedValue}
          />
        </div>
      );
    }

    case 'choice': {
      const questions = widget.questions as any[] | undefined;
      const flatOptions = widget.options as any[] | undefined;
      const title = (widget.title ?? widget.message) as string | undefined;

      // Multi-question form
      if (questions?.length) {
        return (
          <MultiQuestionChoice
            widget={widget}
            response={block.response}
            onWidgetResponse={onWidgetResponse}
            disabled={disabled}
          />
        );
      }

      // Simple flat options
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          {title && <p className="text-sm text-white/70 mb-2">{title}</p>}
          <div className="flex flex-wrap gap-2">
            {(flatOptions ?? []).map((opt: any, i: number) => (
              <button
                key={i}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/80 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
                disabled={disabled || isApproved}
                onClick={() => onWidgetResponse(widget.id, opt.value ?? opt)}
              >
                {opt.label ?? opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'confirmation':
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">{widget.message as string}</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--editor-accent)]/20 border border-[var(--editor-accent)]/30 text-white/90 hover:bg-[var(--editor-accent)]/30 transition-colors disabled:opacity-40"
              disabled={disabled || isApproved}
              onClick={() => onWidgetResponse(widget.id, { confirmed: true })}
            >
              Confirm
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/70 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
              disabled={disabled || isApproved}
              onClick={() => onWidgetResponse(widget.id, { confirmed: false })}
            >
              Cancel
            </button>
          </div>
        </div>
      );

    case 'theme_picker':
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">Choose a visual theme:</p>
          <div className="flex flex-wrap gap-2">
            {((widget.options as any[]) ?? []).map((opt: any, i: number) => (
              <button
                key={i}
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--chat-chip-bg)] border border-white/[0.08] text-white/80 hover:bg-white/[0.12] transition-colors disabled:opacity-40"
                disabled={disabled || isApproved}
                onClick={() => onWidgetResponse(widget.id, opt.value ?? opt)}
              >
                {opt.label ?? opt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'completion':
      return <CompletionCard widget={widget} />;

    default:
      return null;
  }
});

// ---------------------------------------------------------------------------
// CompletionCard — persistent "pipeline done" widget
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const CompletionCard = memo(function CompletionCard({ widget }: { widget: WidgetBlock['widget'] }) {
  const durationSeconds = (widget.durationSeconds as number) ?? 0;
  const plan = widget.plan as AgentPlan | undefined;

  const completedTasks = plan?.tasks.filter(t => t.status === 'complete').length ?? 0;
  const totalTasks = plan?.tasks.length ?? 0;

  return (
    <div className="w-full my-2 rounded-xl border border-green-500/20 bg-green-500/[0.06] backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-green-500/10">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        </div>
        <span className="text-sm font-medium text-green-300/90">Video ready for review</span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-3.5 py-2">
        {durationSeconds > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(durationSeconds)}</span>
          </div>
        )}
        {totalTasks > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Sparkles className="w-3 h-3" />
            <span>{completedTasks}/{totalTasks} tasks</span>
          </div>
        )}
      </div>

      {/* Completed plan tasks (collapsed summary) */}
      {plan && plan.tasks.length > 0 && (
        <div className="px-3.5 pb-2.5">
          <div className="flex flex-wrap gap-1.5">
            {plan.tasks.map((task) => (
              <span
                key={task.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border ${
                  task.status === 'complete'
                    ? 'bg-green-500/10 border-green-500/15 text-green-400/70'
                    : task.status === 'failed'
                    ? 'bg-red-500/10 border-red-500/15 text-red-400/70'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/30'
                }`}
              >
                {task.status === 'complete' ? '✓' : task.status === 'failed' ? '✗' : '○'} {task.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
