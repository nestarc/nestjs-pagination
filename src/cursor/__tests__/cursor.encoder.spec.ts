import { encodeCursor, decodeCursor } from '../cursor.encoder';
import { InvalidCursorError } from '../../errors/invalid-cursor.error';

describe('encodeCursor', () => {
  it('should encode a record id to base64url', () => {
    const cursor = encodeCursor({ id: '10', name: 'Alice' }, 'id');
    expect(cursor).toBe(
      Buffer.from(JSON.stringify({ id: '10' })).toString('base64url'),
    );
  });

  it('should encode numeric id', () => {
    const cursor = encodeCursor({ id: 42 }, 'id');
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    expect(decoded).toEqual({ id: 42 });
  });

  it('should only include the cursor column', () => {
    const cursor = encodeCursor({ id: '5', name: 'Bob', email: 'bob@test.com' }, 'id');
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    expect(decoded).toEqual({ id: '5' });
    expect(decoded.name).toBeUndefined();
  });
});

describe('decodeCursor', () => {
  it('should decode a valid base64url cursor', () => {
    const encoded = Buffer.from(JSON.stringify({ id: '10' })).toString('base64url');
    const result = decodeCursor(encoded);
    expect(result).toEqual({ id: '10' });
  });

  it('should throw InvalidCursorError for invalid base64', () => {
    expect(() => decodeCursor('not-valid!!!')).toThrow(InvalidCursorError);
  });

  it('should throw InvalidCursorError for non-JSON content', () => {
    const encoded = Buffer.from('not json').toString('base64url');
    expect(() => decodeCursor(encoded)).toThrow(InvalidCursorError);
  });

  it('should throw InvalidCursorError for empty string', () => {
    expect(() => decodeCursor('')).toThrow(InvalidCursorError);
  });

  it('should roundtrip encode/decode', () => {
    const original = { id: '10', name: 'Alice' };
    const cursor = encodeCursor(original, 'id');
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ id: '10' });
  });
});
