import { PaginateQuery } from './interfaces/paginate-query.interface';
import { CountStrategy, PaginateConfig } from './interfaces/paginate-config.interface';
import { Paginated, CursorPaginated } from './interfaces/paginated.interface';
import { DEFAULT_LIMIT, DEFAULT_MAX_LIMIT, DEFAULT_PAGE } from './pagination.constants';
import { parseFilters } from './filter/filter-parser';
import { validateSortColumns, buildOrderBy } from './filter/sort-builder';
import { buildSearchCondition } from './filter/search-builder';
import { buildOffsetLinks, buildCursorLinks } from './helpers/link-builder';
import {
  CursorPayload,
  decodeCursor,
  decodeKeysetCursor,
  encodeCursor,
  encodeKeysetCursor,
} from './cursor/cursor.encoder';
import {
  buildKeysetWhere,
  mergeKeysetWhere,
  resolveKeysetSortBy,
  validateKeysetConfig,
} from './cursor/keyset-cursor';

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
  applyWithDeleted(findManyArgs, query, config);

  applySelectAndRelations(findManyArgs, config);

  const countStrategy = resolveCountStrategy(config, 'offset');
  const [data, totalItems] = await Promise.all([
    delegate.findMany(findManyArgs),
    runCount(countStrategy, where, delegate, query, config),
  ]);

  const totalPages = totalItems !== undefined
    ? Math.max(Math.ceil(totalItems / limit), 1)
    : undefined;

  return {
    data,
    meta: {
      itemsPerPage: limit,
      currentPage: page,
      ...(totalItems !== undefined && { totalItems }),
      ...(totalPages !== undefined && { totalPages }),
      sortBy: sortBy ?? [],
      ...(query.search && { search: query.search }),
      ...(query.filter && { filter: flattenFilter(query.filter) }),
    },
    links: buildOffsetLinks(query, page, limit, totalPages ?? page),
  };
}

async function paginateCursor<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<CursorPaginated<T>> {
  const limit = resolveLimit(query.limit, config);
  const cursorColumn = (config.cursorColumn ?? 'id') as string;
  const isKeyset = config.cursorStrategy === 'keyset';
  const cursorColumns = isKeyset
    ? validateKeysetConfig(config.cursorColumns, config.sortableColumns)
    : [];

  let sortBy = query.sortBy ?? config.defaultSortBy;
  if (isKeyset) {
    sortBy = resolveKeysetSortBy(sortBy, cursorColumns);
  }
  if (sortBy) {
    validateSortColumns(sortBy, config.sortableColumns);
  }

  const orderBy = buildOrderBy(sortBy, config.nullSort);
  let where = buildWhere(query, config);

  const findManyArgs: any = {
    where,
    orderBy,
    take: limit + 1,
  };
  applyWithDeleted(findManyArgs, query, config);

  if (isKeyset && query.after) {
    const cursorValue = decodeKeyset(query.after, config);
    const keysetWhere = buildKeysetWhere(cursorValue, sortBy ?? [], 'after');
    where = mergeKeysetWhere(where, keysetWhere);
    findManyArgs.where = where;
  } else if (isKeyset && query.before) {
    const cursorValue = decodeKeyset(query.before, config);
    const keysetWhere = buildKeysetWhere(cursorValue, sortBy ?? [], 'before');
    where = mergeKeysetWhere(where, keysetWhere);
    findManyArgs.where = where;
  } else if (query.after) {
    const cursorValue = decodeCursor(query.after);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
  } else if (query.before) {
    const cursorValue = decodeCursor(query.before);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
    findManyArgs.take = -(limit + 1);
  }

  applySelectAndRelations(findManyArgs, config);

  let data = await delegate.findMany(findManyArgs);

  let hasPreviousPage: boolean;
  let hasNextPage: boolean;

  if (query.before) {
    if (isKeyset) {
      hasNextPage = true;
      hasPreviousPage = data.length > limit;
      if (hasPreviousPage) {
        data.pop();
      }
    } else {
    // Navigating backward — we fetched limit+1 items backward
      hasNextPage = true; // We came from a forward page, so there's always a next
      hasPreviousPage = data.length > limit;
      if (hasPreviousPage) {
        data = data.slice(data.length - limit);
      }
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

  const startCursor = data.length > 0
    ? encodeCursorForStrategy(data[0] as any, cursorColumn, cursorColumns, sortBy ?? [], config)
    : null;
  const endCursor = data.length > 0
    ? encodeCursorForStrategy(data[data.length - 1] as any, cursorColumn, cursorColumns, sortBy ?? [], config)
    : null;

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

  const countStrategy = resolveCountStrategy(config, 'cursor');
  const totalItems = await runCount(countStrategy, where, delegate, query, config);
  if (totalItems !== undefined) {
    meta.totalItems = totalItems;
  }

  return {
    data,
    meta,
    links: buildCursorLinks(query, limit, endCursor, startCursor, hasNextPage, hasPreviousPage),
  };
}

function buildWhere<T>(
  query: PaginateQuery,
  config: PaginateConfig<T>,
): Record<string, any> {
  const conditions: Record<string, any>[] = [];

  if (config.where && Object.keys(config.where).length > 0) {
    conditions.push(config.where as Record<string, any>);
  }

  if (query.filter && config.filterableColumns) {
    const filterWhere = parseFilters(query.filter, config.filterableColumns as Record<string, any>);
    if (Object.keys(filterWhere).length > 0) {
      conditions.push(filterWhere);
    }
  }

  if (query.search && config.searchableColumns) {
    const searchWhere = buildSearchCondition(query.search, config.searchableColumns);
    if (Object.keys(searchWhere).length > 0) {
      conditions.push(searchWhere);
    }
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

function applySelectAndRelations<T>(
  findManyArgs: any,
  config: PaginateConfig<T>,
): void {
  if (config.select) {
    // Build select object from column list
    const selectObj: Record<string, any> = Object.fromEntries(
      config.select.map((col) => [col, true]),
    );
    // Merge relations into select if both are present
    if (config.relations) {
      for (const [key, value] of Object.entries(config.relations)) {
        selectObj[key] = value;
      }
    }
    findManyArgs.select = selectObj;
  } else if (config.relations) {
    findManyArgs.include = config.relations;
  }
}

function applyWithDeleted<T>(
  args: any,
  query: PaginateQuery,
  config: PaginateConfig<T>,
): void {
  if (query.withDeleted === true && config.allowWithDeleted === true) {
    args.withDeleted = true;
  }
}

function decodeKeyset<T>(cursor: string, config: PaginateConfig<T>): CursorPayload {
  return config.decodeCursor ? config.decodeCursor(cursor) : decodeKeysetCursor(cursor);
}

function encodeCursorForStrategy<T>(
  record: Record<string, any>,
  cursorColumn: string,
  cursorColumns: string[],
  sortBy: [string, any][],
  config: PaginateConfig<T>,
): string {
  if (config.cursorStrategy !== 'keyset') {
    return encodeCursor(record, cursorColumn);
  }

  const payload: CursorPayload = {
    v: 2,
    values: Object.fromEntries(
      cursorColumns.map((column) => [column, record[column] ?? null]),
    ),
    sortBy,
  };

  return config.encodeCursor ? config.encodeCursor(payload) : encodeKeysetCursor(payload);
}

function resolveCountStrategy<T>(
  config: PaginateConfig<T>,
  mode: 'offset' | 'cursor',
): CountStrategy {
  if (config.countStrategy) return config.countStrategy;
  if (config.withTotalCount === true) return 'exact';
  return mode === 'offset' ? 'exact' : 'none';
}

async function runCount<T>(
  strategy: CountStrategy,
  where: Record<string, any>,
  delegate: { count: (args: any) => Promise<number> },
  query: PaginateQuery,
  config: PaginateConfig<T>,
): Promise<number | undefined> {
  if (strategy === 'none') {
    return undefined;
  }

  if (strategy === 'custom') {
    if (!config.countQuery) {
      throw new Error('countQuery is required when countStrategy is custom');
    }
    return config.countQuery({ where, delegate, query, config });
  }

  const countArgs = { where };
  applyWithDeleted(countArgs, query, config);
  return delegate.count(countArgs);
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
