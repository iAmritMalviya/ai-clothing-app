export interface User {
  id: string;
  phone: string;
  name: string | null;
  shop_name: string | null;
  free_credits_remaining: number;
  created_at: string;
  updated_at: string;
}

export type JobType = "bg_removal" | "apply_bg" | "tryon";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type BackgroundType = "solid_color" | "preset_scene" | "custom_upload";
export type GarmentCategory = "tops" | "bottoms" | "one-pieces" | "auto";

export interface Job {
  id: string;
  user_id: string;
  type: JobType;
  status: JobStatus;
  input_image_url: string;
  transparent_image_url: string | null;
  output_image_url: string | null;
  source_job_id: string | null;
  background_type: BackgroundType | null;
  background_value: string | null;
  model_image_url: string | null;
  batch_id: string | null;
  processing_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface CatalogResponse {
  batch_id: string;
  jobs: Job[];
}

export interface BatchResponse {
  batch_id: string;
  jobs: Job[];
}

export interface ModelPreset {
  id: string;
  name: string;
  gender: "female" | "male";
  image_url: string;
  sort_order: number;
}

export interface UserModel {
  id: string;
  user_id: string;
  image_url: string;
  original_filename: string | null;
  created_at: string;
}

export interface ModelsResponse {
  models: ModelPreset[];
}

export interface UserModelsResponse {
  models: UserModel[];
}

export interface BackgroundPreset {
  id: string;
  name: string;
  type: "solid_color" | "ai_scene";
  value: string;
  preview_image_url: string | null;
  category: string;
  sort_order: number;
}

export interface UserBackground {
  id: string;
  user_id: string;
  image_url: string;
  original_filename: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: Pick<User, "id" | "phone" | "name" | "shop_name" | "free_credits_remaining">;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface JobsListResponse {
  jobs: Job[];
  total: number;
}

export interface PresetsResponse {
  presets: BackgroundPreset[];
}

export interface UserBackgroundsResponse {
  backgrounds: UserBackground[];
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
