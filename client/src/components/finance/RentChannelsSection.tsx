import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal } from '../ui';
import {
  createRentChannel,
  deleteRentChannel,
  filterRentChannels,
  updateRentChannel,
} from '../../services/rent';
import type { RentChannel, RentChannelDraft, RentHousingRecord } from '../../types/rent';

interface RentChannelsSectionProps {
  records: RentHousingRecord[];
  channels: RentChannel[];
  onChangeChannels: (updater: (channels: RentChannel[]) => RentChannel[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface ChannelFormState {
  name: string;
}

function createDefaultFormState(): ChannelFormState {
  return {
    name: '',
  };
}

function buildFormState(channel: RentChannel): ChannelFormState {
  return {
    name: channel.name,
  };
}

function parseDraft(form: ChannelFormState): RentChannelDraft | null {
  const name = form.name.trim();

  if (!name) {
    return null;
  }

  return { name };
}

export function RentChannelsSection({
  records,
  channels,
  onChangeChannels,
  showToast,
}: RentChannelsSectionProps) {
  const [form, setForm] = useState<ChannelFormState>(() => createDefaultFormState());
  const [editingChannel, setEditingChannel] = useState<RentChannel | null>(null);
  const [editingForm, setEditingForm] = useState<ChannelFormState>(() => createDefaultFormState());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const scopedChannels = useMemo(
    () => filterRentChannels(channels),
    [channels],
  );

  const usageMap = useMemo(() => records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.channelId] = (accumulator[record.channelId] ?? 0) + 1;
    return accumulator;
  }, {}), [records]);

  const columns = useMemo(() => [
    { key: 'name', title: '渠道名称', dataIndex: 'name' as const },
    {
      key: 'usage',
      title: '引用记录',
      render: (_value: unknown, row: RentChannel) => `${usageMap[row.id] ?? 0} 条`,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      render: (_value: unknown, row: RentChannel) => dayjs(row.updatedAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: RentChannel) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingChannel(row);
              setEditingForm(buildFormState(row));
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], [usageMap]);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全渠道名称。', 'error');
      return;
    }

    const duplicate = channels.some((channel) => channel.name === draft.name);
    if (duplicate) {
      showToast('已经存在同名渠道。', 'error');
      return;
    }

    onChangeChannels((previous) => createRentChannel(previous, draft));
    setForm(createDefaultFormState());
    showToast('渠道已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingChannel) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全渠道编辑信息。', 'error');
      return;
    }

    const duplicate = channels.some((channel) => (
      channel.id !== editingChannel.id
      && channel.name === draft.name
    ));
    if (duplicate) {
      showToast('已经存在同名渠道。', 'error');
      return;
    }

    onChangeChannels((previous) => updateRentChannel(previous, editingChannel.id, draft));
    setEditingChannel(null);
    setEditingForm(createDefaultFormState());
    showToast('渠道已更新。');
  };

  return (
    <SectionCard
      title="渠道管理"
      description="维护当前用户可选的租房渠道。删除渠道只影响后续录入选项，历史住房记录会继续保留渠道名称快照。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前新增渠道默认归属当前登录用户。
          历史住房记录里已经保存了 `channelId + channelName` 快照，所以删除渠道不会改写旧记录。
        </div>

        <form className="rent-channel-form-grid" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <Field
            label="渠道名称"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="例如：链家、房东直租、自如"
          />
          <div className="rent-inline-action">
            <span className="field-label">新增渠道</span>
            <Btn tone="primary" type="submit">保存渠道</Btn>
          </div>
        </form>

        {scopedChannels.length ? (
          <DataTable rowKey="id" columns={columns} data={scopedChannels} />
        ) : (
          <EmptyState title="暂无渠道" description="先创建当前用户的租房渠道，录入页才能复用。" />
        )}
      </div>

      <Modal
        open={Boolean(editingChannel)}
        onClose={() => {
          setEditingChannel(null);
          setEditingForm(createDefaultFormState());
        }}
        title={editingChannel ? `编辑渠道 · ${editingChannel.name}` : '编辑渠道'}
        width={560}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingChannel(null);
                setEditingForm(createDefaultFormState());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存渠道</Btn>
          </>
        )}
      >
        <div className="rent-channel-form-grid rent-channel-form-grid-modal">
          <Field
            label="渠道名称"
            value={editingForm.name}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeChannels((previous) => deleteRentChannel(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('渠道已删除，历史记录快照保持不变。');
        }}
        title="删除渠道"
      >
        即使渠道正在被历史住房记录引用，也只会删除渠道本体，不会改写旧记录中的渠道名称快照。
      </DeleteModal>
    </SectionCard>
  );
}
