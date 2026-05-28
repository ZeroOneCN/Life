export function parsePagination(query: Record<string, unknown>) {
  const rawPage = Number(query.page);
  const rawPageSize = Number(query.page_size);

  const page = Math.max(1, (Number.isFinite(rawPage) && rawPage > 0) ? Math.floor(rawPage) : 1);
  const pageSize = Math.min(200, Math.max(1, (Number.isFinite(rawPageSize) && rawPageSize > 0) ? Math.floor(rawPageSize) : 20));
  const skip = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    skip,
  };
}
