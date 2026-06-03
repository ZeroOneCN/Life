import { useEffect, useSyncExternalStore } from 'react';
import type { AxiosInstance } from 'axios';

import { apiGet, apiPatch, apiPost, buildApiErrorMessage } from '../lib/api';
import type {
  AuthProfileUpdatePayload,
  AuthReason,
  AuthSession,
  AuthState,
  AuthUser,
  ChangePasswordPayload,
  SystemHealthSnapshot,
} from '../types/auth';

const AUTH_STORAGE_KEY = 'lifeos_auth_session';

const listeners = new Set<() => void>();

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

let authState: AuthState = {
  status: 'booting',
  session: readStoredSession(),
  reason: null,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function persistSession(session: AuthSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function setAuthState(nextState: AuthState) {
  authState = nextState;
  persistSession(nextState.session);
  emitChange();
}

export function getAuthSession() {
  return authState.session;
}

export function clearAuthSession(reason: AuthReason = null) {
  setAuthState({
    status: 'anonymous',
    session: null,
    reason,
  });
}

function setAuthenticatedSession(session: AuthSession) {
  setAuthState({
    status: 'authenticated',
    session,
    reason: null,
  });
}

export function updateAuthUser(user: AuthUser) {
  const current = getAuthSession();
  if (!current) {
    return;
  }

  setAuthenticatedSession({
    ...current,
    user,
  });
}

export function getAuthUserDisplayName(user: AuthUser | null | undefined, fallback = '当前用户') {
  return user?.nickname || user?.username || fallback;
}

export function getAuthUserSummary(user: AuthUser | null | undefined, fallback = '已登录会话') {
  return user?.email || user?.timezone || fallback;
}

export async function refreshAccessToken(client: AxiosInstance) {
  const current = getAuthSession();
  if (!current?.refreshToken) {
    return null;
  }

  const response = await client.post('/auth/refresh', {
    refreshToken: current.refreshToken,
  });

  const nextAccessToken = response.data?.data?.accessToken as string | undefined;
  if (!nextAccessToken) {
    throw new Error('refresh_token_failed');
  }

  setAuthenticatedSession({
    ...current,
    accessToken: nextAccessToken,
  });

  return nextAccessToken;
}

export async function bootstrapAuthSession() {
  const current = getAuthSession();

  if (!current?.accessToken) {
    setAuthState({
      status: 'anonymous',
      session: null,
      reason: null,
    });
    return;
  }

  try {
    const user = await apiGet<AuthUser>('/auth/me', { skipAuthRefresh: false });
    setAuthenticatedSession({
      ...current,
      user,
    });
  } catch {
    clearAuthSession('session_expired');
  }
}

export async function login(payload: { username: string; password: string }) {
  const session = await apiPost<AuthSession, typeof payload>('/auth/login', payload, { skipAuthRefresh: true });
  setAuthenticatedSession(session);
  return session;
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  await apiPost('/auth/register', payload, { skipAuthRefresh: true });
  return login({
    username: payload.username,
    password: payload.password,
  });
}

export async function refreshCurrentUser() {
  const user = await apiGet<AuthUser>('/auth/me', { skipAuthRefresh: false });
  updateAuthUser(user);
  return user;
}

export async function updateAuthProfile(payload: AuthProfileUpdatePayload) {
  const user = await apiPatch<AuthUser, AuthProfileUpdatePayload>('/auth/profile', payload);
  updateAuthUser(user);
  return user;
}

export async function changePassword(payload: ChangePasswordPayload) {
  return apiPost<{ ok: true }, ChangePasswordPayload>('/auth/change-password', payload);
}

export async function logout() {
  try {
    await apiPost('/auth/logout');
  } catch {
    // Ignore logout transport failures and clear local session anyway.
  } finally {
    clearAuthSession('signed_out');
  }
}

export async function getSystemHealth() {
  return apiGet<SystemHealthSnapshot>('/system/health', { skipAuthRefresh: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return authState;
}

export function useAuthState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAuthBootstrap() {
  useEffect(() => {
    void bootstrapAuthSession().catch((error) => {
      clearAuthSession('session_expired');
      // eslint-disable-next-line no-console
      console.error(buildApiErrorMessage(error, '会话恢复失败。'));
    });
  }, []);
}
