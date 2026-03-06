"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2, Shirt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { config } from "@/config/env";
import {
  fetchModelPresets,
  fetchMyModels,
  uploadModel,
  deleteModel,
  generateTryOn,
} from "@/lib/tryon-api";
import type { ModelPreset, UserModel, GarmentCategory } from "@/types";

type Tab = "presets" | "custom";

type Selection =
  | { type: "preset"; model: ModelPreset }
  | { type: "custom"; model: UserModel }
  | null;

interface TryOnPickerProps {
  jobId: string;
}

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "one-pieces", label: "One-Pieces" },
];

function resolveImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${config.apiBaseUrl}${url}`;
}

export function TryOnPicker({ jobId }: TryOnPickerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("presets");
  const [selection, setSelection] = useState<Selection>(null);
  const [category, setCategory] = useState<GarmentCategory>("auto");
  const [generating, setGenerating] = useState(false);

  // Presets
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  // Custom models
  const [customModels, setCustomModels] = useState<UserModel[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customFetched, setCustomFetched] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchModelPresets()
      .then(setPresets)
      .catch(() => toast.error("Failed to load models"))
      .finally(() => setPresetsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "custom" && !customFetched) {
      setCustomLoading(true);
      fetchMyModels()
        .then((models) => {
          setCustomModels(models);
          setCustomFetched(true);
        })
        .catch(() => toast.error("Failed to load your models"))
        .finally(() => setCustomLoading(false));
    }
  }, [activeTab, customFetched]);

  const handleUploadModel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const model = await uploadModel(file);
      setCustomModels((prev) => [model, ...prev]);
      setSelection({ type: "custom", model });
      toast.success("Model photo uploaded");
    } catch {
      toast.error("Failed to upload model photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, []);

  const handleDeleteModel = useCallback(
    async (id: string) => {
      try {
        await deleteModel(id);
        setCustomModels((prev) => prev.filter((m) => m.id !== id));
        if (selection?.type === "custom" && selection.model.id === id) {
          setSelection(null);
        }
        toast.success("Model deleted");
      } catch {
        toast.error("Failed to delete model");
      }
    },
    [selection],
  );

  const handleGenerate = useCallback(async () => {
    if (!selection) return;
    setGenerating(true);
    try {
      const modelType = selection.type;
      const modelValue = selection.model.id;
      const job = await generateTryOn(jobId, modelType, modelValue, category);
      router.push(`/job/${job.id}`);
    } catch {
      toast.error("Try-on generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [selection, jobId, category, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shirt className="h-4 w-4" />
        <h2 className="text-base font-semibold">Virtual Try-On</h2>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Free
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["presets", "custom"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "presets" ? "Model Presets" : "My Photos"}
          </button>
        ))}
      </div>

      {/* Presets tab */}
      {activeTab === "presets" && (
        <div className="space-y-3">
          {presetsLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {presets.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelection({ type: "preset", model })}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all ${
                    selection?.type === "preset" && selection.model.id === model.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(model.image_url)}
                    alt={model.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs font-medium text-white">{model.name}</p>
                    <p className="text-[10px] text-white/70 capitalize">{model.gender}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom tab */}
      {activeTab === "custom" && (
        <div className="space-y-3">
          {/* Upload button */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload a model photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleUploadModel}
              disabled={uploading}
            />
          </label>

          {customLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : customModels.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No custom models yet. Upload a photo above.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {customModels.map((model) => (
                <div
                  key={model.id}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all ${
                    selection?.type === "custom" && selection.model.id === model.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "custom", model })}
                    className="h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={model.image_url}
                      alt={model.original_filename ?? "Custom model"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteModel(model.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category selector */}
      {selection && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Garment Type</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button onClick={handleGenerate} disabled={!selection || generating} className="w-full">
        {generating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating Try-On (~10s)...
          </>
        ) : (
          "Generate Try-On"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No credits required — try-on is free
      </p>
    </div>
  );
}
