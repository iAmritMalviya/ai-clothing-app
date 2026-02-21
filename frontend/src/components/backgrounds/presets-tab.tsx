"use client";

import { Loader2 } from "lucide-react";
import type { BackgroundPreset } from "@/types";

interface PresetsTabProps {
  presets: BackgroundPreset[];
  loading: boolean;
  selected: string | null;
  onSelect: (preset: BackgroundPreset) => void;
}

export function PresetsTab({ presets, loading, selected, onSelect }: PresetsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {presets.map((preset) => {
        const isSelected = selected === preset.id;

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
              isSelected ? "border-primary" : "border-transparent hover:border-primary/50"
            }`}
          >
            {preset.preview_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preset.preview_image_url}
                alt={preset.name}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-muted">
                <span className="px-2 text-xs text-muted-foreground text-center">
                  {preset.name}
                </span>
              </div>
            )}
            <div
              className={`absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {preset.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
