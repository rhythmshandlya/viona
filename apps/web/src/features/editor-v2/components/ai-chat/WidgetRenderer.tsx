'use client';

import React, { memo } from 'react';
import type { WidgetBlock } from './types';
import { ScenePlanCard } from '../agent-widgets/ScenePlanCard';

interface WidgetRendererProps {
  block: WidgetBlock;
  onWidgetResponse: (widgetId: string, value: unknown) => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string, planJobId: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: unknown[]) => void | Promise<void>;
  disabled?: boolean;
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
      return (
        <div className="w-full my-2">
          <ScenePlanCard
            scenes={(widget.scenes as any[]) ?? []}
            scenePlanMarkdown={widget.scenePlanMarkdown as string | undefined}
            metadata={widget.metadata as any}
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

    case 'choice':
      return (
        <div className="w-full my-2 p-3 rounded-xl bg-[var(--chat-plan-bg)] border border-[var(--chat-plan-border)] backdrop-blur-xl">
          <p className="text-sm text-white/70 mb-2">{widget.message as string}</p>
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

    default:
      return null;
  }
});
