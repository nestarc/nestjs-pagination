import { SortOrder } from '../interfaces/filter-operator.type';
import { InvalidSortColumnError } from '../errors/invalid-sort-column.error';

export function validateSortColumns(
  sortBy: [string, SortOrder][] | undefined,
  sortableColumns: string[],
): void {
  if (!sortBy) return;

  for (const [column] of sortBy) {
    if (!sortableColumns.includes(column)) {
      throw new InvalidSortColumnError(column, sortableColumns);
    }
  }
}

export function buildOrderBy(
  sortBy: [string, SortOrder][] | undefined,
  nullSort?: 'first' | 'last',
): Record<string, any>[] {
  if (!sortBy || sortBy.length === 0) return [];

  return sortBy.map(([column, order]) => {
    const direction = order.toLowerCase();

    if (nullSort) {
      return { [column]: { sort: direction, nulls: nullSort } };
    }

    return { [column]: direction };
  });
}
