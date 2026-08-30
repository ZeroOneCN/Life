import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { routes } from './config/navigation';
import ArcoLayout from './layout/ArcoLayout';
import { useAuthBootstrap } from './services/auth';

const LoginPage = lazy(() => import('./pages/auth/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * 应用根组件。
 * 使用 Arco Layout 作为统一布局，固定亮色主题。
 */
export default function App() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LoginPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ArcoLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path.slice(1)}
              element={
                <Suspense fallback={<RouteLoadingFallback />}>
                  <route.component />
                </Suspense>
              }
            />
          ))}
          <Route
            path="*"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <NotFound />
              </Suspense>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
