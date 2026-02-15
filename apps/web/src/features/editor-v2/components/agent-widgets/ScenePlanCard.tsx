import React from 'react';

interface Scene {
  startMs: number;
  endMs: number;
  title: string;
  description: string;
}

interface ScenePlanCardProps {
  scenes: Scene[];
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  approved?: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ScenePlanCard({ scenes, onApprove, onReject, disabled, approved }: ScenePlanCardProps) {
  return (
    <div className="my-2 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-white/5 border-b border-white/10">
        <span className="text-sm font-medium text-white">Scene Plan</span>
        <span className="text-xs text-white/40 ml-2">{scenes.length} scenes</span>
      </div>
      <div className="divide-y divide-white/5">
        {scenes.map((scene, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-white/40">
                {formatTime(scene.startMs)} - {formatTime(scene.endMs)}
              </span>
              <span className="text-sm font-medium text-white">{scene.title}</span>
            </div>
            <div className="text-xs text-white/60">{scene.description}</div>
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors"
          >
            Approve &amp; Generate
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 border border-white/20 hover:border-white/40 text-white/70 text-sm rounded-md transition-colors"
          >
            Revise
          </button>
        </div>
      )}
      {approved && (
        <div className="px-3 py-2 bg-green-500/10 border-t border-green-500/20 text-green-400 text-xs text-center">
          Plan approved
        </div>
      )}
    </div>
  );
}
