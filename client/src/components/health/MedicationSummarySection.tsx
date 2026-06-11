import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { DatePickerField, MonthPickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, Field, SelectField, Tag, TextArea } from '../ui';
import {
  MEDICATION_REMINDER_META,
  buildMedicationLowStockItems,
  buildMedicationStockSummary,
  filterMedicationRecordsByUserId,
  filterMedicationSummariesByUserId,
} from '../../services/medication';
import { useNotificationCenterState } from '../../services/notificationCenter';
import type {
  MedicationDailySummary,
  MedicationPageState,
  MedicationPurchaseRecord,
  MedicationRecord,
  MedicationReminderTimeKey,
  MedicationStockInsight,
} from '../../types/medication';

interface MedicationSummarySectionProps {
  records: MedicationRecord[];
  purchases: MedicationPurchaseRecord[];
  summaries: MedicationDailySummary[];
  settings: MedicationPageState['settings'];
  onSettingsChange: (patch: Partial<MedicationPageState['settings']>) => void;
  onSaveSummary: (date: string, content: string) => void;
  onDoseReminderToggle: (checked: boolean) => void;
  onStockReminderToggle: (checked: boolean) => void;
  onTriggerDoseReminder: (slot: MedicationReminderTimeKey) => void;
  onTriggerStockReminder: () => void;
}

const REMINDER_SLOTS: MedicationReminderTimeKey[] = ['breakfast', 'lunch', 'dinner'];

const REMINDER_SETTING_KEY_MAP: Record<
  MedicationReminderTimeKey,
  'breakfastReminderTime' | 'lunchReminderTime' | 'dinnerReminderTime'
> = {
  breakfast: 'breakfastReminderTime',
  lunch: 'lunchReminderTime',
  dinner: 'dinnerReminderTime',
};

function buildInitialSummaryDate() {
  return dayjs().format('YYYY-MM-DD');
}

function buildTimeOptions() {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }

  return options;
}

const REMINDER_TIME_OPTIONS = buildTimeOptions();

export function MedicationSummarySection({
  records,
  purchases,
  summaries,
  settings,
  onSettingsChange,
  onSaveSummary,
  onDoseReminderToggle,
  onStockReminderToggle,
  onTriggerDoseReminder,
  onTriggerStockReminder,
}: MedicationSummarySectionProps) {
  const notificationState = useNotificationCenterState();
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedDate, setSelectedDate] = useState(buildInitialSummaryDate);
  const [summaryText, setSummaryText] = useState('');

  const filteredSummaries = useMemo(
    () => filterMedicationSummariesByUserId(summaries),
    [summaries],
  );
  const monthlySummaries = useMemo(
    () => filteredSummaries.filter((summary) => summary.date.startsWith(selectedMonth)),
    [filteredSummaries, selectedMonth],
  );
  const selectedSummary = useMemo(
    () => filteredSummaries.find((summary) => summary.date === selectedDate) ?? null,
    [filteredSummaries, selectedDate],
  );
  const selectedDateTotal = useMemo(
    () => filterMedicationRecordsByUserId(records)
      .filter((record) => record.date === selectedDate)
      .reduce((sum, record) => sum + record.breakfast + record.lunch + record.dinner, 0),
    [records, selectedDate],
  );
  const stockInsights = useMemo(
    () => buildMedicationStockSummary(
      records,
      purchases,
      settings.defaultStockThreshold,
      settings.medicineThresholds,
    ),
    [records, purchases, settings.defaultStockThreshold, settings.medicineThresholds],
  );
  const lowStockItems = useMemo(
    () => buildMedicationLowStockItems(
      records,
      purchases,
      settings.defaultStockThreshold,
      settings.medicineThresholds,
    ),
    [records, purchases, settings.defaultStockThreshold, settings.medicineThresholds],
  );
  const latestLogs = useMemo(
    () => notificationState.logs
      .filter((log) => log.sceneId === 'medication.dose_reminder' || log.sceneId === 'medication.stock_low')
      .slice(0, 5),
    [notificationState.logs],
  );

  useEffect(() => {
    setSummaryText(selectedSummary?.content ?? '');
  }, [selectedSummary]);

  useEffect(() => {
    if (!selectedDate.startsWith(selectedMonth)) {
      setSelectedDate(`${selectedMonth}-01`);
    }
  }, [selectedDate, selectedMonth]);

  const mixedUnitItems = stockInsights.filter((item) => item.status === 'mixed_unit');
  const missingPurchaseItems = stockInsights.filter((item) => item.status === 'no_purchase');

  return (
    <SectionCard
      title="总结与提醒"
      description="保留每日总结编辑能力，同时把服药提醒和低库存提醒统一接入通知中心。"
    >
      <div className="page-stack">
        <div className="medication-filter-grid medication-filter-grid-summary">
          <MonthPickerField
            label="摘要月份"
            value={selectedMonth}
            onChange={setSelectedMonth}
            clearable={false}
          />
          <DatePickerField
            label="总结日期"
            value={selectedDate}
            onChange={setSelectedDate}
            clearable={false}
          />
        </div>

        <div className="medication-summary-grid">
          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>每日总结</strong>
              <span>当天总用量 {selectedDateTotal}，可以记录症状、观察和服药反馈。</span>
            </div>
            <TextArea
              label="总结内容"
              value={summaryText}
              onChange={(event) => setSummaryText(event.target.value)}
              placeholder="例如：今天按时服药后咳嗽减轻，晚间无明显不适。"
            />
            <div className="fitness-form-actions">
              <span className="subtle-text">清空内容后保存，会移除该日期下的已有总结。</span>
              <Btn tone="primary" onClick={() => onSaveSummary(selectedDate, summaryText)}>保存每日总结</Btn>
            </div>
          </div>

          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>本月已写摘要</strong>
              <span>快速查看当前月份下已经保存的用药总结。</span>
            </div>
            {monthlySummaries.length ? (
              <div className="medication-summary-list">
                {monthlySummaries.map((summary) => (
                  <button
                    key={summary.id}
                    type="button"
                    className={`medication-summary-item ${summary.date === selectedDate ? 'is-active' : ''}`}
                    onClick={() => setSelectedDate(summary.date)}
                  >
                    <strong>{summary.date}</strong>
                    <span>{summary.content.replace(/\s+/g, ' ').slice(0, 36) || '无摘要内容'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="本月还没有总结" description="先为一个有用药记录的日期补一段观察笔记。" />
            )}
          </div>
        </div>

        <div className="medication-reminder-grid">
          <SettingSwitchCard
            title="服药提醒"
            description="控制早餐、午餐、晚餐三个时段的服药提醒是否统一走通知中心发送。"
            checked={settings.doseReminderEnabled}
            onChange={onDoseReminderToggle}
            statusText={settings.doseReminderEnabled ? '已启用' : '已停用'}
            impact="开启后，这个页面只负责提醒时间和触发动作为主，渠道选择与发送日志都统一交给通知中心。"
          >
            <div className="medication-reminder-times">
              {REMINDER_SLOTS.map((slot) => {
                const settingKey = REMINDER_SETTING_KEY_MAP[slot];

                return (
                  <SelectField
                    key={slot}
                    label={MEDICATION_REMINDER_META[slot].label}
                    value={settings[settingKey]}
                    onChange={(event) => onSettingsChange({
                      [settingKey]: event.target.value,
                    } as Partial<MedicationPageState['settings']>)}
                  >
                    {REMINDER_TIME_OPTIONS.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{timeValue}</option>
                    ))}
                  </SelectField>
                );
              })}
            </div>
            <div className="fitness-row-actions medication-trigger-actions">
              {REMINDER_SLOTS.map((slot) => (
                <Btn
                  key={slot}
                  tone="secondary"
                  disabled={!settings.doseReminderEnabled}
                  onClick={() => onTriggerDoseReminder(slot)}
                >
                  发送{MEDICATION_REMINDER_META[slot].label}
                </Btn>
              ))}
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="medication.dose_reminder"
            title="服药提醒场景"
            summary="查看通知中心里服药提醒当前绑定的渠道数量和场景状态。"
          />

          <SettingSwitchCard
            title="低库存提醒"
            description="根据购药记录与累计服药总量估算库存，进入阈值后统一写入通知中心。"
            checked={settings.stockReminderEnabled}
            onChange={onStockReminderToggle}
            statusText={settings.stockReminderEnabled ? '已启用' : '已停用'}
            impact={`默认阈值为 ${settings.defaultStockThreshold}，若某药品有单独阈值，会优先使用单药阈值。`}
          >
            <div className="medication-threshold-grid">
              <Field
                label="全局默认阈值"
                type="number"
                min="0"
                value={String(settings.defaultStockThreshold)}
                onChange={(event) => onSettingsChange({
                  defaultStockThreshold: Math.max(0, Number(event.target.value) || 0),
                })}
              />
              <div className="fitness-form-actions">
                <span className="subtle-text">只对购药单位一致的药品做库存估算，不做跨单位换算。</span>
                <Btn tone="secondary" disabled={!settings.stockReminderEnabled} onClick={onTriggerStockReminder}>
                  执行低库存检查
                </Btn>
              </div>
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="medication.stock_low"
            title="低库存提醒场景"
            summary="库存不足、即将用尽等提示都统一由通知中心选渠道并记录日志。"
          />
        </div>

        <div className="two-column-layout">
          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>库存估算列表</strong>
              <span>低库存、混合单位和缺失购药记录都会在这里汇总。</span>
            </div>
            {stockInsights.length ? (
              <DataTable
                rowKey="medicineName"
                data={stockInsights}
                columns={[
                  {
                    key: 'medicineName',
                    title: '药品',
                    dataIndex: 'medicineName',
                  },
                  {
                    key: 'remainingQuantity',
                    title: '剩余量',
                    render: (_value: unknown, row: MedicationStockInsight) => (
                      row.remainingQuantity === null ? '-' : `${row.remainingQuantity} ${row.unit ?? ''}`.trim()
                    ),
                  },
                  {
                    key: 'threshold',
                    title: '阈值',
                    render: (_value: unknown, row: MedicationStockInsight) => (
                      <input
                        className="medication-threshold-input"
                        type="number"
                        min="0"
                        value={String(settings.medicineThresholds[row.medicineName] ?? row.threshold)}
                        onChange={(event) => onSettingsChange({
                          medicineThresholds: {
                            ...settings.medicineThresholds,
                            [row.medicineName]: Math.max(0, Number(event.target.value) || 0),
                          },
                        })}
                      />
                    ),
                  },
                  {
                    key: 'status',
                    title: '状态',
                    render: (_value: unknown, row: MedicationStockInsight) => (
                      <Tag
                        tone={
                          row.status === 'low'
                            ? 'red'
                            : row.status === 'mixed_unit'
                              ? 'orange'
                              : row.status === 'no_purchase'
                                ? 'blue'
                                : 'green'
                        }
                      >
                        {row.status === 'low'
                          ? '低库存'
                          : row.status === 'mixed_unit'
                            ? '单位不一致'
                            : row.status === 'no_purchase'
                              ? '缺少购药记录'
                              : '库存正常'}
                      </Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState title="暂无库存估算数据" description="先录入每日用药和购药记录，库存估算才会开始生效。" />
            )}
            {mixedUnitItems.length ? (
              <div className="callout callout-neutral">
                {mixedUnitItems.map((item) => item.medicineName).join('、')} 的采购记录单位不一致，当前暂不参与低库存估算。
              </div>
            ) : null}
            {missingPurchaseItems.length ? (
              <div className="callout callout-neutral">
                {missingPurchaseItems.map((item) => item.medicineName).join('、')} 尚未找到对应购药记录，当前只做提示不触发库存提醒。
              </div>
            ) : null}
          </div>

          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>最近提醒日志</strong>
              <span>只展示 medication 模块自己的提醒发送记录。</span>
            </div>
            <NotificationLogTable logs={latestLogs} />
            {lowStockItems.length ? (
              <div className="callout callout-info">
                当前低库存药品：
                {lowStockItems.map((item) => (
                  `${item.medicineName}${item.remainingQuantity === null ? '' : `（剩余 ${item.remainingQuantity}${item.unit ?? ''}）`}`
                )).join('、')}
              </div>
            ) : (
              <div className="callout callout-neutral">
                当前没有进入低库存阈值的药品。
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
