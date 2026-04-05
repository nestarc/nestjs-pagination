import { PaginateQuery } from '../interfaces/paginate-query.interface';

function buildQueryString(
  path: string,
  query: PaginateQuery,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();

  // Pagination params (from overrides)
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }

  // Preserve sortBy
  if (query.sortBy) {
    for (const [col, order] of query.sortBy) {
      params.append('sortBy', `${col}:${order}`);
    }
  }

  // Preserve search
  if (query.search) {
    params.set('search', query.search);
  }

  // Preserve filters
  if (query.filter) {
    for (const [col, value] of Object.entries(query.filter)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(`filter.${col}`, v);
        }
      } else {
        params.set(`filter.${col}`, value);
      }
    }
  }

  return `${path}?${params.toString()}`;
}

export function buildOffsetLinks(
  query: PaginateQuery,
  currentPage: number,
  limit: number,
  totalPages: number,
): {
  first: string;
  previous: string | null;
  current: string;
  next: string | null;
  last: string;
} {
  const base = { limit: String(limit) };
  return {
    first: buildQueryString(query.path, query, { page: '1', ...base }),
    previous: currentPage > 1
      ? buildQueryString(query.path, query, { page: String(currentPage - 1), ...base })
      : null,
    current: buildQueryString(query.path, query, { page: String(currentPage), ...base }),
    next: currentPage < totalPages
      ? buildQueryString(query.path, query, { page: String(currentPage + 1), ...base })
      : null,
    last: buildQueryString(query.path, query, { page: String(totalPages), ...base }),
  };
}

export function buildCursorLinks(
  query: PaginateQuery,
  limit: number,
  endCursor: string | null,
  startCursor: string | null,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
): {
  current: string;
  next: string | null;
  previous: string | null;
} {
  const base = { limit: String(limit) };

  // current link: reflect the original request's cursor
  let currentOverrides: Record<string, string | undefined> = { ...base };
  if (query.after) {
    currentOverrides.after = query.after;
  } else if (query.before) {
    currentOverrides.before = query.before;
  }

  return {
    current: buildQueryString(query.path, query, currentOverrides),
    next: hasNextPage && endCursor
      ? buildQueryString(query.path, query, { ...base, after: endCursor })
      : null,
    previous: hasPreviousPage && startCursor
      ? buildQueryString(query.path, query, { ...base, before: startCursor })
      : null,
  };
}
