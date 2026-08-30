import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { ConfigProvider } from '@arco-design/web-react';

import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { routes } from './config/navigation';
import AppShell from './layout/AppShell';
import MainLayout from './layout/MainLayout';
import { useAuthBootstrap } from './services/auth';
import { useTheme } from './hooks/useTheme';

const LoginPage = lazy(() => import('./pages/auth/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * 根据 URL ?layout=classic 参数选择布局组件
 *
 * - 默认：AppShell（v2.0 工作区布局）
 * - ?layout=classic：MainLayout（v1.0 三明治布局，回退验证期 1 个月）
 *
 * @returns 布局组件
 */
function useLayoutComponent() {
  const [searchParams] = useSearchParams();
  const isClassic = searchParams.get('layout') === 'classic';
  return isClassic ? MainLayout : AppShell;
}

export default function App() {
  useAuthBootstrap();
  const Layout = useLayoutComponent();
  const { isDark } = useTheme();

  return (
    <ConfigProvider theme={isDark ? { mode: 'dark' } : undefined}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route
            path="/login"
            element={(
              <Suspense fallback={<RouteLoadingFallback />}>
                <LoginPage />
              </Suspense>
            )}
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
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
            <Route
              path="*"
              element={(
                <Suspense fallback={<RouteLoadingFallback />}>
                  <NotFound />
                </Suspense>
              )}
            />
          </Route>
        </Route>
      </Routes>
    </ConfigProvider>
  );
}
