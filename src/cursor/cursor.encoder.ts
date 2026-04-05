import { InvalidCursorError } from '../errors/invalid-cursor.error';

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
