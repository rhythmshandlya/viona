'use client';

import { Slider } from '@/components/ui/slider';
import {
  useActiveCaptionStyle,
  useApplyStyleToAll,
  useSelectedIds,
  useEditorActions,
} from '../store/use-editor-store';
import {
  CaptionDisplayMode,
  CaptionAnimationLegacy,
  CaptionStyle,
} from '../store/types';
import { SUBTITLE_PRESETS, PRESET_ORDER } from '@/lib/subtitle-presets';

export function StylePanel() {
  const style = useActiveCaptionStyle();
  const applyToAll = useApplyStyleToAll();
  const selectedIds = useSelectedIds();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles, setApplyStyleToAll } = useEditorActions();

  if (!style) {
    return (
      <div className="p-4 text-zinc-400 text-sm">
        No captions to style. Add a video with transcription first.
      </div>
    );
  }

  const updateStyle = (updates: Partial<CaptionStyle>) => {
    if (applyToAll) {
      updateAllCaptionStyles(updates);
    } else {
      updateSelectedCaptionStyles(selectedIds, updates);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Apply to All Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400 font-medium">Apply to all</span>
        <button
          onClick={() => setApplyStyleToAll(!applyToAll)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            applyToAll ? 'bg-blue-600' : 'bg-zinc-600'
          }`}
          aria-label="Toggle apply to all captions"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              applyToAll ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Display Mode */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Display Mode</label>
        <div className="flex gap-1">
          {(['word-by-word', 'phrase', 'karaoke'] as CaptionDisplayMode[]).map(
            (mode) => (
              <button
                key={mode}
                onClick={() => updateStyle({ displayMode: mode })}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  style.displayMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {mode === 'word-by-word' ? 'Word' : mode === 'phrase' ? 'Phrase' : 'Karaoke'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Animation */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Animation</label>
        <div className="flex gap-1">
          {(['none', 'pop', 'fade', 'highlight'] as CaptionAnimationLegacy[]).map(
            (anim) => (
              <button
                key={anim}
                onClick={() => updateStyle({ animation: anim })}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded capitalize transition-colors ${
                  style.animation === anim
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {anim}
              </button>
            )
          )}
        </div>
      </div>

      {/* Style Presets */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Style Preset</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_ORDER.map((presetId) => {
            const preset = SUBTITLE_PRESETS[presetId];
            const isSelected = style.color === preset.color && style.activeColor === preset.activeColor;

            return (
              <button
                key={presetId}
                onClick={() =>
                  updateStyle({
                    color: preset.color,
                    activeColor: preset.activeColor,
                    backgroundColor: preset.backgroundColor,
                    activeBackgroundColor: preset.activeBackgroundColor,
                    textShadow: preset.textShadow,
                    textStroke: preset.textStroke,
                    fontWeight: preset.fontWeight,
                  })
                }
                className={`p-3 rounded border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-zinc-700'
                    : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                }`}
              >
                <div
                  className="text-sm font-bold truncate"
                  style={{
                    color: preset.activeColor,
                    textShadow: preset.textShadow,
                  }}
                >
                  Hello
                </div>
                <div className="text-xs text-zinc-400 mt-1">{preset.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <label className="text-sm text-zinc-400 font-medium">Colors</label>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={style.color}
            onChange={(e) => updateStyle({ color: e.target.value })}
            className="w-10 h-10 rounded border border-zinc-600 cursor-pointer bg-transparent"
          />
          <div className="flex-1">
            <div className="text-xs text-zinc-500">Text Color</div>
            <div className="text-sm text-zinc-300">{style.color}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={style.activeColor}
            onChange={(e) => updateStyle({ activeColor: e.target.value })}
            className="w-10 h-10 rounded border border-zinc-600 cursor-pointer bg-transparent"
          />
          <div className="flex-1">
            <div className="text-xs text-zinc-500">Highlight Color</div>
            <div className="text-sm text-zinc-300">{style.activeColor}</div>
          </div>
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm text-zinc-400 font-medium">Font Size</label>
          <span className="text-sm text-zinc-300">{style.fontSize}px</span>
        </div>
        <Slider
          value={[style.fontSize]}
          min={24}
          max={96}
          step={2}
          onValueChange={([size]) => updateStyle({ fontSize: size })}
          className="py-2"
        />
      </div>

      {/* Position */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Position</label>
        <div className="flex gap-1">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => updateStyle({ position: pos })}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded capitalize transition-colors ${
                style.position === pos
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
