import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
/* 健康中心 */
import Step from './pages/health/Step';
import Fitness from './pages/health/Fitness';
import Checkup from './pages/health/Checkup';
import Medication from './pages/health/Medication';
/* 财务中心 */
import Shopping from './pages/finance/Shopping';
import Travel from './pages/finance/Travel';
import Loan from './pages/finance/Loan';
import Subscription from './pages/finance/Subscription';
import Rent from './pages/finance/Rent';
/* 生活中心 */
import Storage from './pages/life/Storage';
import Card from './pages/life/Card';
import Todo from './pages/life/Todo';
/* 投资中心 */
import Forex from './pages/investment/Forex';
import Crypto from './pages/investment/Crypto';
import HKStock from './pages/investment/HKStock';
import USStock from './pages/investment/USStock';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* 健康中心 */}
          <Route path="health/step" element={<Step />} />
          <Route path="health/fitness" element={<Fitness />} />
          <Route path="health/checkup" element={<Checkup />} />
          <Route path="health/medication" element={<Medication />} />

          {/* 财务中心 */}
          <Route path="finance/shopping" element={<Shopping />} />
          <Route path="finance/travel" element={<Travel />} />
          <Route path="finance/loan" element={<Loan />} />
          <Route path="finance/subscription" element={<Subscription />} />
          <Route path="finance/rent" element={<Rent />} />

          {/* 生活中心 */}
          <Route path="life/storage" element={<Storage />} />
          <Route path="life/card" element={<Card />} />
          <Route path="life/todo" element={<Todo />} />

          {/* 投资中心 */}
          <Route path="investment/forex" element={<Forex />} />
          <Route path="investment/crypto" element={<Crypto />} />
          <Route path="investment/hk-stock" element={<HKStock />} />
          <Route path="investment/us-stock" element={<USStock />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
