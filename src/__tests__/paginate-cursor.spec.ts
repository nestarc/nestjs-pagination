import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';

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

  it('should use custom cursorColumn', async () => {
    const mockData = [{ id: '1', createdAt: new Date('2024-01-01') }];
    const delegate = createMockDelegate(mockData, 1);
    const query: PaginateQuery = { limit: 20, path: '/users' };
    const config: PaginateConfig<User> = { ...baseConfig, cursorColumn: 'createdAt' };
    const result = (await paginate(query, delegate, config)) as any;
    const decoded = JSON.parse(Buffer.from(result.meta.startCursor, 'base64url').toString());
    expect(decoded).toHaveProperty('createdAt');
  });
});
