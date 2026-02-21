import { apiFetch } from "./api-client";
import type {
  BackgroundPreset,
  Job,
  PresetsResponse,
  UserBackground,
  UserBackgroundsResponse,
  BackgroundType,
} from "@/types";

export async function fetchPresets(
  category?: string,
): Promise<BackgroundPreset[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const data = await apiFetch<PresetsResponse>(
    `/api/backgrounds/presets${query}`,
  );
  return data.presets;
}

export async function fetchMyBackgrounds(): Promise<UserBackground[]> {
  const data = await apiFetch<UserBackgroundsResponse>(
    "/api/backgrounds/mine",
  );
  return data.backgrounds;
}

export async function uploadBackground(file: File): Promise<UserBackground> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<UserBackground>("/api/backgrounds/upload", {
    method: "POST",
    body: formData,
  });
}

export async function deleteBackground(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/backgrounds/mine/${id}`, {
    method: "DELETE",
  });
}

export async function applyBackground(
  jobId: string,
  backgroundType: BackgroundType,
  backgroundValue: string,
): Promise<Job> {
  return apiFetch<Job>("/api/backgrounds/apply", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      background_type: backgroundType,
      background_value: backgroundValue,
    }),
  });
}
