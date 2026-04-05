import { PaginateQuery } from './interfaces/paginate-query.interface';
import { PaginateConfig } from './interfaces/paginate-config.interface';
import { Paginated, CursorPaginated } from './interfaces/paginated.interface';
import { DEFAULT_LIMIT, DEFAULT_MAX_LIMIT, DEFAULT_PAGE } from './pagination.constants';
import { parseFilters } from './filter/filter-parser';
import { validateSortColumns, buildOrderBy } from './filter/sort-builder';
import { buildSearchCondition } from './filter/search-builder';
import { buildOffsetLinks, buildCursorLinks } from './helpers/link-builder';
import { encodeCursor, decodeCursor } from './cursor/cursor.encoder';

export async function paginate<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<Paginated<T> | CursorPaginated<T>> {
  const isCursorMode =
    config.paginationType === 'cursor' ||
    query.after !== undefined ||
    query.before !== undefined;

  if (isCursorMode) {
    return paginateCursor(query, delegate, config);
  }

  return paginateOffset(query, delegate, config);
}

async function paginateOffset<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<Paginated<T>> {
  const limit = resolveLimit(query.limit, config);
  const page = query.page ?? DEFAULT_PAGE;

  const sortBy = query.sortBy ?? config.defaultSortBy;
  if (sortBy) {
    validateSortColumns(sortBy, config.sortableColumns);
  }

  const orderBy = buildOrderBy(sortBy, config.nullSort);
  const where = buildWhere(query, config);

  const findManyArgs: any = {
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  };

  if (config.relations) {
    findManyArgs.include = config.relations;
  }

  if (config.select) {
    findManyArgs.select = Object.fromEntries(
      config.select.map((col) => [col, true]),
    );
  }

  const [data, totalItems] = await Promise.all([
    delegate.findMany(findManyArgs),
    delegate.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

  return {
    data,
    meta: {
      itemsPerPage: limit,
      totalItems,
      currentPage: page,
      totalPages,
      sortBy: sortBy ?? [],
      ...(query.search && { search: query.search }),
      ...(query.filter && { filter: flattenFilter(query.filter) }),
    },
    links: buildOffsetLinks(query.path, page, limit, totalPages),
  };
}

async function paginateCursor<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<CursorPaginated<T>> {
  const limit = resolveLimit(query.limit, config);
  const cursorColumn = (config.cursorColumn ?? 'id') as string;

  const sortBy = query.sortBy ?? config.defaultSortBy;
  if (sortBy) {
    validateSortColumns(sortBy, config.sortableColumns);
  }

  const orderBy = buildOrderBy(sortBy, config.nullSort);
  const where = buildWhere(query, config);

  const findManyArgs: any = {
    where,
    orderBy,
    take: limit + 1,
  };

  if (query.after) {
    const cursorValue = decodeCursor(query.after);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
  } else if (query.before) {
    const cursorValue = decodeCursor(query.before);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
    findManyArgs.take = -(limit + 1);
  }

  if (config.relations) {
    findManyArgs.include = config.relations;
  }

  if (config.select) {
    findManyArgs.select = Object.fromEntries(
      config.select.map((col) => [col, true]),
    );
  }

  let data = await delegate.findMany(findManyArgs);

  let hasPreviousPage: boolean;
  let hasNextPage: boolean;

  if (query.before) {
    // Navigating backward — we fetched limit+1 items backward
    hasNextPage = true; // We came from a forward page, so there's always a next
    hasPreviousPage = data.length > limit;
    if (hasPreviousPage) {
      data = data.slice(data.length - limit);
    }
  } else if (query.after) {
    // Navigating forward from a cursor — there's always a previous
    hasPreviousPage = true;
    hasNextPage = data.length > limit;
    if (hasNextPage) {
      data.pop();
    }
  } else {
    // First page (no cursor) — no previous
    hasPreviousPage = false;
    hasNextPage = data.length > limit;
    if (hasNextPage) {
      data.pop();
    }
  }

  const startCursor = data.length > 0 ? encodeCursor(data[0] as any, cursorColumn) : null;
  const endCursor = data.length > 0 ? encodeCursor(data[data.length - 1] as any, cursorColumn) : null;

  const meta: CursorPaginated<T>['meta'] = {
    itemsPerPage: limit,
    hasNextPage,
    hasPreviousPage,
    startCursor,
    endCursor,
    sortBy: sortBy ?? [],
    ...(query.search && { search: query.search }),
    ...(query.filter && { filter: flattenFilter(query.filter) }),
  };

  if (config.withTotalCount) {
    meta.totalItems = await delegate.count({ where });
  }

  return {
    data,
    meta,
    links: buildCursorLinks(query.path, limit, endCursor, startCursor, hasNextPage, hasPreviousPage, query.after ?? query.before ?? null),
  };
}

function buildWhere<T>(
  query: PaginateQuery,
  config: PaginateConfig<T>,
): Record<string, any> {
  const where: Record<string, any> = { ...((config.where as any) ?? {}) };

  if (query.filter && config.filterableColumns) {
    const filterWhere = parseFilters(query.filter, config.filterableColumns as Record<string, any>);
    Object.assign(where, filterWhere);
  }

  if (query.search && config.searchableColumns) {
    const searchWhere = buildSearchCondition(query.search, config.searchableColumns);
    Object.assign(where, searchWhere);
  }

  return where;
}

function resolveLimit<T>(
  queryLimit: number | undefined,
  config: PaginateConfig<T>,
): number {
  const defaultLimit = config.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = config.maxLimit ?? DEFAULT_MAX_LIMIT;
  const limit = queryLimit ?? defaultLimit;
  return Math.min(Math.max(limit, 1), maxLimit);
}

function flattenFilter(
  filter: Record<string, string | string[]>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    flat[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return flat;
}
