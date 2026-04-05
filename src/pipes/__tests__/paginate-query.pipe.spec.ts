import { parsePaginateQuery } from '../paginate-query.pipe';

function mockRequest(query: Record<string, any>, path = '/users'): any {
  return { query, path, url: path };
}

describe('parsePaginateQuery', () => {
  it('should parse basic offset query', () => {
    const req = mockRequest({ page: '2', limit: '20' });
    const result = parsePaginateQuery(req);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.path).toBe('/users');
  });

  it('should parse sortBy as single value', () => {
    const req = mockRequest({ sortBy: 'createdAt:DESC' });
    const result = parsePaginateQuery(req);
    expect(result.sortBy).toEqual([['createdAt', 'DESC']]);
  });

  it('should parse sortBy as array', () => {
    const req = mockRequest({ sortBy: ['name:ASC', 'createdAt:DESC'] });
    const result = parsePaginateQuery(req);
    expect(result.sortBy).toEqual([['name', 'ASC'], ['createdAt', 'DESC']]);
  });

  it('should parse search', () => {
    const req = mockRequest({ search: 'john' });
    const result = parsePaginateQuery(req);
    expect(result.search).toBe('john');
  });

  it('should parse filter prefixed params', () => {
    const req = mockRequest({ 'filter.role': '$eq:admin', 'filter.age': '$gte:18' });
    const result = parsePaginateQuery(req);
    expect(result.filter).toEqual({ role: '$eq:admin', age: '$gte:18' });
  });

  it('should parse cursor params', () => {
    const req = mockRequest({ after: 'abc123', limit: '10' });
    const result = parsePaginateQuery(req);
    expect(result.after).toBe('abc123');
    expect(result.limit).toBe(10);
  });

  it('should parse before cursor', () => {
    const req = mockRequest({ before: 'xyz789' });
    const result = parsePaginateQuery(req);
    expect(result.before).toBe('xyz789');
  });

  it('should clamp page to minimum 1', () => {
    const req = mockRequest({ page: '0' });
    const result = parsePaginateQuery(req);
    expect(result.page).toBe(1);
  });

  it('should clamp limit to minimum 1', () => {
    const req = mockRequest({ limit: '-5' });
    const result = parsePaginateQuery(req);
    expect(result.limit).toBe(1);
  });

  it('should handle missing query params', () => {
    const req = mockRequest({});
    const result = parsePaginateQuery(req);
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
    expect(result.sortBy).toBeUndefined();
    expect(result.search).toBeUndefined();
    expect(result.filter).toBeUndefined();
  });

  it('should handle multiple filter values on same column', () => {
    const req = mockRequest({ 'filter.age': ['$gte:18', '$lte:65'] });
    const result = parsePaginateQuery(req);
    expect(result.filter).toEqual({ age: ['$gte:18', '$lte:65'] });
  });
});
