import type { MenuItemConfig, RouteConfig } from '../types/navigation';
import Dashboard from '../pages/Dashboard';
import NotificationCenterPage from '../pages/notifications/NotificationCenterPage';
import StepPage from '../pages/health/Step';
import FitnessPage from '../pages/health/Fitness';
import CheckupPage from '../pages/health/Checkup';
import MedicationPage from '../pages/health/Medication';
import ShoppingPage from '../pages/finance/Shopping';
import TravelPage from '../pages/finance/Travel';
import LoanPage from '../pages/finance/Loan';
import SubscriptionPage from '../pages/finance/Subscription';
import RentPage from '../pages/finance/Rent';
import StoragePage from '../pages/life/Storage';
import CardPage from '../pages/life/Card';
import TodoPage from '../pages/life/Todo';
import ForexPage from '../pages/investment/Forex';
import CryptoPage from '../pages/investment/Crypto';
import HKStockPage from '../pages/investment/HKStock';
import USStockPage from '../pages/investment/USStock';

export const menuItems: MenuItemConfig[] = [
  { key: '/dashboard', icon: 'dashboard', label: '首页' },
  {
    key: 'health',
    icon: 'heart',
    label: '健康中心',
    children: [
      { key: '/health/step', icon: 'spark', label: '运动步数' },
      { key: '/health/fitness', icon: 'trend', label: '健身减脂' },
      { key: '/health/checkup', icon: 'task', label: '体检数据' },
      { key: '/health/medication', icon: 'shield', label: '日常用药' },
    ],
  },
  {
    key: 'finance',
    icon: 'wallet',
    label: '财务中心',
    children: [
      { key: '/finance/shopping', icon: 'task', label: '网上购物' },
      { key: '/finance/travel', icon: 'spark', label: '旅行游玩' },
      { key: '/finance/loan', icon: 'wallet', label: '贷款还款' },
      { key: '/finance/subscription', icon: 'bell', label: '服务订阅' },
      { key: '/finance/rent', icon: 'box', label: '房租水电' },
    ],
  },
  {
    key: 'life',
    icon: 'box',
    label: '生活中心',
    children: [
      { key: '/life/storage', icon: 'box', label: '物品归纳' },
      { key: '/life/card', icon: 'card', label: '号卡管理' },
      { key: '/life/todo', icon: 'task', label: '待办事项' },
    ],
  },
  {
    key: 'investment',
    icon: 'chart',
    label: '投资中心',
    children: [
      { key: '/investment/forex', icon: 'trend', label: '外汇市场' },
      { key: '/investment/crypto', icon: 'shield', label: '加密市场' },
      { key: '/investment/hk-stock', icon: 'chart', label: '港股市场' },
      { key: '/investment/us-stock', icon: 'chart', label: '美股市场' },
    ],
  },
  { key: '/notifications', icon: 'bell', label: '通知中心' },
];

export const routes: RouteConfig[] = [
  { path: '/dashboard', label: '首页', breadcrumb: ['首页'], menuKey: '/dashboard', element: <Dashboard /> },
  { path: '/health/step', label: '运动步数', breadcrumb: ['健康中心', '运动步数'], menuKey: '/health/step', element: <StepPage /> },
  { path: '/health/fitness', label: '健身减脂', breadcrumb: ['健康中心', '健身减脂'], menuKey: '/health/fitness', element: <FitnessPage /> },
  { path: '/health/checkup', label: '体检数据', breadcrumb: ['健康中心', '体检数据'], menuKey: '/health/checkup', element: <CheckupPage /> },
  { path: '/health/medication', label: '日常用药', breadcrumb: ['健康中心', '日常用药'], menuKey: '/health/medication', element: <MedicationPage /> },
  { path: '/finance/shopping', label: '网上购物', breadcrumb: ['财务中心', '网上购物'], menuKey: '/finance/shopping', element: <ShoppingPage /> },
  { path: '/finance/travel', label: '旅行游玩', breadcrumb: ['财务中心', '旅行游玩'], menuKey: '/finance/travel', element: <TravelPage /> },
  { path: '/finance/loan', label: '贷款还款', breadcrumb: ['财务中心', '贷款还款'], menuKey: '/finance/loan', element: <LoanPage /> },
  { path: '/finance/subscription', label: '服务订阅', breadcrumb: ['财务中心', '服务订阅'], menuKey: '/finance/subscription', element: <SubscriptionPage /> },
  { path: '/finance/rent', label: '房租水电', breadcrumb: ['财务中心', '房租水电'], menuKey: '/finance/rent', element: <RentPage /> },
  { path: '/life/storage', label: '物品归纳', breadcrumb: ['生活中心', '物品归纳'], menuKey: '/life/storage', element: <StoragePage /> },
  { path: '/life/card', label: '号卡管理', breadcrumb: ['生活中心', '号卡管理'], menuKey: '/life/card', element: <CardPage /> },
  { path: '/life/todo', label: '待办事项', breadcrumb: ['生活中心', '待办事项'], menuKey: '/life/todo', element: <TodoPage /> },
  { path: '/investment/forex', label: '外汇市场', breadcrumb: ['投资中心', '外汇市场'], menuKey: '/investment/forex', element: <ForexPage /> },
  { path: '/investment/crypto', label: '加密市场', breadcrumb: ['投资中心', '加密市场'], menuKey: '/investment/crypto', element: <CryptoPage /> },
  { path: '/investment/hk-stock', label: '港股市场', breadcrumb: ['投资中心', '港股市场'], menuKey: '/investment/hk-stock', element: <HKStockPage /> },
  { path: '/investment/us-stock', label: '美股市场', breadcrumb: ['投资中心', '美股市场'], menuKey: '/investment/us-stock', element: <USStockPage /> },
  { path: '/notifications', label: '通知中心', breadcrumb: ['通知中心'], menuKey: '/notifications', element: <NotificationCenterPage /> },
];
