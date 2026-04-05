import { coerceFilterValue } from '../type-coercion';

describe('coerceFilterValue', () => {
  it('should convert numeric strings to numbers', () => {
    expect(coerceFilterValue('42')).toBe(42);
    expect(coerceFilterValue('3.14')).toBe(3.14);
    expect(coerceFilterValue('-10')).toBe(-10);
  });

  it('should convert boolean strings to booleans', () => {
    expect(coerceFilterValue('true')).toBe(true);
    expect(coerceFilterValue('false')).toBe(false);
  });

  it('should convert null string to null', () => {
    expect(coerceFilterValue('null')).toBeNull();
  });

  it('should return non-numeric strings as-is', () => {
    expect(coerceFilterValue('admin')).toBe('admin');
    expect(coerceFilterValue('john@test.com')).toBe('john@test.com');
    expect(coerceFilterValue('')).toBe('');
  });

  it('should not convert strings that look partially numeric', () => {
    expect(coerceFilterValue('10abc')).toBe('10abc');
    expect(coerceFilterValue('abc10')).toBe('abc10');
  });

  it('should handle ISO date strings as strings (no auto-conversion)', () => {
    expect(coerceFilterValue('2024-01-01')).toBe('2024-01-01');
  });

  it('should preserve leading-zero strings', () => {
    expect(coerceFilterValue('00123')).toBe('00123');
    expect(coerceFilterValue('007')).toBe('007');
  });

  it('should still convert plain zero to number', () => {
    expect(coerceFilterValue('0')).toBe(0);
  });

  it('should preserve trailing decimal zero strings', () => {
    expect(coerceFilterValue('1.0')).toBe('1.0');
  });
});
