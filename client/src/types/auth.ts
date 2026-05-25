export interface AuthUser {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  timezone: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
}
