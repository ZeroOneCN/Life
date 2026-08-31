import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Field, SelectField } from '../ui';
import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;
import { buildApiErrorMessage } from '../../lib/api';
import { scheduleApi } from '../../services/scheduleApi';
import type { ScheduleCalendarView, ScheduleSettings } from '../../types/schedule';

interface ScheduleSettingsSectionProps {
  settings: ScheduleSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => Promise<void> | void;
}

const REMINDER_MINUTE_OPTIONS = [
  { value: 0, label: '事件开始时' },
  { value: 5, label: '5 分钟前' },
  { value: 15, label: '15 分钟前' },
  { value: 30, label: '30 分钟前' },
  { value: 60, label: '1 小时前' },
  { value: 120, label: '2 小时前' },
  { value: 1440, label: '1 天前' },
];

/**
 * 日程提醒设置组件：维护提醒开关、默认视图、提醒时间等。
 */
export function ScheduleSettingsSection({
  settings,
  showToast,
  onChanged,
}: ScheduleSettingsSectionProps) {
  /**
   * 保存设置补丁。
   * @param patch 设置补丁
   * @param successMessage 成功提示
   */
  const savePatch = async (patch: Partial<ScheduleSettings>, successMessage: string) => {
    try {
      await scheduleApi.updateSettings(patch);
      await onChanged();
      showToast(successMessage);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '提醒设置更新失败。'), 'error');
    }
  };

  /**
   * 手动触发今日提醒。
   */
  const triggerReminder = async () => {
    try {
      await scheduleApi.triggerReminder();
      await onChanged();
      showToast('今日日程提醒已写入通知中心日志。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '手动发送提醒失败。'), 'error');
    }
  };

  return (
    <SectionCard
      title="提醒设置"
      description="日程页只维护提醒规则和触发入口，渠道、模板和完整日志统一归通知中心。"
      action={
        <Btn tone="primary" onClick={() => void triggerReminder()}>
          手动发送今日提醒
        </Btn>
      }
    >
      <div className="page-grid-wrapper">
        <Row gutter={[24, 20]}>
          <Col span={24}>
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <SettingSwitchCard
                  title="日程提醒"
                  description="到达设定时间后，按后端规则扫描今日和明日日程并生成统一提醒日志。"
                  checked={settings.reminderEnabled}
                  onChange={(checked) => {
                    void savePatch(
                      { reminderEnabled: checked },
                      `日程提醒已${checked ? '启用' : '停用'}。`,
                    );
                  }}
                  statusText={settings.reminderEnabled ? '已启用' : '已停用'}
                  impact={`当前会在每天 ${settings.reminderTime} 后扫描提醒，默认提前 ${settings.defaultReminderMinutes} 分钟。`}
                >
                  <Row gutter={[12, 12]}>
                    <Col span={8}>
                      <Field
                        label="每日提醒时间"
                        type="time"
                        value={settings.reminderTime}
                        onChange={(event) => {
                          void savePatch(
                            { reminderTime: event.target.value || '08:00' },
                            '提醒时间已更新。',
                          );
                        }}
                      />
                    </Col>
                    <Col span={8}>
                      <SelectField
                        label="默认提前提醒"
                        value={String(settings.defaultReminderMinutes)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isFinite(value)) {
                            void savePatch(
                              { defaultReminderMinutes: Math.max(0, value) },
                              '默认提醒时间已更新。',
                            );
                          }
                        }}
                      >
                        {REMINDER_MINUTE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </SelectField>
                    </Col>
                    <Col span={8}>
                      <SelectField
                        label="默认日历视图"
                        value={settings.defaultView}
                        onChange={(event) => {
                          void savePatch(
                            { defaultView: event.target.value as ScheduleCalendarView },
                            '默认日历视图已更新。',
                          );
                        }}
                      >
                        <option value="month">月视图</option>
                        <option value="week">周视图</option>
                        <option value="day">日视图</option>
                      </SelectField>
                    </Col>
                    <Col span={8}>
                      <SelectField
                        label="一周开始于"
                        value={String(settings.weekStartsOn)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (value === 0 || value === 1) {
                            void savePatch({ weekStartsOn: value }, '一周起始日已更新。');
                          }
                        }}
                      >
                        <option value={1}>周一</option>
                        <option value={0}>周日</option>
                      </SelectField>
                    </Col>
                  </Row>
                </SettingSwitchCard>
              </Col>

              <Col span={8}>
                <NotificationStatusCard
                  sceneId="schedule.reminder"
                  title="通知中心场景状态"
                  summary="查看当前绑定渠道、启用状态和统一发送入口。"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </div>
    </SectionCard>
  );
}
