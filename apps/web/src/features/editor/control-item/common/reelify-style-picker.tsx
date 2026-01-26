import { useState } from "react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SUBTITLE_PRESETS,
  PRESET_ORDER,
  DEFAULT_PRESET_ID,
  SubtitlePreset,
} from "@/lib/subtitle-presets";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import useStore from "../../store/use-store";

interface ReelifyStylePickerProps {
  trackItemId: string;
  currentPresetId?: string;
}

export const ReelifyStylePicker = ({
  trackItemId,
  currentPresetId = DEFAULT_PRESET_ID,
}: ReelifyStylePickerProps) => {
  const [selectedPreset, setSelectedPreset] = useState(currentPresetId);
  const { trackItemsMap } = useStore();

  const applyPreset = (preset: SubtitlePreset) => {
    setSelectedPreset(preset.id);

    // Apply preset to the current caption
    dispatch(EDIT_OBJECT, {
      payload: {
        [trackItemId]: {
          details: {
            color: preset.color,
            activeColor: preset.activeColor,
            activeFillColor: preset.activeBackgroundColor,
            fontSize: preset.fontSize,
            fontWeight: preset.fontWeight,
            animation: preset.animation,
            // Store preset ID for reference
            reelifyPreset: preset.id,
          },
        },
      },
    });
  };

  const applyToAll = () => {
    const preset = SUBTITLE_PRESETS[selectedPreset];
    if (!preset) return;

    // Find all caption items
    const captionItems = Object.values(trackItemsMap).filter(
      (item) => item.type === "caption"
    );

    // Apply to all captions
    const payload: Record<string, any> = {};
    captionItems.forEach((item) => {
      payload[item.id] = {
        details: {
          color: preset.color,
          activeColor: preset.activeColor,
          activeFillColor: preset.activeBackgroundColor,
          fontSize: preset.fontSize,
          fontWeight: preset.fontWeight,
          animation: preset.animation,
          reelifyPreset: preset.id,
        },
      };
    });

    if (Object.keys(payload).length > 0) {
      dispatch(EDIT_OBJECT, { payload });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Label className="font-sans text-xs font-semibold">Subtitle Style</Label>

      <div className="grid grid-cols-2 gap-2">
        {PRESET_ORDER.map((presetId) => {
          const preset = SUBTITLE_PRESETS[presetId];
          const isSelected = selectedPreset === presetId;

          return (
            <button
              key={presetId}
              onClick={() => applyPreset(preset)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-all hover:border-primary/50",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-muted bg-muted/30"
              )}
            >
              {/* Preview */}
              <div
                className="mb-2 flex h-10 w-full items-center justify-center rounded"
                style={{
                  backgroundColor:
                    preset.backgroundColor !== "transparent"
                      ? preset.backgroundColor
                      : "#1a1a1a",
                }}
              >
                <span
                  style={{
                    color: preset.color,
                    fontSize: "14px",
                    fontWeight: preset.fontWeight,
                    textShadow: preset.textShadow?.replace(/\d+px/g, "1px"),
                  }}
                >
                  Aa
                </span>
              </div>

              {/* Name */}
              <span className="text-xs text-muted-foreground">
                {preset.name}
              </span>

              {/* Checkmark */}
              {isSelected && (
                <div className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={applyToAll}
        className="w-full"
      >
        Apply to All Subtitles
      </Button>
    </div>
  );
};

export default ReelifyStylePicker;
