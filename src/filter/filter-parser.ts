import { FilterOperator } from '../interfaces/filter-operator.type';
import { InvalidFilterColumnError } from '../errors/invalid-filter-column.error';
import { coerceFilterValue } from '../helpers/type-coercion';

export function parseFilters(
  filters: Record<string, string | string[]> | undefined,
  filterableColumns: Record<string, FilterOperator[]>,
): Record<string, any> {
  if (!filters) return {};

  const where: Record<string, any> = {};

  for (const [column, rawValue] of Object.entries(filters)) {
    const allowedOperators = filterableColumns[column];
    if (!allowedOperators) {
      throw new InvalidFilterColumnError(column, Object.keys(filterableColumns));
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      const parsed = parseSingleFilter(value, column, allowedOperators);
      where[column] = where[column]
        ? { ...where[column], ...toObject(parsed) }
        : parsed;
    }
  }

  return where;
}

function toObject(value: any): Record<string, any> {
  if (value === null || typeof value !== 'object') return {};
  return value;
}

function parseSingleFilter(
  raw: string,
  column: string,
  allowedOperators: FilterOperator[],
): any {
  if (raw === '$null') {
    validateOperator('$null', column, allowedOperators);
    return null;
  }

  if (raw === '$not:null') {
    validateOperator('$not:null', column, allowedOperators);
    return { not: null };
  }

  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) {
    throw new InvalidFilterColumnError(column, [], raw, allowedOperators);
  }

  let operator: string;
  let value: string;

  if (raw.startsWith('$not:null')) {
    operator = '$not:null';
    value = '';
  } else {
    operator = raw.substring(0, colonIndex);
    value = raw.substring(colonIndex + 1);
  }

  validateOperator(operator as FilterOperator, column, allowedOperators);

  switch (operator) {
    case '$eq':
      return { equals: coerceFilterValue(value) };
    case '$ne':
      return { not: coerceFilterValue(value) };
    case '$gt':
      return { gt: coerceFilterValue(value) };
    case '$gte':
      return { gte: coerceFilterValue(value) };
    case '$lt':
      return { lt: coerceFilterValue(value) };
    case '$lte':
      return { lte: coerceFilterValue(value) };
    case '$in': {
      const items = value.split(',').map(coerceFilterValue);
      return { in: items };
    }
    case '$nin': {
      const items = value.split(',').map(coerceFilterValue);
      return { notIn: items };
    }
    case '$ilike':
      return { contains: value, mode: 'insensitive' };
    case '$btw': {
      const [min, max] = value.split(',');
      return { gte: coerceFilterValue(min), lte: coerceFilterValue(max) };
    }
    default:
      throw new InvalidFilterColumnError(column, [], operator, allowedOperators);
  }
}

function validateOperator(
  operator: FilterOperator | string,
  column: string,
  allowedOperators: FilterOperator[],
): void {
  if (!allowedOperators.includes(operator as FilterOperator)) {
    throw new InvalidFilterColumnError(column, [], operator, allowedOperators);
  }
}
