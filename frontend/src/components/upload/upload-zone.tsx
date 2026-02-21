"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { Upload, Camera } from "lucide-react";
import { toast } from "sonner";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
  label?: string;
  sublabel?: string;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, or WebP image";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File size must be under 10MB";
  }
  return null;
}

export function UploadZone({ onUpload, disabled = false, label, sublabel }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      onUpload(file);
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <div className="flex gap-2 text-muted-foreground">
        <Upload className="h-8 w-8" />
        <Camera className="h-8 w-8" />
      </div>
      <div>
        <p className="font-medium">
          {disabled ? "No credits remaining" : (label ?? "Upload a clothing image")}
        </p>
        <p className="text-sm text-muted-foreground">
          {disabled
            ? "Purchase credits to continue"
            : (sublabel ?? "Drag & drop, tap to browse, or use camera")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP up to 10MB</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
