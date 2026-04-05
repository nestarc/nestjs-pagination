import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
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
