import { InvestmentDashboard } from '../../components/investment/InvestmentDashboard';
import { INVESTMENT_THEMES } from '../../components/investment/investment-themes';

export default function USStockPage() {
  const theme = INVESTMENT_THEMES['us-stock'];
  return <InvestmentDashboard marketId="us-stock" theme={theme} />;
}
