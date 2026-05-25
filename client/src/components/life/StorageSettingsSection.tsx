import { SectionCard } from '../page';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SelectField } from '../ui';
import type { StoragePageSettings } from '../../types/storage';

interface StorageSettingsSectionProps {
  settings: StoragePageSettings;
  onSettingsChange: (patch: Partial<StoragePageSettings>) => void;
}

export function StorageSettingsSection({
  settings,
  onSettingsChange,
}: StorageSettingsSectionProps) {
  return (
    <SectionCard
      title="页面设置"
      description="这页只保留和物品追踪行为直接相关的设置，不额外扩展通知、导入导出或复杂成本模型。"
    >
      <div className="storage-settings-grid">
        <SettingSwitchCard
          title="看板包含已归档物品"
          description="打开后，成本看板会把已结束使用的物品也纳入趋势和排行，让历史投入一起参与回看。"
          checked={settings.includeArchivedInDashboard}
          onChange={(checked) => onSettingsChange({ includeArchivedInDashboard: checked })}
          statusText={settings.includeArchivedInDashboard ? '已开启' : '已关闭'}
          impact={settings.includeArchivedInDashboard ? '适合做长期总览回看。' : '适合只盯当前仍在持续摊销的物品。'}
        />

        <div className="card switch-card">
          <SelectField
            label="默认排序方式"
            value={settings.defaultSort}
            onChange={(event) => onSettingsChange({ defaultSort: event.target.value as StoragePageSettings['defaultSort'] })}
          >
            <option value="latest">最近更新</option>
            <option value="purchasePrice">购买价格</option>
            <option value="dailyCost">日均成本</option>
          </SelectField>

          <SelectField
            label="默认看板时间范围"
            value={settings.defaultDashboardRange}
            onChange={(event) => onSettingsChange({ defaultDashboardRange: event.target.value as StoragePageSettings['defaultDashboardRange'] })}
          >
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
            <option value="365d">近 365 天</option>
            <option value="all">全部时间</option>
          </SelectField>

          <div className="callout callout-neutral">
            当前默认会优先按
            {settings.defaultSort === 'latest' ? '最近更新' : settings.defaultSort === 'purchasePrice' ? '购买价格' : '日均成本'}
            排序，并以
            {settings.defaultDashboardRange === 'all' ? '全部时间' : settings.defaultDashboardRange}
            作为看板起始时间窗。
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
