import { apiFetch } from "./api-client";
import type {
  Job,
  ModelPreset,
  UserModel,
  ModelsResponse,
  UserModelsResponse,
  GarmentCategory,
} from "@/types";

export async function fetchModelPresets(): Promise<ModelPreset[]> {
  const data = await apiFetch<ModelsResponse>("/api/tryon/models");
  return data.models;
}

export async function fetchMyModels(): Promise<UserModel[]> {
  const data = await apiFetch<UserModelsResponse>("/api/tryon/models/mine");
  return data.models;
}

export async function uploadModel(file: File): Promise<UserModel> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<UserModel>("/api/tryon/models/upload", {
    method: "POST",
    body: formData,
  });
}

export async function deleteModel(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/tryon/models/mine/${id}`, {
    method: "DELETE",
  });
}

export async function generateTryOn(
  jobId: string,
  modelType: "preset" | "custom",
  modelValue: string,
  category: GarmentCategory = "auto",
): Promise<Job> {
  return apiFetch<Job>("/api/tryon/generate", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      model_type: modelType,
      model_value: modelValue,
      category,
    }),
  });
}
