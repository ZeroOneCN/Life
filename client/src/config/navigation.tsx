import type { MenuItemConfig, RouteConfig } from '../types/navigation';
import { lazyWithProgress } from '../utils/lazyWithProgress';

const Dashboard = lazyWithProgress(() => import('../pages/Dashboard'));
const NotificationCenterPage = lazyWithProgress(() => import('../pages/notifications/NotificationCenterPage'));
const StepPage = lazyWithProgress(() => import('../pages/health/Step'));
const FitnessPage = lazyWithProgress(() => import('../pages/health/Fitness'));
const CheckupPage = lazyWithProgress(() => import('../pages/health/Checkup'));
const MedicationPage = lazyWithProgress(() => import('../pages/health/Medication'));
const ShoppingPage = lazyWithProgress(() => import('../pages/finance/Shopping'));
const TravelPage = lazyWithProgress(() => import('../pages/finance/Travel'));
const LoanPage = lazyWithProgress(() => import('../pages/finance/Loan'));
const SubscriptionPage = lazyWithProgress(() => import('../pages/finance/Subscription'));
const RentPage = lazyWithProgress(() => import('../pages/finance/Rent'));
const StoragePage = lazyWithProgress(() => import('../pages/life/Storage'));
const CardPage = lazyWithProgress(() => import('../pages/life/Card'));
const TodoPage = lazyWithProgress(() => import('../pages/life/Todo'));
const ForexPage = lazyWithProgress(() => import('../pages/investment/Forex'));
const CryptoPage = lazyWithProgress(() => import('../pages/investment/Crypto'));
const HKStockPage = lazyWithProgress(() => import('../pages/investment/HKStock'));
const USStockPage = lazyWithProgress(() => import('../pages/investment/USStock'));

export const menuItems: MenuItemConfig[] = [
  { key: '/dashboard', icon: 'dashboard', label: '棣栭〉' },
  {
    key: 'health',
    icon: 'heart',
    label: '鍋ュ悍涓績',
    children: [
      { key: '/health/step', icon: 'spark', label: '杩愬姩姝ユ暟' },
      { key: '/health/fitness', icon: 'trend', label: '鍋ヨ韩鍑忚剛' },
      { key: '/health/checkup', icon: 'task', label: '浣撴鏁版嵁' },
      { key: '/health/medication', icon: 'shield', label: '鏃ュ父鐢ㄨ嵂' },
    ],
  },
  {
    key: 'finance',
    icon: 'wallet',
    label: '财务中心',
    children: [
      { key: '/finance/shopping', icon: 'task', label: '网上购物' },
      { key: '/finance/travel', icon: 'spark', label: '鏃呰娓哥帺' },
      { key: '/finance/loan', icon: 'wallet', label: '璐锋杩樻' },
      { key: '/finance/subscription', icon: 'bell', label: '鏈嶅姟璁㈤槄' },
      { key: '/finance/rent', icon: 'box', label: '鎴跨姘寸數' },
    ],
  },
  {
    key: 'life',
    icon: 'box',
    label: '鐢熸椿涓績',
    children: [
      { key: '/life/storage', icon: 'box', label: '鐗╁搧褰掔撼' },
      { key: '/life/card', icon: 'card', label: '鍙峰崱绠＄悊' },
      { key: '/life/todo', icon: 'task', label: '寰呭姙浜嬮」' },
    ],
  },
  {
    key: 'investment',
    icon: 'chart',
    label: '鎶曡祫涓績',
    children: [
      { key: '/investment/forex', icon: 'trend', label: '澶栨眹甯傚満' },
      { key: '/investment/crypto', icon: 'shield', label: '鍔犲瘑甯傚満' },
      { key: '/investment/hk-stock', icon: 'chart', label: '娓偂甯傚満' },
      { key: '/investment/us-stock', icon: 'chart', label: '缇庤偂甯傚満' },
    ],
  },
  { key: '/notifications', icon: 'bell', label: '閫氱煡涓績' },
];

export const routes: RouteConfig[] = [
  { path: '/dashboard', label: '棣栭〉', breadcrumb: ['棣栭〉'], menuKey: '/dashboard', component: Dashboard },
  { path: '/health/step', label: '杩愬姩姝ユ暟', breadcrumb: ['鍋ュ悍涓績', '杩愬姩姝ユ暟'], menuKey: '/health/step', component: StepPage },
  { path: '/health/fitness', label: '鍋ヨ韩鍑忚剛', breadcrumb: ['鍋ュ悍涓績', '鍋ヨ韩鍑忚剛'], menuKey: '/health/fitness', component: FitnessPage },
  { path: '/health/checkup', label: '浣撴鏁版嵁', breadcrumb: ['鍋ュ悍涓績', '浣撴鏁版嵁'], menuKey: '/health/checkup', component: CheckupPage },
  { path: '/health/medication', label: '鏃ュ父鐢ㄨ嵂', breadcrumb: ['鍋ュ悍涓績', '鏃ュ父鐢ㄨ嵂'], menuKey: '/health/medication', component: MedicationPage },
  { path: '/finance/shopping', label: '网上购物', breadcrumb: ['财务中心', '网上购物'], menuKey: '/finance/shopping', component: ShoppingPage },
  { path: '/finance/travel', label: '鏃呰娓哥帺', breadcrumb: ['璐㈠姟涓績', '鏃呰娓哥帺'], menuKey: '/finance/travel', component: TravelPage },
  { path: '/finance/loan', label: '璐锋杩樻', breadcrumb: ['璐㈠姟涓績', '璐锋杩樻'], menuKey: '/finance/loan', component: LoanPage },
  { path: '/finance/subscription', label: '鏈嶅姟璁㈤槄', breadcrumb: ['璐㈠姟涓績', '鏈嶅姟璁㈤槄'], menuKey: '/finance/subscription', component: SubscriptionPage },
  { path: '/finance/rent', label: '鎴跨姘寸數', breadcrumb: ['璐㈠姟涓績', '鎴跨姘寸數'], menuKey: '/finance/rent', component: RentPage },
  { path: '/life/storage', label: '鐗╁搧褰掔撼', breadcrumb: ['鐢熸椿涓績', '鐗╁搧褰掔撼'], menuKey: '/life/storage', component: StoragePage },
  { path: '/life/card', label: '鍙峰崱绠＄悊', breadcrumb: ['鐢熸椿涓績', '鍙峰崱绠＄悊'], menuKey: '/life/card', component: CardPage },
  { path: '/life/todo', label: '寰呭姙浜嬮」', breadcrumb: ['鐢熸椿涓績', '寰呭姙浜嬮」'], menuKey: '/life/todo', component: TodoPage },
  { path: '/investment/forex', label: '澶栨眹甯傚満', breadcrumb: ['鎶曡祫涓績', '澶栨眹甯傚満'], menuKey: '/investment/forex', component: ForexPage },
  { path: '/investment/crypto', label: '鍔犲瘑甯傚満', breadcrumb: ['鎶曡祫涓績', '鍔犲瘑甯傚満'], menuKey: '/investment/crypto', component: CryptoPage },
  { path: '/investment/hk-stock', label: '娓偂甯傚満', breadcrumb: ['鎶曡祫涓績', '娓偂甯傚満'], menuKey: '/investment/hk-stock', component: HKStockPage },
  { path: '/investment/us-stock', label: '缇庤偂甯傚満', breadcrumb: ['鎶曡祫涓績', '缇庤偂甯傚満'], menuKey: '/investment/us-stock', component: USStockPage },
  { path: '/notifications', label: '閫氱煡涓績', breadcrumb: ['閫氱煡涓績'], menuKey: '/notifications', component: NotificationCenterPage },
];
