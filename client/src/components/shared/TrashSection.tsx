import { useEffect, useState } from 'react';

import { Btn, DataTable, DeleteModal, Field, Pagination, SelectField } from '../ui';
import { EmptyState, SectionCard } from '../page';
import { buildApiErrorMessage } from '../../lib/api';
import type { PaginatedResponse } from '../../types/api';
import type { TableColumn } from '../../types/ui';

/** 每页条数 */
const PAGE_SIZE = 10;

/** 回收站过滤下拉选项 */
export interface TrashFilterOption {
  value: string;
  label: string;
}

/** 回收站过滤字段配置 */
export interface TrashFilter {
  /** 请求参数名，如 "priority" */
  field: string;
  /** SelectField 标签 */
  label: string;
  /** 默认值，如 "all" */
  defaultValue: string;
  /** 下拉选项 */
  options: TrashFilterOption[];
}

/** 传给 columns 渲染函数的操作回调 */
export interface TrashColumnHelpers<T> {
  /** 恢复指定行（触发后端恢复并刷新列表） */
  onRestore: (row: T) => void;
  /** 触发永久删除确认弹窗 */
  onRequestDelete: (row: T) => void;
}

/** 回收站 API 形状 */
interface TrashApi<T> {
  list: (params: Record<string, unknown>) => Promise<PaginatedResponse<T>>;
  restore: (id: string) => Promise<unknown>;
  deletePermanently: (id: string) => Promise<unknown>;
  clearTrash: () => Promise<unknown>;
}

interface TrashSectionProps<T extends { id: string; title: string }> {
  /** SectionCard 标题 */
  title: string;
  /** SectionCard 描述 */
  description: string;
  /** 实体名称（"任务"/"日程"），用于 toast 消息 */
  entityName: string;
  /** 关键词搜索框 placeholder */
  searchPlaceholder: string;
  /** 过滤栏容器的 CSS 类名 */
  filterGridClassName: string;
  /** 可选的过滤字段配置 */
  filters?: TrashFilter[];
  /**
   * 表格列定义工厂：接收操作回调，返回完整列（含操作列）。
   * 使用工厂函数以便操作列内部按钮可调用组件内部的恢复/删除逻辑。
   */
  columns: (helpers: TrashColumnHelpers<T>) => TableColumn<T>[];
  /** 回收站相关 API */
  api: TrashApi<T>;
  /** toast 提示回调 */
  showToast: (message: string, type?: 'success' | 'error') => void;
  /** 数据变更后通知父组件刷新（如主列表） */
  onChanged: () => void;
}

/**
 * 通用回收站区块：封装搜索、过滤、分页、恢复、永久删除与清空回收站的完整逻辑。
 * @param props 组件属性
 * @returns 渲染回收站 UI 的 React 元素
 */
export function TrashSection<T extends { id: string; title: string }>({
  title,
  description,
  entityName,
  searchPlaceholder,
  filterGridClassName,
  filters,
  columns,
  api,
  showToast,
  onChanged,
}: TrashSectionProps<T>) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    filters?.forEach((filter) => {
      initial[filter.field] = filter.defaultValue;
    });
    return initial;
  });

  // 将过滤值序列化为稳定字符串，作为 useEffect 依赖项
  const filterDeps = filters?.map((filter) => filterValues[filter.field]).join(',') ?? '';

  /**
   * 加载回收站列表数据。
   * @returns Promise<void>，出错时通过 toast 提示
   */
  const loadTrash = async () => {
    try {
      const result = await api.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
        ...filterValues,
        trashed: true,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '回收站加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadTrash();
  }, [page, keyword, filterDeps]);

  useEffect(() => {
    setPage(1);
  }, [keyword, filterDeps]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * 恢复一条记录：调用后端恢复接口，提示并刷新列表。
   * @param row 待恢复的记录
   * @returns Promise<void>
   */
  const handleRestore = async (row: T) => {
    try {
      await api.restore(row.id);
      showToast(`${entityName}已恢复。`);
      onChanged();
      await loadTrash();
    } catch (error) {
      showToast(buildApiErrorMessage(error, `恢复${entityName}失败。`), 'error');
    }
  };

  /**
   * 永久删除当前待确认的记录。
   * @returns Promise<void>
   */
  const handleDeletePermanently = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await api.deletePermanently(pendingDelete.id);
      setPendingDelete(null);
      showToast(`${entityName}已永久删除。`);
      onChanged();
      await loadTrash();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '永久删除失败。'), 'error');
    }
  };

  /**
   * 清空整个回收站。
   * @returns Promise<void>
   */
  const handleClearTrash = async () => {
    try {
      await api.clearTrash();
      setClearConfirmOpen(false);
      showToast('回收站已清空。');
      onChanged();
      await loadTrash();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '清空回收站失败。'), 'error');
    }
  };

  const resolvedColumns = columns({
    onRestore: (row) => { void handleRestore(row); },
    onRequestDelete: (row) => setPendingDelete(row),
  });

  return (
    <SectionCard
      title={title}
      description={description}
      action={<Btn tone="danger" onClick={() => setClearConfirmOpen(true)}>清空回收站</Btn>}
    >
      <div className="page-stack">
        <div className={filterGridClassName}>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={searchPlaceholder}
          />
          {filters?.map((filter) => (
            <SelectField
              key={filter.field}
              label={filter.label}
              value={filterValues[filter.field] ?? filter.defaultValue}
              onChange={(event) => setFilterValues((prev) => ({ ...prev, [filter.field]: event.target.value }))}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectField>
          ))}
        </div>

        {items.length ? (
          <>
            <DataTable
              data={items}
              rowKey="id"
              columns={resolvedColumns}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="回收站为空" description={`目前没有已删除${entityName}，删除后的${entityName}会先留在这里。`} />
        )}
      </div>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { void handleDeletePermanently(); }}
        title={pendingDelete ? `永久删除：${pendingDelete.title}` : `永久删除${entityName}`}
      >
        永久删除后无法恢复，请确认是否继续。
      </DeleteModal>

      <DeleteModal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => { void handleClearTrash(); }}
        title="清空回收站"
      >
        {`这会永久删除所有已进入回收站的${entityName}，操作不可恢复。`}
      </DeleteModal>
    </SectionCard>
  );
}
