export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size ?? 20) || 20));
  const skip = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    skip,
  };
}
