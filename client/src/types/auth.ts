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
export type AuthReason = 'session_expired' | 'signed_out' | null;

export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  reason: AuthReason;
}

export interface SystemHealthSnapshot {
  status: 'ok' | 'degraded';
  databaseReady: boolean;
  bootstrapRequired: boolean;
  hasUsers: boolean;
  registrationMode: 'first_admin_only';
  entityCount: number;
  schemaMode: 'synchronize' | 'auto_bootstrap' | 'migration_only';
  reason: string | null;
  coreTable: string;
}
