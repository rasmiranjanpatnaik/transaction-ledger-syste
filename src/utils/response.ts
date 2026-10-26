import { ApiResponse, PaginatedApiResponse } from '../types/common.js';

export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

export function paginatedResponse<T>(
  data: T[],
  currentPage: number,
  pageSize: number,
  totalRecords: number
): PaginatedApiResponse<T> {
  const totalPages = Math.ceil(totalRecords / pageSize) || 0;
  return {
    success: true,
    data,
    pagination: {
      current_page: currentPage,
      page_size: pageSize,
      total_records: totalRecords,
      total_pages: totalPages,
    },
  };
}
