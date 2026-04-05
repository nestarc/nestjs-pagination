import { buildOrderBy, validateSortColumns } from '../sort-builder';
import { InvalidSortColumnError } from '../../errors/invalid-sort-column.error';

describe('validateSortColumns', () => {
  const sortableColumns = ['id', 'name', 'email', 'createdAt'];

  it('should pass for valid columns', () => {
    expect(() => validateSortColumns([['createdAt', 'DESC']], sortableColumns)).not.toThrow();
  });

  it('should throw for invalid column', () => {
    expect(() => validateSortColumns([['password', 'ASC']], sortableColumns)).toThrow(InvalidSortColumnError);
  });

  it('should pass for multiple valid columns', () => {
    expect(() =>
      validateSortColumns([['name', 'ASC'], ['createdAt', 'DESC']], sortableColumns),
    ).not.toThrow();
  });
});

describe('buildOrderBy', () => {
  it('should convert single sort to Prisma orderBy', () => {
    const result = buildOrderBy([['createdAt', 'DESC']]);
    expect(result).toEqual([{ createdAt: 'desc' }]);
  });

  it('should convert multiple sorts to Prisma orderBy array', () => {
    const result = buildOrderBy([['role', 'ASC'], ['createdAt', 'DESC']]);
    expect(result).toEqual([{ role: 'asc' }, { createdAt: 'desc' }]);
  });

  it('should return empty array for undefined sortBy', () => {
    expect(buildOrderBy(undefined)).toEqual([]);
  });

  it('should return empty array for empty sortBy', () => {
    expect(buildOrderBy([])).toEqual([]);
  });

  it('should handle nullSort last', () => {
    const result = buildOrderBy([['name', 'ASC']], 'last');
    expect(result).toEqual([{ name: { sort: 'asc', nulls: 'last' } }]);
  });

  it('should handle nullSort first', () => {
    const result = buildOrderBy([['name', 'DESC']], 'first');
    expect(result).toEqual([{ name: { sort: 'desc', nulls: 'first' } }]);
  });
});
