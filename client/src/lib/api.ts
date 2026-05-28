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

const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: '提交内容校验未通过，请检查表单后重试。',
  invalid_credentials: '账号或密码错误。',
  account_already_exists: '用户名或邮箱已存在，请更换后重试。',
  registration_closed: '系统已完成首个管理员初始化，当前不开放新用户注册。',
  invalid_refresh_token: '登录状态已失效，请重新登录。',
  unauthorized: '登录状态已失效，请重新登录。',
  bootstrap_required: '系统还没有管理员账号，请先完成首个管理员初始化。',
  database_not_ready: '数据库尚未完成初始化，请先检查系统状态。',
};

async function ensureFreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshClient)
      .catch(() => {
        clearAuthSession('session_expired');
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

export function getApiErrorShape(error: unknown) {
  if (!axios.isAxiosError<ApiErrorShape>(error)) {
    return null;
  }

  return error.response?.data ?? null;
}

export function getApiErrorCode(error: unknown) {
  return getApiErrorShape(error)?.message ?? null;
}

export function getApiErrorData<T = unknown>(error: unknown) {
  return (getApiErrorShape(error)?.data ?? null) as T | null;
}

export function getApiFieldErrors(error: unknown) {
  const data = getApiErrorData<{
    fieldErrors?: Record<string, string[] | undefined>;
  }>(error);

  if (!data?.fieldErrors) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.fieldErrors)
      .map(([key, value]) => [key, value?.[0] ?? ''])
      .filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;
}

export function getApiFormErrors(error: unknown) {
  const data = getApiErrorData<{
    formErrors?: string[];
  }>(error);

  return data?.formErrors?.filter(Boolean) ?? [];
}

export function buildApiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试。') {
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    const message = error.response?.data?.message;
    const details = error.response?.data?.details;
    if (message) {
      const mapped = API_ERROR_MESSAGES[message];
      if (mapped && details) {
        return `${mapped}（${JSON.stringify(details)}）`;
      }
      return mapped ?? message;
    }
    return fallback;
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

export async function apiDelete<T>(url: string, options?: ApiClientOptions, params?: Record<string, unknown>) {
  const response = await apiClient.delete<ApiSuccessResponse<T>>(url, {
    params,
    metadata: options,
  } as InternalAxiosRequestConfig & { metadata: ApiClientOptions });
  return response.data.data;
}
