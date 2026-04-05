import { buildOffsetLinks, buildCursorLinks } from '../link-builder';
import { PaginateQuery } from '../../interfaces/paginate-query.interface';

describe('buildOffsetLinks', () => {
  it('should build links for first page', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildOffsetLinks(query, 1, 20, 5);
    expect(links.first).toContain('page=1');
    expect(links.first).toContain('limit=20');
    expect(links.previous).toBeNull();
    expect(links.current).toContain('page=1');
    expect(links.next).toContain('page=2');
    expect(links.last).toContain('page=5');
  });

  it('should build links for middle page', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildOffsetLinks(query, 3, 20, 5);
    expect(links.previous).toContain('page=2');
    expect(links.current).toContain('page=3');
    expect(links.next).toContain('page=4');
  });

  it('should build links for last page', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildOffsetLinks(query, 5, 20, 5);
    expect(links.previous).toContain('page=4');
    expect(links.next).toBeNull();
  });

  it('should handle single page', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildOffsetLinks(query, 1, 20, 1);
    expect(links.previous).toBeNull();
    expect(links.next).toBeNull();
  });

  it('should preserve sortBy in links', () => {
    const query: PaginateQuery = {
      path: '/users',
      sortBy: [['createdAt', 'DESC']],
    };
    const links = buildOffsetLinks(query, 1, 20, 5);
    expect(links.current).toContain('sortBy=');
    expect(links.next).toContain('sortBy=');
    expect(links.first).toContain('sortBy=');
    expect(links.last).toContain('sortBy=');
  });

  it('should preserve search in links', () => {
    const query: PaginateQuery = {
      path: '/users',
      search: 'john',
    };
    const links = buildOffsetLinks(query, 1, 20, 5);
    expect(links.current).toContain('search=john');
  });

  it('should preserve filter in links', () => {
    const query: PaginateQuery = {
      path: '/users',
      filter: { role: '$eq:admin' },
    };
    const links = buildOffsetLinks(query, 1, 20, 5);
    expect(links.current).toContain('filter.role=');
  });
});

describe('buildCursorLinks', () => {
  it('should build links with next cursor', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildCursorLinks(query, 20, 'abc', null, true, false);
    expect(links.next).toContain('after=abc');
    expect(links.previous).toBeNull();
    expect(links.current).toContain('limit=20');
  });

  it('should build links with no next page', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildCursorLinks(query, 20, 'abc', null, false, false);
    expect(links.next).toBeNull();
  });

  it('should build links with previous cursor', () => {
    const query: PaginateQuery = { path: '/users' };
    const links = buildCursorLinks(query, 20, 'end', 'start', true, true);
    expect(links.previous).toContain('before=start');
    expect(links.next).toContain('after=end');
  });

  it('should use after= in current link for after request', () => {
    const query: PaginateQuery = { path: '/users', after: 'my-cursor' };
    const links = buildCursorLinks(query, 20, 'end', 'start', true, true);
    expect(links.current).toContain('after=my-cursor');
    expect(links.current).not.toContain('before=');
  });

  it('should use before= in current link for before request', () => {
    const query: PaginateQuery = { path: '/users', before: 'my-cursor' };
    const links = buildCursorLinks(query, 20, 'end', 'start', true, true);
    expect(links.current).toContain('before=my-cursor');
    expect(links.current).not.toContain('after=');
  });

  it('should preserve sortBy in cursor links', () => {
    const query: PaginateQuery = {
      path: '/users',
      sortBy: [['createdAt', 'DESC']],
    };
    const links = buildCursorLinks(query, 20, 'abc', null, true, false);
    expect(links.next).toContain('sortBy=');
    expect(links.current).toContain('sortBy=');
  });
});
