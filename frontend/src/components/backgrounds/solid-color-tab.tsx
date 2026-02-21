"use client";

import type { BackgroundPreset } from "@/types";

interface SolidColorTabProps {
  presets: BackgroundPreset[];
  selected: string | null;
  onSelect: (preset: BackgroundPreset) => void;
}

const NEEDS_RING = new Set(["#FFFFFF", "#ffffff", "#FFFDD0", "#fffdd0"]);

export function SolidColorTab({ presets, selected, onSelect }: SolidColorTabProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {presets.map((preset) => {
        const isSelected = selected === preset.id;
        const needsRing = NEEDS_RING.has(preset.value);

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className="group flex flex-col items-center gap-1.5"
          >
            <div
              className={`h-12 w-12 rounded-full border-2 transition-all ${
                isSelected
                  ? "border-primary scale-110"
                  : needsRing
                    ? "border-muted-foreground/20 group-hover:border-primary/50"
                    : "border-transparent group-hover:border-primary/50"
              }`}
              style={{ backgroundColor: preset.value }}
            />
            <span className="text-xs text-muted-foreground">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
