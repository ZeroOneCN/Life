import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Field, SelectField, Tag, TextArea } from '../ui';
import {
  calculateRentDerivedMetrics,
  createRentRecord,
  filterRentChannels,
  formatRentAmount,
  updateRentRecord,
} from '../../services/rent';
import type { RentChannel, RentHousingRecord, RentHousingRecordDraft } from '../../types/rent';

interface RentEntrySectionProps {
  currentUserLabel: string;
  activeUserId: string;
  editingRecordId: string;
  records: RentHousingRecord[];
  channels: RentChannel[];
  onChangeRecords: (updater: (records: RentHousingRecord[]) => RentHousingRecord[]) => void;
  onEditingRecordIdChange: (recordId: string) => void;
  onFinishSave: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface RentFormState {
  userId: string;
  address: string;
  channelId: string;
  moveInDate: string;
  moveOutDate: string;
  rent: string;
  deposit: string;
  electricityFee: string;
  waterFee: string;
  gasFee: string;
  agencyFee: string;
  cleaningFee: string;
  laundryFee: string;
  serviceFee: string;
  orientation: string;
  notes: string;
}

/** 房屋朝向选项 */
const ORIENTATION_OPTIONS = [
  { value: '', label: '未选择' },
  { value: '东', label: '东' },
  { value: '南', label: '南' },
  { value: '西', label: '西' },
  { value: '北', label: '北' },
  { value: '东南', label: '东南' },
  { value: '东北', label: '东北' },
  { value: '西南', label: '西南' },
  { value: '西北', label: '西北' },
  { value: '南北', label: '南北' },
  { value: '东西', label: '东西' },
];

function toInputNumber(value: number) {
  return value ? String(value) : '';
}

function createDefaultFormState(activeUserId: string, channels: RentChannel[]): RentFormState {
  const firstChannel = channels.find((item) => item.userId === activeUserId) ?? channels[0] ?? null;

  return {
    userId: activeUserId,
    address: '',
    channelId: firstChannel?.id ?? '',
    moveInDate: dayjs().format('YYYY-MM-DD'),
    moveOutDate: '',
    rent: '',
    deposit: '',
    electricityFee: '',
    waterFee: '',
    gasFee: '',
    agencyFee: '',
    cleaningFee: '',
    laundryFee: '',
    serviceFee: '',
    orientation: '',
    notes: '',
  };
}

function buildFormState(record: RentHousingRecord): RentFormState {
  return {
    userId: record.userId,
    address: record.address,
    channelId: record.channelId,
    moveInDate: record.moveInDate,
    moveOutDate: record.moveOutDate,
    rent: toInputNumber(record.rent),
    deposit: toInputNumber(record.deposit),
    electricityFee: toInputNumber(record.electricityFee),
    waterFee: toInputNumber(record.waterFee),
    gasFee: toInputNumber(record.gasFee),
    agencyFee: toInputNumber(record.agencyFee),
    cleaningFee: toInputNumber(record.cleaningFee),
    laundryFee: toInputNumber(record.laundryFee),
    serviceFee: toInputNumber(record.serviceFee),
    orientation: record.orientation ?? '',
    notes: record.notes,
  };
}

function toOptionalMoney(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function parseDraft(form: RentFormState): RentHousingRecordDraft | null {
  const rent = toOptionalMoney(form.rent);
  const deposit = toOptionalMoney(form.deposit);
  const electricityFee = toOptionalMoney(form.electricityFee);
  const waterFee = toOptionalMoney(form.waterFee);
  const gasFee = toOptionalMoney(form.gasFee);
  const agencyFee = toOptionalMoney(form.agencyFee);
  const cleaningFee = toOptionalMoney(form.cleaningFee);
  const laundryFee = toOptionalMoney(form.laundryFee);
  const serviceFee = toOptionalMoney(form.serviceFee);

  if (
    !form.userId.trim()
    || !form.address.trim()
    || !form.channelId
    || !dayjs(form.moveInDate).isValid()
    || [rent, deposit, electricityFee, waterFee, gasFee, agencyFee, cleaningFee, laundryFee, serviceFee].some((value) => Number.isNaN(value))
  ) {
    return null;
  }

  if (form.moveOutDate && !dayjs(form.moveOutDate).isValid()) {
    return null;
  }

  return {
    userId: form.userId.trim(),
    address: form.address.trim(),
    channelId: form.channelId,
    moveInDate: form.moveInDate,
    moveOutDate: form.moveOutDate || '',
    rent,
    deposit,
    electricityFee,
    waterFee,
    gasFee,
    agencyFee,
    cleaningFee,
    laundryFee,
    serviceFee,
    orientation: form.orientation.trim(),
    notes: form.notes.trim(),
  };
}

export function RentEntrySection({
  currentUserLabel,
  activeUserId,
  editingRecordId,
  records,
  channels,
  onChangeRecords,
  onEditingRecordIdChange,
  onFinishSave,
  showToast,
}: RentEntrySectionProps) {
  const [form, setForm] = useState<RentFormState>(() => createDefaultFormState(activeUserId, channels));

  const availableChannels = useMemo(
    () => filterRentChannels(channels, form.userId || activeUserId),
    [activeUserId, channels, form.userId],
  );

  const editingRecord = useMemo(
    () => records.find((record) => record.id === editingRecordId) ?? null,
    [editingRecordId, records],
  );

  useEffect(() => {
    if (editingRecord) {
      setForm(buildFormState(editingRecord));
      return;
    }

    setForm(createDefaultFormState(activeUserId, channels));
  }, [activeUserId, channels, editingRecord]);

  useEffect(() => {
    const exists = availableChannels.some((channel) => channel.id === form.channelId);
    if (exists) {
      return;
    }

    setForm((previous) => ({ ...previous, channelId: availableChannels[0]?.id ?? '' }));
  }, [availableChannels, form.channelId]);

  const preview = useMemo(() => calculateRentDerivedMetrics({
    moveInDate: form.moveInDate || dayjs().format('YYYY-MM-DD'),
    moveOutDate: form.moveOutDate,
    rent: Number(form.rent || 0),
    electricityFee: Number(form.electricityFee || 0),
    waterFee: Number(form.waterFee || 0),
    gasFee: Number(form.gasFee || 0),
    agencyFee: Number(form.agencyFee || 0),
    cleaningFee: Number(form.cleaningFee || 0),
    laundryFee: Number(form.laundryFee || 0),
    serviceFee: Number(form.serviceFee || 0),
  }), [form]);

  const handleSave = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全用户、地址、渠道、入住日期以及有效费用信息。', 'error');
      return;
    }

    const channelExists = channels.some((channel) => channel.id === draft.channelId);
    if (!channelExists) {
      showToast('请选择一个有效的租房渠道。', 'error');
      return;
    }

    if (editingRecord) {
      onChangeRecords((previous) => updateRentRecord(channels, previous, editingRecord.id, draft));
      showToast('住房记录已更新。');
    } else {
      onChangeRecords((previous) => createRentRecord(channels, previous, draft));
      showToast('住房记录已新增。');
    }

    onEditingRecordIdChange('');
    setForm(createDefaultFormState(activeUserId, channels));
    onFinishSave();
  };

  const handleReset = () => {
    onEditingRecordIdChange('');
    setForm(createDefaultFormState(activeUserId, channels));
  };

  if (!channels.length) {
    return (
      <SectionCard
        title="录入编辑"
        description="当前还没有可用渠道，请先到渠道管理里创建至少一个渠道，再回来录入住房档案。"
      >
        <EmptyState title="暂无可用渠道" description="先创建渠道，再录入住房地址、费用和入住信息。" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="录入编辑"
      description="新增和编辑统一走大表单，尽量把常用信息并列展开，减少上下滚动。"
      action={<Tag tone={editingRecord ? 'orange' : 'green'}>{editingRecord ? '编辑模式' : '新增模式'}</Tag>}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前保存目标用户为 <strong>{currentUserLabel}</strong>。
          保存成功后会自动回到住房记录列表，并保留完整的渠道快照与成本统计。
        </div>

        <form className="rent-entry-form" onSubmit={(event) => { event.preventDefault(); handleSave(); }}>
          <div className="rent-entry-module">
            <div className="rent-entry-module-head">
              <h3>基础信息</h3>
              <span>住房地址、用户、渠道与入住 / 退租日期</span>
            </div>
            <div className="rent-entry-grid rent-entry-grid-primary">
              <div className="rent-entry-cell rent-entry-cell-address">
                <Field
                  label="住房地址"
                  value={form.address}
                  onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))}
                  placeholder="例如：上海市浦东新区锦绣路 1888 弄 8 号 1202"
                />
              </div>

              <div className="rent-entry-cell">
                <SelectField
                  label="租房渠道"
                  value={form.channelId}
                  onChange={(event) => setForm((previous) => ({ ...previous, channelId: event.target.value }))}
                >
                  {availableChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.name}</option>
                  ))}
                </SelectField>
              </div>

              <div className="rent-entry-cell">
                <DatePickerField
                  label="入住日期"
                  value={form.moveInDate}
                  onChange={(value) => setForm((previous) => ({ ...previous, moveInDate: value }))}
                  clearable={false}
                />
              </div>

              <div className="rent-entry-cell">
                <DatePickerField
                  label="退租日期"
                  value={form.moveOutDate}
                  onChange={(value) => setForm((previous) => ({ ...previous, moveOutDate: value }))}
                  placeholder="未退租可留空"
                />
              </div>

              <div className="rent-entry-cell">
                <SelectField
                  label="房屋朝向"
                  value={form.orientation}
                  onChange={(event) => setForm((previous) => ({ ...previous, orientation: event.target.value }))}
                >
                  {ORIENTATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </div>
            </div>
          </div>

          <div className="rent-entry-module">
            <div className="rent-entry-module-head">
              <h3>费用明细</h3>
              <span>房租、押金和水电等杂费，押金仅展示不计入总成本</span>
            </div>
            <div className="rent-cost-grid">
              {[
                ['房租', 'rent'],
                ['押金', 'deposit'],
                ['电费', 'electricityFee'],
                ['水费', 'waterFee'],
                ['燃气费', 'gasFee'],
                ['中介费', 'agencyFee'],
                ['保洁费', 'cleaningFee'],
                ['洗衣费', 'laundryFee'],
                ['服务费', 'serviceFee'],
              ].map(([label, key]) => (
                <Field
                  key={key}
                  label={label}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[key as keyof RentFormState] as string}
                  onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
                  placeholder="0"
                />
              ))}
            </div>
          </div>

          <div className="rent-entry-module">
            <div className="rent-entry-module-head">
              <h3>备注</h3>
              <span>补充房屋朝向、物业、地铁距离、退租原因等信息</span>
            </div>
            <div className="rent-entry-grid rent-entry-grid-secondary">
              <div className="rent-entry-cell rent-entry-cell-full">
                <TextArea
                  label="备注"
                  value={form.notes}
                  onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                  placeholder="记录房屋朝向、物业、地铁距离、退租原因等补充信息"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="rent-entry-module">
            <div className="rent-entry-module-head">
              <h3>实时计算</h3>
              <span>根据当前表单内容自动汇总居住天数和成本</span>
            </div>
            <StatGrid
              className="rent-summary-grid"
              items={[
                {
                  label: '居住天数',
                  value: `${preview.stayDays} 天`,
                  helper: preview.occupancyStatus === 'active' ? '当前按今天作为在住截止日计算' : '按退租日计算',
                },
                { label: '总成本', value: formatRentAmount(preview.totalCost), helper: '不含押金' },
                { label: '单日成本', value: formatRentAmount(preview.dailyCost) },
                { label: '折算月租', value: formatRentAmount(preview.monthlyRent) },
                { label: '折算季度租金', value: formatRentAmount(preview.quarterlyRent) },
                { label: '押金展示', value: formatRentAmount(Number(form.deposit || 0)), helper: '仅展示，不参与成本统计' },
              ]}
            />
          </div>

          <div className="rent-form-actions">
            <Btn tone="secondary" onClick={handleReset}>清空表单</Btn>
            <Btn tone="primary" type="submit">{editingRecord ? '保存住房记录' : '新增住房记录'}</Btn>
          </div>
        </form>
      </div>

    </SectionCard>
  );
}
