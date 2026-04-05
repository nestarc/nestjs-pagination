import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { SortOrder } from '../interfaces/filter-operator.type';

export function parsePaginateQuery(request: any): PaginateQuery {
  const query = request.query || {};
  const path = request.path || request.url || '/';

  const result: PaginateQuery = { path };

  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    result.page = isNaN(page) || page < 1 ? 1 : page;
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    result.limit = isNaN(limit) || limit < 1 ? 1 : limit;
  }

  if (query.sortBy !== undefined) {
    const sortValues = Array.isArray(query.sortBy) ? query.sortBy : [query.sortBy];
    result.sortBy = sortValues.map((s: string) => {
      const [column, order = 'ASC'] = s.split(':');
      return [column, order.toUpperCase() as SortOrder];
    });
  }

  if (query.search !== undefined) {
    result.search = query.search;
  }

  const filterEntries: [string, string | string[]][] = [];
  for (const key of Object.keys(query)) {
    if (key.startsWith('filter.')) {
      const column = key.substring('filter.'.length);
      filterEntries.push([column, query[key]]);
    }
  }
  if (filterEntries.length > 0) {
    result.filter = Object.fromEntries(filterEntries);
  }

  if (query.after !== undefined) {
    result.after = query.after;
  }
  if (query.before !== undefined) {
    result.before = query.before;
  }

  return result;
}
