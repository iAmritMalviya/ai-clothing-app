import { config } from "@/config/env";
import type { ApiError } from "@/types";
import { getToken, clearToken } from "./auth";

export class ApiRequestError extends Error {
  statusCode: number;
  errorType: string;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = "ApiRequestError";
    this.statusCode = apiError.statusCode;
    this.errorType = apiError.error;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`;

  const isFormData = options?.body instanceof FormData;
  const token = getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      // Don't set Content-Type for FormData — browser sets it with boundary
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    let apiError: ApiError;
    try {
      apiError = await response.json();
    } catch {
      apiError = {
        statusCode: response.status,
        error: response.statusText,
        message: `Request failed: ${response.statusText}`,
      };
    }
    throw new ApiRequestError(apiError);
  }

  return response.json() as Promise<T>;
}
