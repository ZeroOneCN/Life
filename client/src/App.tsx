import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { routes } from './config/navigation';
import MainLayout from './layout/MainLayout';
import LoginPage from './pages/auth/Login';
import { useAuthBootstrap } from './services/auth';

export default function App() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path.slice(1)}
              element={(
                <Suspense fallback={<RouteLoadingFallback />}>
                  <route.component />
                </Suspense>
              )}
            />
          ))}
        </Route>
      </Route>
    </Routes>
  );
}
