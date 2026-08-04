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
