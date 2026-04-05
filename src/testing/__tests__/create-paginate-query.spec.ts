import { createPaginateQuery } from '../create-paginate-query';

describe('createPaginateQuery', () => {
  it('should create a PaginateQuery with defaults', () => {
    const query = createPaginateQuery();
    expect(query.path).toBe('/');
  });

  it('should override defaults with provided values', () => {
    const query = createPaginateQuery({
      page: 2, limit: 10, sortBy: [['createdAt', 'DESC']], search: 'john', path: '/users',
    });
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.sortBy).toEqual([['createdAt', 'DESC']]);
    expect(query.search).toBe('john');
    expect(query.path).toBe('/users');
  });

  it('should include filter when provided', () => {
    const query = createPaginateQuery({ filter: { role: '$eq:admin' }, path: '/users' });
    expect(query.filter).toEqual({ role: '$eq:admin' });
  });

  it('should include cursor params when provided', () => {
    const query = createPaginateQuery({ after: 'abc123', limit: 20, path: '/items' });
    expect(query.after).toBe('abc123');
    expect(query.page).toBeUndefined();
  });
});
