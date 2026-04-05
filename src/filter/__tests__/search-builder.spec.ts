import { buildSearchCondition } from '../search-builder';

describe('buildSearchCondition', () => {
  it('should build OR conditions for searchable columns', () => {
    const result = buildSearchCondition('john', ['name', 'email']);
    expect(result).toEqual({
      OR: [
        { name: { contains: 'john', mode: 'insensitive' } },
        { email: { contains: 'john', mode: 'insensitive' } },
      ],
    });
  });

  it('should return empty object for undefined search', () => {
    expect(buildSearchCondition(undefined, ['name'])).toEqual({});
  });

  it('should return empty object for empty search', () => {
    expect(buildSearchCondition('', ['name'])).toEqual({});
  });

  it('should return empty object for undefined columns', () => {
    expect(buildSearchCondition('john', undefined)).toEqual({});
  });

  it('should return empty object for empty columns array', () => {
    expect(buildSearchCondition('john', [])).toEqual({});
  });

  it('should handle single searchable column', () => {
    const result = buildSearchCondition('test', ['name']);
    expect(result).toEqual({
      OR: [{ name: { contains: 'test', mode: 'insensitive' } }],
    });
  });
});
