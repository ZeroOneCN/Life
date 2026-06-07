import { InvestmentDashboard } from '../../components/investment/InvestmentDashboard';
import { INVESTMENT_THEMES } from '../../components/investment/investment-themes';

export default function CryptoPage() {
  const theme = INVESTMENT_THEMES.crypto;
  return <InvestmentDashboard marketId="crypto" theme={theme} />;
}
