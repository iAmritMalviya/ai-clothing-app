"use client";

import { useCallback, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UploadZone } from "@/components/upload/upload-zone";
import { uploadBackground } from "@/lib/backgrounds-api";
import type { UserBackground } from "@/types";

interface CustomTabProps {
  backgrounds: UserBackground[];
  loading: boolean;
  selected: string | null;
  onSelect: (bg: UserBackground) => void;
  onUploaded: (bg: UserBackground) => void;
  onDeleted: (id: string) => void;
}

export function CustomTab({
  backgrounds,
  loading,
  selected,
  onSelect,
  onUploaded,
  onDeleted,
}: CustomTabProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const bg = await uploadBackground(file);
        onUploaded(bg);
      } catch {
        toast.error("Failed to upload background");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  return (
    <div className="space-y-4">
      <UploadZone
        onUpload={(file) => void handleUpload(file)}
        disabled={uploading}
        label="Upload a background image"
        sublabel="Drag & drop or tap to browse"
      />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : backgrounds.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {backgrounds.map((bg) => {
            const isSelected = selected === bg.id;

            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => onSelect(bg)}
                className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                  isSelected ? "border-primary" : "border-transparent hover:border-primary/50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bg.image_url}
                  alt={bg.original_filename ?? "Custom background"}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleted(bg.id);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
