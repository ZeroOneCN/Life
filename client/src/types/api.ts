export interface ApiSuccessResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ApiErrorShape {
  code: number;
  message: string;
  details?: unknown;
}

export interface ApiClientOptions {
  skipAuthRefresh?: boolean;
}
