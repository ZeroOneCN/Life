import { useState, useEffect } from 'react';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  HeartOutlined,
  FireOutlined,
  RiseOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  BankOutlined,
  ShoppingCartOutlined,
  CompassOutlined,
  SwapOutlined,
  CalendarOutlined,
  HomeOutlined,
  SmileOutlined,
  InboxOutlined,
  CreditCardOutlined,
  CheckSquareOutlined,
  FundOutlined,
  GlobalOutlined,
  SafetyOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '首页',
  },
  {
    key: 'health',
    icon: <HeartOutlined />,
    label: '健康中心',
    children: [
      { key: '/health/step', icon: <FireOutlined />, label: '运动步数' },
      { key: '/health/fitness', icon: <RiseOutlined />, label: '健身减肥' },
      { key: '/health/checkup', icon: <FileTextOutlined />, label: '体检数据（待开发）' },
      { key: '/health/medication', icon: <MedicineBoxOutlined />, label: '日常用药' },
    ],
  },
  {
    key: 'finance',
    icon: <BankOutlined />,
    label: '财务中心',
    children: [
      { key: '/finance/shopping', icon: <ShoppingCartOutlined />, label: '网上购物' },
      { key: '/finance/travel', icon: <CompassOutlined />, label: '旅行游玩' },
      { key: '/finance/loan', icon: <SwapOutlined />, label: '借款还款' },
      { key: '/finance/subscription', icon: <CalendarOutlined />, label: '服务订阅（待开发）' },
      { key: '/finance/rent', icon: <HomeOutlined />, label: '房租水电' },
    ],
  },
  {
    key: 'life',
    icon: <SmileOutlined />,
    label: '生活中心',
    children: [
      { key: '/life/storage', icon: <InboxOutlined />, label: '物品归纳' },
      { key: '/life/card', icon: <CreditCardOutlined />, label: '号卡管理' },
      { key: '/life/todo', icon: <CheckSquareOutlined />, label: '待办事项' },
    ],
  },
  {
    key: 'investment',
    icon: <FundOutlined />,
    label: '投资中心',
    children: [
      { key: '/investment/forex', icon: <GlobalOutlined />, label: '外汇市场' },
      { key: '/investment/crypto', icon: <SafetyOutlined />, label: '加密市场（待开发）' },
      { key: '/investment/hk-stock', icon: <BarChartOutlined />, label: '港股市场（待开发）' },
      { key: '/investment/us-stock', icon: <LineChartOutlined />, label: '美股市场（待开发）' },
    ],
  },
];

function getOpenKeys(pathname) {
  const prefix = pathname.split('/')[1];
  if (['health', 'finance', 'life', 'investment'].includes(prefix)) return [prefix];
  return [];
}

export default function SideMenu({ collapsed, isDark, onSelect, selectedKeys }) {
  const [openKeys, setOpenKeys] = useState(() => getOpenKeys(selectedKeys[0]));

  useEffect(() => {
    if (collapsed) setOpenKeys([]);
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed) {
      const computed = getOpenKeys(selectedKeys[0]);
      if (computed.length) setOpenKeys(computed);
    }
  }, [selectedKeys, collapsed]);

  const onOpenChange = (keys) => {
    if (keys.length > 1) {
      setOpenKeys([keys[keys.length - 1]]);
    } else {
      setOpenKeys(keys);
    }
  };

  return (
    <Menu
      theme={isDark ? 'dark' : 'light'}
      mode="inline"
      items={menuItems}
      onClick={onSelect}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={onOpenChange}
      style={{
        background: 'transparent',
        fontSize: 14,
        borderInlineEnd: 'none',
      }}
    />
  );
}
