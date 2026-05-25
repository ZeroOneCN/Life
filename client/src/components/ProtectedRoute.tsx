import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthState } from '../services/auth';
import { RouteLoadingFallback } from './RouteLoadingFallback';

export function ProtectedRoute() {
  const authState = useAuthState();
  const location = useLocation();

  if (authState.status === 'booting') {
    return <RouteLoadingFallback />;
  }

  if (authState.status !== 'authenticated' || !authState.session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const authState = useAuthState();

  if (authState.status === 'booting') {
    return <RouteLoadingFallback />;
  }

  if (authState.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
