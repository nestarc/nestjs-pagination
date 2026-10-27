import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
import { CursorPaginated } from '../interfaces/paginated.interface';
import { InvalidCursorError } from '../errors/invalid-cursor.error';
import { decodeKeysetCursor, encodeKeysetCursor } from '../cursor/cursor.encoder';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function createMockDelegate(data: any[] = [], count: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(count),
  };
}

const baseConfig: PaginateConfig<User> = {
  sortableColumns: ['id', 'name', 'createdAt'],
  paginationType: 'cursor',
};

function encodeCursorValue(obj: Record<string, any>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

describe('paginate — cursor mode', () => {
  it.each(['prisma', 'keyset'] as const)('rejects simultaneous after and before in %s mode', async (cursorStrategy) => {
    const delegate = createMockDelegate();
    await expect(paginate(
      { path: '/users', after: 'forward', before: 'backward' },
      delegate,
      { ...baseConfig, cursorStrategy, cursorColumns: ['id'] },
    )).rejects.toThrow(InvalidCursorError);
    expect(delegate.findMany).not.toHaveBeenCalled();
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('should return cursor-paginated response', async () => {
    const mockData = Array.from({ length: 21 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    const delegate = createMockDelegate(mockData, 50);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = await paginate(query, delegate, baseConfig);
    expect('hasNextPage' in result.meta).toBe(true);
    const cursorResult = result as any;
    expect(cursorResult.meta.hasNextPage).toBe(true);
    expect(cursorResult.data).toHaveLength(20);
  });

  it('should detect no next page when data.length <= limit', async () => {
    const mockData = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    const delegate = createMockDelegate(mockData, 5);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.data).toHaveLength(5);
  });

  it('should use after cursor', async () => {
    const mockData = [{ id: '11', name: 'User 11' }];
    const delegate = createMockDelegate(mockData, 50);
    const afterCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = { limit: 20, after: afterCursor, path: '/users' };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: '10' }, skip: 1 }));
  });

  it('should use before cursor with negative take', async () => {
    const mockData = [{ id: '5', name: 'User 5' }];
    const delegate = createMockDelegate(mockData, 50);
    const beforeCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = { limit: 20, before: beforeCursor, path: '/users' };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: '10' }, skip: 1, take: -21 }));
  });

  it('should generate startCursor and endCursor', async () => {
    const mockData = [{ id: '10', name: 'User 10' }, { id: '11', name: 'User 11' }];
    const delegate = createMockDelegate(mockData, 50);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.startCursor).toBe(encodeCursorValue({ id: '10' }));
    expect(result.meta.endCursor).toBe(encodeCursorValue({ id: '11' }));
  });

  it('should return null cursors for empty data', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.startCursor).toBeNull();
    expect(result.meta.endCursor).toBeNull();
  });

  it('should not include totalItems by default', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.totalItems).toBeUndefined();
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('should include totalItems when withTotalCount is true', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, { ...baseConfig, withTotalCount: true })) as any;
    expect(result.meta.totalItems).toBe(0);
    expect(delegate.count).toHaveBeenCalled();
  });

  it('should include totalItems when countStrategy is exact in cursor mode', async () => {
    const delegate = createMockDelegate([], 12);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, { ...baseConfig, countStrategy: 'exact' })) as any;
    expect(result.meta.totalItems).toBe(12);
    expect(delegate.count).toHaveBeenCalled();
  });

  it('should auto-detect cursor mode from after param', async () => {
    const delegate = createMockDelegate([{ id: '1' }], 1);
    const afterCursor = encodeCursorValue({ id: '0' });
    const query: PaginateQuery = { limit: 20, after: afterCursor, path: '/users' };
    const config: PaginateConfig<User> = { sortableColumns: ['id'] };
    const result = await paginate(query, delegate, config);
    expect('hasNextPage' in result.meta).toBe(true);
  });

  it('hasPreviousPage should be false on first page (no cursor)', async () => {
    const mockData = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    const delegate = createMockDelegate(mockData, 5);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('hasPreviousPage should be true when navigating forward with after cursor', async () => {
    const mockData = [{ id: '11', name: 'User 11' }];
    const delegate = createMockDelegate(mockData, 50);
    const afterCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = { limit: 20, after: afterCursor, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('hasPreviousPage should be true for before cursor when more items exist', async () => {
    // Fetch limit+1 items backward to indicate there's a previous page
    const mockData = Array.from({ length: 22 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    const delegate = createMockDelegate(mockData, 50);
    const beforeCursor = encodeCursorValue({ id: '23' });
    const query: PaginateQuery = { limit: 21, before: beforeCursor, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it('should validate sortBy columns in cursor mode', async () => {
    const mockData = [{ id: '1', name: 'User 1' }];
    const delegate = createMockDelegate(mockData, 1);
    const query: PaginateQuery = {
      limit: 20,
      path: '/users',
      sortBy: [['name', 'ASC']],
    };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.data).toEqual(mockData);
  });

  it('should handle before cursor when data does not exceed limit', async () => {
    // Return exactly limit items (no extra) → hasPreviousPage = false
    const mockData = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      name: `User ${i + 1}`,
    }));
    const delegate = createMockDelegate(mockData, 50);
    const beforeCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = { limit: 20, before: beforeCursor, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('should use custom cursorColumn', async () => {
    const mockData = [{ id: '1', createdAt: new Date('2024-01-01') }];
    const delegate = createMockDelegate(mockData, 1);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, cursorColumn: 'createdAt' };
    const result = (await paginate(query, delegate, config)) as any;
    const decoded = JSON.parse(Buffer.from(result.meta.startCursor, 'base64url').toString());
    expect(decoded).toHaveProperty('createdAt');
  });

  it('should build keyset where for after cursor with duplicate sort values', async () => {
    const data = [
      { id: '9', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: '8', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    const delegate = createMockDelegate(data, 2);
    const sortBy: [string, 'DESC'][] = [['createdAt', 'DESC'], ['id', 'DESC']];
    const after = encodeKeysetCursor({
      v: 2,
      values: { createdAt: '2024-01-01T00:00:00.000Z', id: '10' },
      sortBy,
    });
    await paginate(
      { limit: 20, after, path: '/users', sortBy },
      delegate,
      { ...baseConfig, cursorStrategy: 'keyset', cursorColumns: ['createdAt', 'id'] },
    );
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { createdAt: { lt: '2024-01-01T00:00:00.000Z' } },
          { AND: [{ createdAt: { equals: '2024-01-01T00:00:00.000Z' } }, { id: { lt: '10' } }] },
        ],
      },
    }));
  });

  it('should generate keyset cursors from configured cursor columns', async () => {
    const delegate = createMockDelegate([
      { id: '10', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: '9', createdAt: '2024-01-01T00:00:00.000Z' },
    ], 2);
    const sortBy: [string, 'DESC'][] = [['createdAt', 'DESC'], ['id', 'DESC']];
    const result = (await paginate(
      { limit: 20, path: '/users', sortBy },
      delegate,
      { ...baseConfig, cursorStrategy: 'keyset', cursorColumns: ['createdAt', 'id'] },
    )) as any;
    expect(decodeKeysetCursor(result.meta.startCursor)).toEqual({
      v: 2,
      values: { createdAt: '2024-01-01T00:00:00.000Z', id: '10' },
      sortBy,
    });
    expect(decodeKeysetCursor(result.meta.endCursor)).toEqual({
      v: 2,
      values: { createdAt: '2024-01-01T00:00:00.000Z', id: '9' },
      sortBy,
    });
  });

  it('should append missing keyset tie-breaker columns to orderBy', async () => {
    const delegate = createMockDelegate([
      { id: '10', createdAt: '2024-01-01T00:00:00.000Z' },
    ], 1);
    await paginate(
      { limit: 20, path: '/users' },
      delegate,
      {
        ...baseConfig,
        cursorStrategy: 'keyset',
        cursorColumns: ['createdAt', 'id'],
        defaultSortBy: [['createdAt', 'DESC']],
      },
    );
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
  });

  it('should preserve requested order when keyset before cursor has an extra row', async () => {
    // DESC navigation queries the nearest predecessors in ascending order.
    const data = [
      { id: '10', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: '11', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: '12', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    const delegate = createMockDelegate(data, 3);
    const sortBy: [string, 'DESC'][] = [['createdAt', 'DESC'], ['id', 'DESC']];
    const before = encodeKeysetCursor({
      v: 2,
      values: { createdAt: '2024-01-01T00:00:00.000Z', id: '9' },
      sortBy,
    });
    const result = (await paginate(
      { limit: 2, before, path: '/users', sortBy },
      delegate,
      { ...baseConfig, cursorStrategy: 'keyset', cursorColumns: ['createdAt', 'id'] },
    )) as any;
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 3,
    }));
    expect(result.data.map((row: User) => row.id)).toEqual(['11', '10']);
    expect(result.meta.sortBy).toEqual(sortBy);
    expect(decodeKeysetCursor(result.meta.startCursor).values.id).toBe('11');
    expect(decodeKeysetCursor(result.meta.endCursor).values.id).toBe('10');
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.hasNextPage).toBe(true);
  });
});

describe('keyset cursor regressions', () => {
  const config: PaginateConfig<User> = {
    ...baseConfig,
    cursorStrategy: 'keyset',
    cursorColumns: ['id'],
    defaultSortBy: [['id', 'ASC']],
  };
  const after = encodeKeysetCursor({
    v: 2,
    values: { id: '4' },
    sortBy: [['id', 'ASC']],
  });

  it('restores ascending output for a backward page without a lookahead row', async () => {
    const delegate = createMockDelegate([{ id: '3' }, { id: '2' }, { id: '1' }]);
    const result = await paginate({ path: '/users', limit: 3, before: after }, delegate, config) as CursorPaginated<User>;

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ id: 'desc' }],
      where: { OR: [{ id: { lt: '4' } }] },
    }));
    expect(result.data.map((row) => row.id)).toEqual(['1', '2', '3']);
    expect(result.meta.hasPreviousPage).toBe(false);
    expect(decodeKeysetCursor(result.meta.startCursor!).sortBy).toEqual([['id', 'ASC']]);
  });

  it.each(['after', 'before'] as const)('counts the full filtered list with a %s boundary', async (direction) => {
    const delegate = createMockDelegate([], 10);
    const result = await paginate(
      { path: '/users', [direction]: after, filter: { name: '$eq:Alice' }, search: 'example' },
      delegate,
      {
        ...config,
        where: { email: { endsWith: 'example.com' } },
        filterableColumns: { name: ['$eq'] },
        searchableColumns: ['email'],
        countStrategy: 'exact',
      },
    ) as CursorPaginated<User>;

    const baseWhere = {
      AND: [
        { email: { endsWith: 'example.com' } },
        { name: { equals: 'Alice' } },
        { OR: [{ email: { contains: 'example', mode: 'insensitive' } }] },
      ],
    };
    expect(delegate.count).toHaveBeenCalledWith({ where: baseWhere });
    expect(delegate.findMany.mock.calls[0][0].where.AND[0]).toEqual(baseWhere);
    expect(result.meta.totalItems).toBe(10);
  });

  it('passes only base conditions to custom count callbacks', async () => {
    const delegate = createMockDelegate([{ id: '5' }]);
    const countQuery = jest.fn().mockResolvedValue(10);
    const result = await paginate(
      { path: '/users', after },
      delegate,
      { ...config, where: { name: 'Alice' }, countStrategy: 'custom', countQuery },
    );

    expect(countQuery).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'Alice' } }));
    expect(result.meta.totalItems).toBe(10);
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('includes every effective sort field in a reusable cursor', async () => {
    const delegate = createMockDelegate([{ id: '1', name: 'Alice' }]);
    const query: PaginateQuery = { path: '/users', sortBy: [['name', 'ASC']] };
    const first = await paginate(query, delegate, config) as CursorPaginated<User>;

    expect(decodeKeysetCursor(first.meta.endCursor!)).toEqual({
      v: 2,
      values: { name: 'Alice', id: '1' },
      sortBy: [['name', 'ASC'], ['id', 'ASC']],
    });
    delegate.findMany.mockResolvedValueOnce([{ id: '2', name: 'Bob' }]);
    const next = await paginate({ ...query, after: first.meta.endCursor! }, delegate, config);
    expect(next.data).toEqual([{ id: '2', name: 'Bob' }]);
  });

  it('fetches excluded sort fields for cursors without adding them to the response data', async () => {
    const row = { id: '1', name: 'Alice', email: 'alice@example.com' };
    const delegate = createMockDelegate([row]);
    const result = await paginate(
      { path: '/users', sortBy: [['name', 'ASC']] },
      delegate,
      { ...config, select: ['email'] },
    ) as CursorPaginated<User>;

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { email: true, name: true, id: true },
    }));
    expect(result.data).toEqual([{ email: 'alice@example.com' }]);
    expect(decodeKeysetCursor(result.meta.endCursor!).values).toEqual({ name: 'Alice', id: '1' });
    expect(row).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com' });
  });

  it('also preserves selections when fetching the Prisma cursor column internally', async () => {
    const delegate = createMockDelegate([{ id: '1', name: 'Alice' }]);
    const result = await paginate(
      { path: '/users' }, delegate, { ...baseConfig, select: ['name'] },
    ) as CursorPaginated<User>;
    expect(delegate.findMany.mock.calls[0][0].select).toEqual({ name: true, id: true });
    expect(result.data).toEqual([{ name: 'Alice' }]);
    expect(result.meta.endCursor).toBe(encodeCursorValue({ id: '1' }));
  });
});
