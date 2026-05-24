import { Navigate, Route, Routes } from 'react-router-dom';

import { routes } from './config/navigation';
import MainLayout from './layout/MainLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {routes.map((route) => (
          <Route key={route.path} path={route.path.slice(1)} element={route.element} />
        ))}
      </Route>
    </Routes>
  );
}
