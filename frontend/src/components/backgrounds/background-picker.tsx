"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SolidColorTab } from "./solid-color-tab";
import { PresetsTab } from "./presets-tab";
import { CustomTab } from "./custom-tab";
import {
  fetchPresets,
  fetchMyBackgrounds,
  deleteBackground,
  applyBackground,
} from "@/lib/backgrounds-api";
import type { BackgroundPreset, UserBackground } from "@/types";

type Tab = "colors" | "scenes" | "uploads";

type Selection =
  | { type: "solid_color"; preset: BackgroundPreset }
  | { type: "preset_scene"; preset: BackgroundPreset }
  | { type: "custom_upload"; background: UserBackground }
  | null;

interface BackgroundPickerProps {
  jobId: string;
  credits: number;
  onApplied: () => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "scenes", label: "Scenes" },
  { key: "uploads", label: "My Uploads" },
];

export function BackgroundPicker({ jobId, credits, onApplied }: BackgroundPickerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("colors");
  const [selection, setSelection] = useState<Selection>(null);
  const [applying, setApplying] = useState(false);

  // Presets state (fetched once on mount)
  const [presets, setPresets] = useState<BackgroundPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  // Custom backgrounds state (lazy-fetched on tab open)
  const [customBgs, setCustomBgs] = useState<UserBackground[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customFetched, setCustomFetched] = useState(false);

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets()
      .then(setPresets)
      .catch(() => toast.error("Failed to load presets"))
      .finally(() => setPresetsLoading(false));
  }, []);

  // Lazy-fetch custom backgrounds when tab opens
  useEffect(() => {
    if (activeTab === "uploads" && !customFetched) {
      setCustomLoading(true);
      fetchMyBackgrounds()
        .then((bgs) => {
          setCustomBgs(bgs);
          setCustomFetched(true);
        })
        .catch(() => toast.error("Failed to load your backgrounds"))
        .finally(() => setCustomLoading(false));
    }
  }, [activeTab, customFetched]);

  const solidPresets = presets.filter((p) => p.type === "solid_color");
  const scenePresets = presets.filter((p) => p.type === "ai_scene");

  const handleSelectSolid = useCallback((preset: BackgroundPreset) => {
    setSelection({ type: "solid_color", preset });
  }, []);

  const handleSelectScene = useCallback((preset: BackgroundPreset) => {
    setSelection({ type: "preset_scene", preset });
  }, []);

  const handleSelectCustom = useCallback((bg: UserBackground) => {
    setSelection({ type: "custom_upload", background: bg });
  }, []);

  const handleUploaded = useCallback((bg: UserBackground) => {
    setCustomBgs((prev) => [bg, ...prev]);
    setSelection({ type: "custom_upload", background: bg });
  }, []);

  const handleDeleted = useCallback(
    async (id: string) => {
      try {
        await deleteBackground(id);
        setCustomBgs((prev) => prev.filter((bg) => bg.id !== id));
        setSelection((prev) =>
          prev?.type === "custom_upload" && prev.background.id === id ? null : prev,
        );
      } catch {
        toast.error("Failed to delete background");
      }
    },
    [],
  );

  const handleApply = useCallback(async () => {
    if (!selection) return;

    let backgroundValue: string;
    if (selection.type === "solid_color") {
      backgroundValue = selection.preset.value; // hex string
    } else if (selection.type === "preset_scene") {
      backgroundValue = selection.preset.id; // UUID — NOT preset.value!
    } else {
      backgroundValue = selection.background.id; // UUID
    }

    setApplying(true);
    try {
      const newJob = await applyBackground(jobId, selection.type, backgroundValue);
      onApplied();
      router.push(`/job/${newJob.id}`);
    } catch {
      toast.error("Failed to apply background");
    } finally {
      setApplying(false);
    }
  }, [selection, jobId, onApplied, router]);

  const canApply = selection !== null && credits > 0 && !applying;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Change Background</h2>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[120px]">
        {activeTab === "colors" && (
          <SolidColorTab
            presets={solidPresets}
            selected={selection?.type === "solid_color" ? selection.preset.id : null}
            onSelect={handleSelectSolid}
          />
        )}
        {activeTab === "scenes" && (
          <PresetsTab
            presets={scenePresets}
            loading={presetsLoading}
            selected={selection?.type === "preset_scene" ? selection.preset.id : null}
            onSelect={handleSelectScene}
          />
        )}
        {activeTab === "uploads" && (
          <CustomTab
            backgrounds={customBgs}
            loading={customLoading}
            selected={selection?.type === "custom_upload" ? selection.background.id : null}
            onSelect={handleSelectCustom}
            onUploaded={handleUploaded}
            onDeleted={(id) => void handleDeleted(id)}
          />
        )}
      </div>

      {/* Apply action */}
      <div className="flex items-center gap-3">
        <Button onClick={handleApply} disabled={!canApply}>
          {applying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            "Apply Background"
          )}
        </Button>
        {credits > 0 ? (
          <p className="text-xs text-muted-foreground">1 credit will be used</p>
        ) : (
          <p className="text-xs text-destructive">No credits remaining</p>
        )}
      </div>
    </div>
  );
}
