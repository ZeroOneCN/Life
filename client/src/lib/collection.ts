import { buildApiErrorMessage } from './api';

/**
 * 在集合中找出新增的项（next 中存在但 previous 中不存在的）
 * @param previous - 之前的集合
 * @param next - 之后的集合
 * @returns 新增的项数组
 */
export function findCreated<T extends { id: string }>(previous: T[], next: T[]): T[] {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

/**
 * 在集合中找出被删除的 ID（previous 中存在但 next 中不存在的）
 * @param previous - 之前的集合
 * @param next - 之后的集合
 * @returns 被删除的 ID 数组
 */
export function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]): string[] {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

/**
 * 在集合中找出被更新的项（previous 和 next 中都存在但内容不同的）
 * @param previous - 之前的集合
 * @param next - 之后的集合
 * @returns 被更新的项数组
 */
export function findUpdated<T extends { id: string }>(previous: T[], next: T[]): T[] {
  return next.filter((item) =>
    previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)),
  );
}

/** showToast 函数类型（与 components/ui.tsx 的 useToastState 返回值一致） */
type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  options?: { detail?: string; duration?: number },
) => void;

/** createSyncCollection 依赖项 */
export interface SyncCollectionDeps {
  /** 重新加载数据的函数 */
  reload: () => Promise<void>;
  /** 显示 toast 提示的函数 */
  showToast: ShowToast;
}

/**
 * 创建绑定了 reload 和 showToast 依赖的 syncCollection 函数。
 *
 * 用于在 CRUD 批量同步场景中，根据 previous/next diff 自动执行
 * create/update/delete，并在完成后 reload、失败时 toast 提示。
 *
 * @param deps - 依赖项：reload 函数和 showToast 函数
 * @returns syncCollection 函数
 */
export function createSyncCollection(deps: SyncCollectionDeps) {
  const { reload, showToast } = deps;
  return async function syncCollection<T extends { id: string }>(
    previous: T[],
    next: T[],
    createItem: (item: T) => Promise<unknown>,
    updateItem: (item: T) => Promise<unknown>,
    deleteItem: (id: string) => Promise<unknown>,
    errorMessage: string,
  ): Promise<void> {
    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = findUpdated(previous, next);

      await Promise.all([
        ...created.map((item) => createItem(item)),
        ...updated.map((item) => updateItem(item)),
        ...deletedIds.map((id) => deleteItem(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, errorMessage), 'error');
      await reload();
    }
  };
}
