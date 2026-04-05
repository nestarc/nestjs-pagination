export function coerceFilterValue(
  value: string,
): string | number | boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  if (value !== '' && !isNaN(Number(value)) && value.trim() === value) {
    return Number(value);
  }

  return value;
}
