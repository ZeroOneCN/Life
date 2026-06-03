export interface ApiSuccessResponse<T> {
  code: 0;
  message: string;
  data: T;
}

export interface ApiListData<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(data: T, message = 'ok'): ApiSuccessResponse<T> {
  return {
    code: 0,
    message,
    data,
  };
}

export function buildListData<T>(
  items: T[],
  page = 1,
  pageSize = items.length || 10,
  total = items.length,
): ApiListData<T> {
  return {
    items,
    page,
    page_size: pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
