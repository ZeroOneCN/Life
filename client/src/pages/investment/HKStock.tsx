import { InvestmentDashboard } from '../../components/investment/InvestmentDashboard';
import { INVESTMENT_THEMES } from '../../components/investment/investment-themes';

export default function HKStockPage() {
  const theme = INVESTMENT_THEMES['hk-stock'];
  return <InvestmentDashboard marketId="hk-stock" theme={theme} />;
}
