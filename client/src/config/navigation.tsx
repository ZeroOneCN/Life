import type { MenuItemConfig, RouteConfig } from '../types/navigation';
import { lazyWithProgress } from '../utils/lazyWithProgress';

const Dashboard = lazyWithProgress(() => import('../pages/Dashboard'));
const NotificationCenterPage = lazyWithProgress(() => import('../pages/notifications/NotificationCenterPage'));
const ProfileSettingsPage = lazyWithProgress(() => import('../pages/settings/Profile'));
const HealthDashboardPage = lazyWithProgress(() => import('../pages/health/HealthDashboard'));
const VitalPage = lazyWithProgress(() => import('../pages/health/Vital'));
const FitnessPage = lazyWithProgress(() => import('../pages/health/Fitness'));
const CheckupPage = lazyWithProgress(() => import('../pages/health/Checkup'));
const ShoppingPage = lazyWithProgress(() => import('../pages/finance/Shopping'));
const TravelPage = lazyWithProgress(() => import('../pages/finance/Travel'));
const LoanPage = lazyWithProgress(() => import('../pages/finance/Loan'));
const SubscriptionPage = lazyWithProgress(() => import('../pages/finance/Subscription'));
const RentPage = lazyWithProgress(() => import('../pages/finance/Rent'));
const FinanceReportPage = lazyWithProgress(() => import('../pages/finance/FinanceReport'));
const BudgetPage = lazyWithProgress(() => import('../pages/finance/Budget'));
const BillPage = lazyWithProgress(() => import('../pages/finance/Bill'));
const GoalPage = lazyWithProgress(() => import('../pages/finance/Goal'));
const ExpensePage = lazyWithProgress(() => import('../pages/finance/Expense'));
const BillManagementPage = lazyWithProgress(() => import('../pages/finance/BillManagement'));
const PlanningPage = lazyWithProgress(() => import('../pages/finance/Planning'));
const StoragePage = lazyWithProgress(() => import('../pages/life/Storage'));
const CardPage = lazyWithProgress(() => import('../pages/life/Card'));
const TodoPage = lazyWithProgress(() => import('../pages/life/Todo'));
const ForexPage = lazyWithProgress(() => import('../pages/investment/Forex'));
const CryptoPage = lazyWithProgress(() => import('../pages/investment/Crypto'));
const HKStockPage = lazyWithProgress(() => import('../pages/investment/HKStock'));
const USStockPage = lazyWithProgress(() => import('../pages/investment/USStock'));

export const menuItems: MenuItemConfig[] = [
  { key: '/dashboard', icon: 'dashboard', label: '首页' },
  {
    key: 'health',
    icon: 'heart',
    label: '健康中心',
    children: [
      { key: '/health/dashboard', icon: 'dashboard', label: '健康概览' },
      { key: '/health/vital', icon: 'heart', label: '健康记录' },
      { key: '/health/fitness', icon: 'spark', label: '运动健身' },
      { key: '/health/checkup', icon: 'task', label: '体检用药' },
    ],
  },
  {
    key: 'finance',
    icon: 'wallet',
    label: '财务中心',
    children: [
      { key: '/finance/expense', icon: 'task', label: '消费记录' },
      { key: '/finance/bill-mgmt', icon: 'wallet', label: '账单管理' },
      { key: '/finance/bill', icon: 'bell', label: '账单提醒' },
      { key: '/finance/planning', icon: 'spark', label: '财务规划' },
      { key: '/finance/report', icon: 'chart', label: '财务报告' },
    ],
  },
  {
    key: 'life',
    icon: 'box',
    label: '生活中心',
    children: [
      { key: '/life/storage', icon: 'box', label: '物品追踪' },
      { key: '/life/card', icon: 'card', label: '号卡中心' },
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
  { path: '/dashboard', label: '首页', breadcrumb: ['首页'], menuKey: '/dashboard', component: Dashboard },
  { path: '/health/dashboard', label: '健康概览', breadcrumb: ['健康中心', '健康概览'], menuKey: '/health/dashboard', component: HealthDashboardPage },
  { path: '/health/vital', label: '健康记录', breadcrumb: ['健康中心', '健康记录'], menuKey: '/health/vital', component: VitalPage },
  { path: '/health/fitness', label: '运动健身', breadcrumb: ['健康中心', '运动健身'], menuKey: '/health/fitness', component: FitnessPage },
  { path: '/health/checkup', label: '体检用药', breadcrumb: ['健康中心', '体检用药'], menuKey: '/health/checkup', component: CheckupPage },
  { path: '/finance/expense', label: '消费记录', breadcrumb: ['财务中心', '消费记录'], menuKey: '/finance/expense', component: ExpensePage },
  { path: '/finance/bill-mgmt', label: '账单管理', breadcrumb: ['财务中心', '账单管理'], menuKey: '/finance/bill-mgmt', component: BillManagementPage },
  { path: '/finance/bill', label: '账单提醒', breadcrumb: ['财务中心', '账单提醒'], menuKey: '/finance/bill', component: BillPage },
  { path: '/finance/planning', label: '财务规划', breadcrumb: ['财务中心', '财务规划'], menuKey: '/finance/planning', component: PlanningPage },
  { path: '/finance/report', label: '财务报告', breadcrumb: ['财务中心', '财务报告'], menuKey: '/finance/report', component: FinanceReportPage },
  { path: '/life/storage', label: '物品追踪', breadcrumb: ['生活中心', '物品追踪'], menuKey: '/life/storage', component: StoragePage },
  { path: '/life/card', label: '号卡中心', breadcrumb: ['生活中心', '号卡中心'], menuKey: '/life/card', component: CardPage },
  { path: '/life/todo', label: '待办事项', breadcrumb: ['生活中心', '待办事项'], menuKey: '/life/todo', component: TodoPage },
  { path: '/investment/forex', label: '外汇市场', breadcrumb: ['投资中心', '外汇市场'], menuKey: '/investment/forex', component: ForexPage },
  { path: '/investment/crypto', label: '加密市场', breadcrumb: ['投资中心', '加密市场'], menuKey: '/investment/crypto', component: CryptoPage },
  { path: '/investment/hk-stock', label: '港股市场', breadcrumb: ['投资中心', '港股市场'], menuKey: '/investment/hk-stock', component: HKStockPage },
  { path: '/investment/us-stock', label: '美股市场', breadcrumb: ['投资中心', '美股市场'], menuKey: '/investment/us-stock', component: USStockPage },
  { path: '/notifications', label: '通知中心', breadcrumb: ['通知中心'], menuKey: '/notifications', component: NotificationCenterPage },
  { path: '/settings/profile', label: '个人中心', breadcrumb: ['系统设置', '个人中心'], menuKey: '/settings/profile', component: ProfileSettingsPage },
];
