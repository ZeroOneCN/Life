import { SectionCard } from '../page';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SelectField } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { storageApi } from '../../services/storageApi';
import type { StoragePageSettings } from '../../types/storage';

interface StorageSettingsSectionProps {
  settings: StoragePageSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

export function StorageSettingsSection({
  settings,
  showToast,
  onChanged,
}: StorageSettingsSectionProps) {
  const savePatch = async (patch: Partial<StoragePageSettings>, successMessage: string) => {
    try {
      await storageApi.updateSettings(patch);
      onChanged();
      showToast(successMessage);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '页面设置更新失败。'), 'error');
    }
  };

  return (
    <SectionCard
      title="页面设置"
      description="这里仅保留物品追踪本身的页面行为设置，不扩展通知、导入导出或复杂成本模型。"
    >
      <div className="storage-settings-grid">
        <SettingSwitchCard
          title="看板包含已归档物品"
          description="打开后，成本看板会把已结束使用的物品也纳入趋势和排行。"
          checked={settings.includeArchivedInDashboard}
          onChange={(checked) => {
            void savePatch({ includeArchivedInDashboard: checked }, `看板范围已${checked ? '包含' : '排除'}归档物品。`);
          }}
          statusText={settings.includeArchivedInDashboard ? '已开启' : '已关闭'}
          impact={settings.includeArchivedInDashboard ? '适合做长期总览回看。' : '适合只盯当前仍在持续摊销的物品。'}
        />

        <div className="card switch-card">
          <SelectField
            label="默认排序方式"
            value={settings.defaultSort}
            onChange={(event) => {
              void savePatch({ defaultSort: event.target.value as StoragePageSettings['defaultSort'] }, '默认排序方式已更新。');
            }}
          >
            <option value="latest">最近更新</option>
            <option value="purchasePrice">购买价格</option>
            <option value="dailyCost">日均成本</option>
          </SelectField>

          <SelectField
            label="默认看板时间范围"
            value={settings.defaultDashboardRange}
            onChange={(event) => {
              void savePatch({ defaultDashboardRange: event.target.value as StoragePageSettings['defaultDashboardRange'] }, '默认看板范围已更新。');
            }}
          >
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
            <option value="365d">近 365 天</option>
            <option value="all">全部时间</option>
          </SelectField>
        </div>
      </div>
    </SectionCard>
  );
}
