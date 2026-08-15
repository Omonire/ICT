import type { Request } from 'express';

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(req: Request, defaultLimit = 25): PaginationQuery {
  const rawPage = Number(req.query.page ?? 1);
  const rawLimit = Number(req.query.limit ?? defaultLimit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

export function paginate<T>(
  rows: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  };
}

export function queryString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
}
