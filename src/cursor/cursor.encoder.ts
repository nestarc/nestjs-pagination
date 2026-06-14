import { InvalidCursorError } from '../errors/invalid-cursor.error';
import { SortOrder } from '../interfaces/filter-operator.type';

export type CursorPrimitive = string | number | boolean | Date | null;

export interface CursorPayload {
  v: 2;
  values: Record<string, CursorPrimitive>;
  sortBy: [string, SortOrder][];
}

export function encodeCursor(
  record: Record<string, any>,
  cursorColumn: string,
): string {
  const value = record[cursorColumn];
  return Buffer.from(JSON.stringify({ [cursorColumn]: value })).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, any> {
  if (!cursor) {
    throw new InvalidCursorError(cursor);
  }

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Not an object');
    }

    return parsed;
  } catch {
    throw new InvalidCursorError(cursor);
  }
}

export function encodeKeysetCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeKeysetCursor(cursor: string): CursorPayload {
  if (!cursor) {
    throw new InvalidCursorError(cursor);
  }

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);

    if (!isCursorPayload(parsed)) {
      throw new Error('Not a keyset cursor payload');
    }

    return parsed;
  } catch {
    throw new InvalidCursorError(cursor);
  }
}

function isCursorPayload(value: any): value is CursorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.v === 2 &&
    typeof value.values === 'object' &&
    value.values !== null &&
    !Array.isArray(value.values) &&
    Array.isArray(value.sortBy) &&
    value.sortBy.every(isSortTuple)
  );
}

function isSortTuple(value: any): value is [string, SortOrder] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    (value[1] === 'ASC' || value[1] === 'DESC')
  );
}
