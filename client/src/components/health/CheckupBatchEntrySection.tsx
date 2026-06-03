import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, Field, SelectField, TextArea } from '../ui';
import { applyCheckupTemplate, normalizeCheckupUserId } from '../../services/checkup';
import type { CheckupRecordDraft, CheckupTemplate } from '../../types/checkup';

interface BatchRowState {
  id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
}

interface CheckupBatchEntrySectionProps {
  currentUserLabel: string;
  activeUserId: string;
  templates: CheckupTemplate[];
  preferredTemplateId?: string | null;
  onPreferredTemplateConsumed: () => void;
  onCreateBatch: (drafts: CheckupRecordDraft[]) => void;
  onSaveSuccess?: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function createRow(seed?: Partial<BatchRowState>): BatchRowState {
  return {
    id: Math.random().toString(36).slice(2, 10),
    testName: seed?.testName ?? '',
    value: seed?.value ?? '',
    unit: seed?.unit ?? 'mmol/L',
    referenceRange: seed?.referenceRange ?? '',
  };
}

export function CheckupBatchEntrySection({
  currentUserLabel,
  activeUserId,
  templates,
  preferredTemplateId,
  onPreferredTemplateConsumed,
  onCreateBatch,
  onSaveSuccess,
  showToast,
}: CheckupBatchEntrySectionProps) {
  const [userId, setUserId] = useState(activeUserId);
  const [testDate, setTestDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [testType, setTestType] = useState('生化检查');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [rows, setRows] = useState<BatchRowState[]>([createRow()]);

  useEffect(() => {
    setUserId(activeUserId);
  }, [activeUserId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  useEffect(() => {
    if (!preferredTemplateId) {
      return;
    }

    const template = templates.find((item) => item.id === preferredTemplateId);
    if (!template) {
      onPreferredTemplateConsumed();
      return;
    }

    setTemplateId(template.id);
    setTestType(template.testType);
    setRows(applyCheckupTemplate(template).map((item) => createRow(item)));
    onPreferredTemplateConsumed();
  }, [onPreferredTemplateConsumed, preferredTemplateId, templates]);

  const handleApplyTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);

    if (!template) {
      return;
    }

    setTestType(template.testType);
    setRows(applyCheckupTemplate(template).map((item) => createRow(item)));
  };

  const handleSubmit = () => {
    const normalizedUserId = normalizeCheckupUserId(userId);

    if (!normalizedUserId) {
      showToast('请先填写批量录入的用户 ID。', 'error');
      return;
    }

    if (!dayjs(testDate).isValid()) {
      showToast('请选择有效的检查日期。', 'error');
      return;
    }

    if (!testType.trim()) {
      showToast('请填写检查类型。', 'error');
      return;
    }

    const drafts = rows
      .filter((row) => row.testName.trim() || row.value.trim() || row.referenceRange.trim())
      .map((row) => ({
        userId: normalizedUserId,
        testDate,
        testType: testType.trim(),
        testName: row.testName.trim(),
        value: Number(row.value),
        unit: row.unit.trim(),
        referenceRange: row.referenceRange.trim(),
        followUpDate,
        notes: notes.trim(),
      }))
      .filter((draft) => draft.testName && Number.isFinite(draft.value));

    if (!drafts.length) {
      showToast('请至少填写一条有效的指标数据。', 'error');
      return;
    }

    onCreateBatch(drafts);
    onSaveSuccess?.();
    setRows(selectedTemplate ? applyCheckupTemplate(selectedTemplate).map((item) => createRow(item)) : [createRow()]);
    setNotes('');
    setFollowUpDate('');
  };

  return (
    <SectionCard
      title="批量录入"
      description="适合一次录入同一天、同一用户、同一检查类型下的多项指标，也可从模板快速回填。"
    >
      <div className="page-stack">
        <div className="checkup-filter-grid">
          <Field
            label="当前录入用户"
            value={currentUserLabel}
            disabled
          />
          <DatePickerField label="检查日期" value={testDate} onChange={setTestDate} clearable={false} />
          <Field
            label="检查类型"
            value={testType}
            onChange={(event) => setTestType(event.target.value)}
            placeholder="例如：年度体检"
          />
          <SelectField label="选择模板" value={templateId} onChange={(event) => handleApplyTemplate(event.target.value)}>
            <option value="">不使用模板</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </SelectField>
          <DatePickerField label="统一复查日期" value={followUpDate} onChange={setFollowUpDate} placeholder="可选" />
        </div>

        <TextArea
          label="统一备注"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="例如：同次年度体检批量录入"
        />

        <div className="checkup-batch-header">
          <strong>批量项目明细</strong>
          <Btn tone="secondary" onClick={() => setRows((previous) => [...previous, createRow()])}>新增一行</Btn>
        </div>

        <div className="checkup-batch-list">
          {rows.map((row, index) => (
            <div key={row.id} className="checkup-batch-row">
              <span className="checkup-batch-index">{index + 1}</span>
              <Field
                label="项目"
                value={row.testName}
                onChange={(event) => setRows((previous) => previous.map((item) => (
                  item.id === row.id ? { ...item, testName: event.target.value } : item
                )))}
                placeholder="例如：ALT"
              />
              <Field
                label="结果"
                type="number"
                step="0.01"
                value={row.value}
                onChange={(event) => setRows((previous) => previous.map((item) => (
                  item.id === row.id ? { ...item, value: event.target.value } : item
                )))}
                placeholder="数值"
              />
              <Field
                label="单位"
                value={row.unit}
                onChange={(event) => setRows((previous) => previous.map((item) => (
                  item.id === row.id ? { ...item, unit: event.target.value } : item
                )))}
                placeholder="例如：U/L"
              />
              <Field
                label="参考范围"
                value={row.referenceRange}
                onChange={(event) => setRows((previous) => previous.map((item) => (
                  item.id === row.id ? { ...item, referenceRange: event.target.value } : item
                )))}
                placeholder="例如：7-40"
              />
              <Btn
                tone="danger"
                disabled={rows.length === 1}
                onClick={() => setRows((previous) => previous.filter((item) => item.id !== row.id))}
              >
                删除
              </Btn>
            </div>
          ))}
        </div>

        {!rows.length ? (
          <EmptyState
            title="暂无批量项目"
            description="可以手动新增一行，或者先从模板中心准备一个常用模板。"
          />
        ) : null}

        <div className="fitness-form-actions">
          <span className="subtle-text">
            {selectedTemplate ? `当前模板：${selectedTemplate.name}` : '当前为手动录入模式'}
          </span>
          <Btn tone="primary" onClick={handleSubmit}>批量保存指标</Btn>
        </div>
      </div>
    </SectionCard>
  );
}
