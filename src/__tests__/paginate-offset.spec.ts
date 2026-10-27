import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
import { Paginated } from '../interfaces/paginated.interface';
import { InvalidSortColumnError } from '../errors/invalid-sort-column.error';
import { InvalidFilterColumnError } from '../errors/invalid-filter-column.error';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  age: number;
  createdAt: Date;
}

function createMockDelegate(data: any[] = [], count: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(count),
  };
}

const baseConfig: PaginateConfig<User> = {
  sortableColumns: ['id', 'name', 'email', 'createdAt'],
};

describe('paginate — offset mode', () => {
  it('should return paginated response with meta and links', async () => {
    const mockData = [
      { id: '1', name: 'Alice', email: 'alice@test.com' },
      { id: '2', name: 'Bob', email: 'bob@test.com' },
    ];
    const delegate = createMockDelegate(mockData, 50);
    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.data).toEqual(mockData);
    expect(result.meta.itemsPerPage).toBe(20);
    expect(result.meta.totalItems).toBe(50);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.totalPages).toBe(3);
  });

  it('should omit totals when countStrategy is none in offset mode', async () => {
    const delegate = createMockDelegate([{ id: '1' }], 50);
    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, { ...baseConfig, countStrategy: 'none' })) as any;
    expect(result.meta.totalItems).toBeUndefined();
    expect(result.meta.totalPages).toBeUndefined();
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('uses an extra row to link to the next page without counting or returning that row', async () => {
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const delegate = createMockDelegate(rows);
    const countQuery = jest.fn().mockResolvedValue(100);
    const result = await paginate(
      { page: 1, limit: 2, path: '/users' },
      delegate,
      { ...baseConfig, countStrategy: 'none', withTotalCount: true, countQuery },
    ) as Paginated<User>;

    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 3 }));
    expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
    expect(rows).toHaveLength(3);
    expect(result.meta.itemsPerPage).toBe(2);
    expect(result.meta).not.toHaveProperty('totalItems');
    expect(result.meta).not.toHaveProperty('totalPages');
    expect(result.links).toEqual({
      first: '/users?page=1&limit=2',
      previous: null,
      current: '/users?page=1&limit=2',
      next: '/users?page=2&limit=2',
      last: null,
    });
    expect(delegate.count).not.toHaveBeenCalled();
    expect(countQuery).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2])('ends count-free navigation when the query returns %i rows at limit 2', async (length) => {
    const rows = Array.from({ length }, (_, index) => ({ id: String(index + 1) }));
    const delegate = createMockDelegate(rows);
    const result = await paginate(
      { page: 3, limit: 2, path: '/users' }, delegate, { ...baseConfig, countStrategy: 'none' },
    ) as Paginated<User>;

    expect(result.data).toEqual(rows);
    expect(result.links.next).toBeNull();
    expect(result.links.last).toBeNull();
    expect(result.links.previous).toBe('/users?page=2&limit=2');
    expect(result.links.current).toBe('/users?page=3&limit=2');
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('keeps the effective limit, offset, selections and query state on count-free pages', async () => {
    const delegate = createMockDelegate([{ id: '5' }, { id: '6' }, { id: '7' }]);
    const query: PaginateQuery = {
      path: '/users', page: 3, limit: 100,
      sortBy: [['name', 'ASC'], ['id', 'DESC']],
      search: 'Alice Smith', filter: { age: ['$gte:18', '$lte:65'] }, withDeleted: true,
    };
    const result = await paginate(query, delegate, {
      ...baseConfig, countStrategy: 'none', maxLimit: 2, select: ['id'],
      relations: { profile: true }, where: { role: 'user' },
      searchableColumns: ['name'], filterableColumns: { age: ['$gte', '$lte'] }, allowWithDeleted: true,
    }) as Paginated<User>;

    const args = delegate.findMany.mock.calls[0][0];
    expect(args).toEqual(expect.objectContaining({
      skip: 4, take: 3, select: { id: true, profile: true }, withDeleted: true,
      orderBy: [{ name: 'asc' }, { id: 'desc' }],
    }));
    expect(args.where.AND).toContainEqual({ role: 'user' });
    expect(result.data).toEqual([{ id: '5' }, { id: '6' }]);
    expect(result.meta.itemsPerPage).toBe(2);
    const next = new URL(result.links.next!, 'https://example.test');
    expect(next.searchParams.get('page')).toBe('4');
    expect(next.searchParams.get('limit')).toBe('2');
    expect(next.searchParams.getAll('sortBy')).toEqual(['name:ASC', 'id:DESC']);
    expect(next.searchParams.get('search')).toBe('Alice Smith');
    expect(next.searchParams.getAll('filter.age')).toEqual(['$gte:18', '$lte:65']);
    expect(next.searchParams.get('withDeleted')).toBe('true');
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it.each(['exact', 'custom'] as const)('retains count-based links and query size for %s counts', async (countStrategy) => {
    const delegate = createMockDelegate([{ id: '1' }, { id: '2' }], 4);
    const countQuery = jest.fn().mockResolvedValue(4);
    const result = await paginate(
      { path: '/users', limit: 2 }, delegate, { ...baseConfig, countStrategy, countQuery },
    ) as Paginated<User>;

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(result.meta.totalItems).toBe(4);
    expect(result.meta.totalPages).toBe(2);
    expect(result.links.next).toBe('/users?page=2&limit=2');
    expect(result.links.last).toBe('/users?page=2&limit=2');
    if (countStrategy === 'exact') {
      expect(delegate.count).toHaveBeenCalledTimes(1);
      expect(countQuery).not.toHaveBeenCalled();
    } else {
      expect(delegate.count).not.toHaveBeenCalled();
      expect(countQuery).toHaveBeenCalledTimes(1);
    }
  });

  it('should use custom countQuery when countStrategy is custom', async () => {
    const delegate = createMockDelegate([], 50);
    const countQuery = jest.fn().mockResolvedValue(7);
    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, {
      ...baseConfig,
      countStrategy: 'custom',
      countQuery,
    })) as any;
    expect(result.meta.totalItems).toBe(7);
    expect(countQuery).toHaveBeenCalledWith(expect.objectContaining({ where: {}, delegate, query }));
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('should use default limit when not provided', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    await paginate(query, delegate, { ...baseConfig, defaultLimit: 10 });
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('should clamp limit to maxLimit', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { limit: 500, path: '/users' };
    await paginate(query, delegate, { ...baseConfig, maxLimit: 50 });
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('should apply sortBy as Prisma orderBy', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { sortBy: [['createdAt', 'DESC']], path: '/users' };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }] }),
    );
  });

  it('should apply defaultSortBy when no sortBy in query', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    await paginate(query, delegate, { ...baseConfig, defaultSortBy: [['createdAt', 'DESC']] });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }] }),
    );
  });

  it('should throw InvalidSortColumnError for disallowed column', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { sortBy: [['password', 'ASC']], path: '/users' };
    await expect(paginate(query, delegate, baseConfig)).rejects.toThrow(InvalidSortColumnError);
  });

  it('should apply filters to Prisma where', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { filter: { role: '$eq:admin' }, path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, filterableColumns: { role: ['$eq', '$in'] } };
    await paginate(query, delegate, config);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: { equals: 'admin' } }) }),
    );
  });

  it('should throw InvalidFilterColumnError for disallowed column', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { filter: { secret: '$eq:val' }, path: '/users' };
    await expect(paginate(query, delegate, { ...baseConfig, filterableColumns: {} })).rejects.toThrow(InvalidFilterColumnError);
  });

  it('should apply search as OR conditions', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { search: 'john', path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, searchableColumns: ['name', 'email'] };
    await paginate(query, delegate, config);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('should apply config.where as base condition', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, where: { isActive: true } };
    await paginate(query, delegate, config);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('should pass withDeleted to findMany and count when allowed', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users', withDeleted: true };
    await paginate(query, delegate, { ...baseConfig, allowWithDeleted: true });
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    expect(delegate.count).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
  });

  it('should ignore withDeleted when not allowed', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users', withDeleted: true };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany.mock.calls[0][0].withDeleted).toBeUndefined();
    expect(delegate.count.mock.calls[0][0].withDeleted).toBeUndefined();
  });

  it('should apply relations as include', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, relations: { profile: true, posts: { select: { id: true } } } };
    await paginate(query, delegate, config);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { profile: true, posts: { select: { id: true } } } }),
    );
  });

  it('should calculate correct skip value', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { page: 3, limit: 20, path: '/users' };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40 }));
  });

  it('should build correct links', async () => {
    const delegate = createMockDelegate([], 100);
    const query: PaginateQuery = { page: 2, limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;
    expect(result.links.first).toContain('page=1');
    expect(result.links.first).toContain('limit=20');
    expect(result.links.previous).toContain('page=1');
    expect(result.links.current).toContain('page=2');
    expect(result.links.next).toContain('page=3');
    expect(result.links.last).toContain('page=5');
  });

  it('should compose config.where and filter with AND when they share a key', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = {
      filter: { role: '$eq:user' },
      path: '/users',
    };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      where: { role: 'admin' },
      filterableColumns: { role: ['$eq'] },
    };
    await paginate(query, delegate, config);
    const calledWhere = delegate.findMany.mock.calls[0][0].where;
    expect(calledWhere.AND).toBeDefined();
    expect(calledWhere.AND).toHaveLength(2);
    expect(calledWhere.AND[0]).toEqual({ role: 'admin' });
    expect(calledWhere.AND[1]).toEqual({ role: { equals: 'user' } });
  });

  it('should return single condition directly without AND wrapper', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      where: { isActive: true },
    };
    await paginate(query, delegate, config);
    const calledWhere = delegate.findMany.mock.calls[0][0].where;
    expect(calledWhere).toEqual({ isActive: true });
    expect(calledWhere.AND).toBeUndefined();
  });

  it('should merge relations into select when both are configured', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      select: ['id', 'name'],
      relations: { profile: true },
    };
    await paginate(query, delegate, config);
    const args = delegate.findMany.mock.calls[0][0];
    expect(args.select).toEqual({ id: true, name: true, profile: true });
    expect(args.include).toBeUndefined();
  });

  it('should never set both include and select', async () => {
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      select: ['id'],
      relations: { posts: { select: { id: true, title: true } } },
    };
    await paginate(query, delegate, config);
    const args = delegate.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.include).toBeUndefined();
    expect(args.select.posts).toEqual({ select: { id: true, title: true } });
  });

  it('should run findMany and count in parallel', async () => {
    let findManyStarted = false;
    let countStartedWhileFindManyPending = false;
    const delegate = {
      findMany: jest.fn((): Promise<User[]> => {
        findManyStarted = true;
        return new Promise((resolve) => setTimeout(() => resolve([]), 10));
      }),
      count: jest.fn((): Promise<number> => {
        if (findManyStarted) countStartedWhileFindManyPending = true;
        return Promise.resolve(0);
      }),
    };
    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    await paginate(query, delegate, baseConfig);
    expect(delegate.findMany).toHaveBeenCalled();
    expect(delegate.count).toHaveBeenCalled();
    expect(countStartedWhileFindManyPending).toBe(true);
  });
});
