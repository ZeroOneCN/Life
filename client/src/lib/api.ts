import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

import type { ApiClientOptions, ApiErrorShape, ApiSuccessResponse } from '../types/api';
import {
  clearAuthSession,
  getAuthSession,
  refreshAccessToken,
} from '../services/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  || 'http://localhost:3100/api';

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<string | null> | null = null;

async function ensureFreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshClient)
      .catch(() => {
        clearAuthSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const session = getAuthSession();

  if (session?.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorShape>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      __retried?: boolean;
      metadata?: ApiClientOptions;
    }) | undefined;

    if (
      error.response?.status !== 401
      || !originalRequest
      || originalRequest.__retried
      || originalRequest.metadata?.skipAuthRefresh
      || originalRequest.url?.includes('/auth/login')
      || originalRequest.url?.includes('/auth/register')
      || originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    const nextToken = await ensureFreshAccessToken();
    if (!nextToken) {
      return Promise.reject(error);
    }

    originalRequest.__retried = true;
    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${nextToken}`;

    return apiClient(originalRequest);
  },
);

export function buildApiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试。') {
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function apiGet<T>(url: string, options?: ApiClientOptions, params?: Record<string, unknown>) {
  const response = await apiClient.get<ApiSuccessResponse<T>>(url, {
    params,
    metadata: options,
  } as InternalAxiosRequestConfig & { metadata: ApiClientOptions });
  return response.data.data;
}

export async function apiPost<T, B = unknown>(url: string, body?: B, options?: ApiClientOptions) {
  const response = await apiClient.post<ApiSuccessResponse<T>>(url, body, {
    metadata: options,
  } as InternalAxiosRequestConfig & { metadata: ApiClientOptions });
  return response.data.data;
}

export async function apiPatch<T, B = unknown>(url: string, body?: B, options?: ApiClientOptions) {
  const response = await apiClient.patch<ApiSuccessResponse<T>>(url, body, {
    metadata: options,
  } as InternalAxiosRequestConfig & { metadata: ApiClientOptions });
  return response.data.data;
}
