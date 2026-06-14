import { CursorPayload } from './cursor.encoder';
import { SortOrder } from '../interfaces/filter-operator.type';
import { InvalidCursorError } from '../errors/invalid-cursor.error';
import { InvalidSortColumnError } from '../errors/invalid-sort-column.error';

export function validateKeysetConfig(
  cursorColumns: string[] | undefined,
  sortableColumns: string[],
): string[] {
  if (!cursorColumns || cursorColumns.length === 0) {
    throw new InvalidCursorError('missing keyset cursor columns');
  }

  for (const column of cursorColumns) {
    if (!sortableColumns.includes(column)) {
      throw new InvalidSortColumnError(column, sortableColumns);
    }
  }

  return cursorColumns;
}

export function resolveKeysetSortBy(
  sortBy: [string, SortOrder][] | undefined,
  cursorColumns: string[],
): [string, SortOrder][] {
  if (sortBy && sortBy.length > 0) {
    const resolved: [string, SortOrder][] = [...sortBy];
    const fallbackOrder = resolved[resolved.length - 1][1];
    for (const column of cursorColumns) {
      if (!resolved.some(([sortColumn]) => sortColumn === column)) {
        resolved.push([column, fallbackOrder]);
      }
    }
    return resolved;
  }

  return cursorColumns.map((column) => [column, 'ASC']);
}

export function validateCursorPayload(
  payload: CursorPayload,
  sortBy: [string, SortOrder][],
): void {
  if (payload.sortBy.length !== sortBy.length) {
    throw new InvalidCursorError('sort mismatch');
  }

  for (let index = 0; index < sortBy.length; index++) {
    const [column, order] = sortBy[index];
    const [payloadColumn, payloadOrder] = payload.sortBy[index];
    if (column !== payloadColumn || order !== payloadOrder) {
      throw new InvalidCursorError('sort mismatch');
    }
    if (!(column in payload.values)) {
      throw new InvalidCursorError('missing cursor value');
    }
  }
}

export function buildKeysetWhere(
  payload: CursorPayload,
  sortBy: [string, SortOrder][],
  direction: 'after' | 'before',
): Record<string, any> {
  validateCursorPayload(payload, sortBy);

  return {
    OR: sortBy.map(([column, order], index) => {
      const equals = sortBy.slice(0, index).map(([previousColumn]) => ({
        [previousColumn]: { equals: payload.values[previousColumn] },
      }));
      const comparison = {
        [column]: {
          [comparisonOperator(order, direction)]: payload.values[column],
        },
      };

      if (equals.length === 0) {
        return comparison;
      }

      return { AND: [...equals, comparison] };
    }),
  };
}

export function mergeKeysetWhere(
  baseWhere: Record<string, any>,
  keysetWhere: Record<string, any>,
): Record<string, any> {
  if (Object.keys(baseWhere).length === 0) {
    return keysetWhere;
  }

  return { AND: [baseWhere, keysetWhere] };
}

function comparisonOperator(
  order: SortOrder,
  direction: 'after' | 'before',
): 'lt' | 'gt' {
  if (direction === 'after') {
    return order === 'DESC' ? 'lt' : 'gt';
  }

  return order === 'DESC' ? 'gt' : 'lt';
}
