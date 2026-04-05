import { PaginateQuery } from '../interfaces/paginate-query.interface';

export function createPaginateQuery(
  overrides: Partial<PaginateQuery> = {},
): PaginateQuery {
  return {
    path: '/',
    ...overrides,
  };
}
