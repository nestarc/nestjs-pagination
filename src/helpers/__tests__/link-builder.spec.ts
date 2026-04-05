import { buildOffsetLinks, buildCursorLinks } from '../link-builder';

describe('buildOffsetLinks', () => {
  it('should build links for first page', () => {
    const links = buildOffsetLinks('/users', 1, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: null,
      current: '/users?page=1&limit=20',
      next: '/users?page=2&limit=20',
      last: '/users?page=5&limit=20',
    });
  });

  it('should build links for middle page', () => {
    const links = buildOffsetLinks('/users', 3, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: '/users?page=2&limit=20',
      current: '/users?page=3&limit=20',
      next: '/users?page=4&limit=20',
      last: '/users?page=5&limit=20',
    });
  });

  it('should build links for last page', () => {
    const links = buildOffsetLinks('/users', 5, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: '/users?page=4&limit=20',
      current: '/users?page=5&limit=20',
      next: null,
      last: '/users?page=5&limit=20',
    });
  });

  it('should handle single page', () => {
    const links = buildOffsetLinks('/users', 1, 20, 1);
    expect(links.previous).toBeNull();
    expect(links.next).toBeNull();
  });
});

describe('buildCursorLinks', () => {
  it('should build links with next cursor', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, true, false);
    expect(links).toEqual({
      current: '/users?limit=20&after=abc',
      next: '/users?limit=20&after=abc',
      previous: null,
    });
  });

  it('should build links with no next page', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, false, false);
    expect(links.next).toBeNull();
  });

  it('should build links with previous cursor', () => {
    const links = buildCursorLinks('/users', 20, 'end', 'start', true, true);
    expect(links.previous).toBe('/users?limit=20&before=start');
    expect(links.next).toBe('/users?limit=20&after=end');
  });

  it('should build current link without cursor on first page', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, true, false);
    expect(links.current).toContain('/users');
  });
});
