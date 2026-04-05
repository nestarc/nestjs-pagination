import { parseFilters } from '../filter-parser';
import { InvalidFilterColumnError } from '../../errors/invalid-filter-column.error';
import { FilterOperator } from '../../interfaces/filter-operator.type';

describe('parseFilters', () => {
  const filterableColumns: Record<string, FilterOperator[]> = {
    role: ['$eq', '$in'],
    age: ['$gt', '$gte', '$lt', '$lte'],
    createdAt: ['$gte', '$lte', '$btw'],
    name: ['$ilike'],
    status: ['$ne', '$eq'],
    deletedAt: ['$null', '$not:null'],
    price: ['$nin'],
  };

  it('should parse $eq filter', () => {
    const result = parseFilters({ role: '$eq:admin' }, filterableColumns);
    expect(result).toEqual({ role: { equals: 'admin' } });
  });

  it('should parse $ne filter', () => {
    const result = parseFilters({ status: '$ne:deleted' }, filterableColumns);
    expect(result).toEqual({ status: { not: 'deleted' } });
  });

  it('should parse $gt filter with number coercion', () => {
    const result = parseFilters({ age: '$gt:18' }, filterableColumns);
    expect(result).toEqual({ age: { gt: 18 } });
  });

  it('should parse $gte filter', () => {
    const result = parseFilters({ age: '$gte:21' }, filterableColumns);
    expect(result).toEqual({ age: { gte: 21 } });
  });

  it('should parse $lt filter', () => {
    const result = parseFilters({ age: '$lt:65' }, filterableColumns);
    expect(result).toEqual({ age: { lt: 65 } });
  });

  it('should parse $lte filter', () => {
    const result = parseFilters({ age: '$lte:60' }, filterableColumns);
    expect(result).toEqual({ age: { lte: 60 } });
  });

  it('should parse $in filter', () => {
    const result = parseFilters({ role: '$in:admin,user' }, filterableColumns);
    expect(result).toEqual({ role: { in: ['admin', 'user'] } });
  });

  it('should parse $nin filter', () => {
    const result = parseFilters({ price: '$nin:0,100' }, filterableColumns);
    expect(result).toEqual({ price: { notIn: [0, 100] } });
  });

  it('should parse $ilike filter', () => {
    const result = parseFilters({ name: '$ilike:john' }, filterableColumns);
    expect(result).toEqual({ name: { contains: 'john', mode: 'insensitive' } });
  });

  it('should parse $btw filter', () => {
    const result = parseFilters({ createdAt: '$btw:2024-01-01,2024-12-31' }, filterableColumns);
    expect(result).toEqual({ createdAt: { gte: '2024-01-01', lte: '2024-12-31' } });
  });

  it('should parse $null filter', () => {
    const result = parseFilters({ deletedAt: '$null' }, filterableColumns);
    expect(result).toEqual({ deletedAt: null });
  });

  it('should parse $not:null filter', () => {
    const result = parseFilters({ deletedAt: '$not:null' }, filterableColumns);
    expect(result).toEqual({ deletedAt: { not: null } });
  });

  it('should throw InvalidFilterColumnError for unknown column', () => {
    expect(() => parseFilters({ secret: '$eq:value' }, filterableColumns)).toThrow(InvalidFilterColumnError);
  });

  it('should throw InvalidFilterColumnError for disallowed operator', () => {
    expect(() => parseFilters({ role: '$gt:10' }, filterableColumns)).toThrow(InvalidFilterColumnError);
  });

  it('should return empty object for undefined filters', () => {
    const result = parseFilters(undefined, filterableColumns);
    expect(result).toEqual({});
  });

  it('should handle multiple filters', () => {
    const result = parseFilters({ role: '$eq:admin', age: '$gte:18' }, filterableColumns);
    expect(result).toEqual({ role: { equals: 'admin' }, age: { gte: 18 } });
  });

  it('should handle array filter values (multiple filters on same column)', () => {
    const result = parseFilters({ age: ['$gte:18', '$lte:65'] }, filterableColumns);
    expect(result).toEqual({ age: { gte: 18, lte: 65 } });
  });
});
