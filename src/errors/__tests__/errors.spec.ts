import { BadRequestException } from '@nestjs/common';
import { InvalidSortColumnError } from '../invalid-sort-column.error';
import { InvalidFilterColumnError } from '../invalid-filter-column.error';
import { InvalidCursorError } from '../invalid-cursor.error';

describe('InvalidSortColumnError', () => {
  it('should be a BadRequestException', () => {
    const error = new InvalidSortColumnError('password', ['id', 'name', 'email']);
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('should include the column name and sortable columns in the message', () => {
    const error = new InvalidSortColumnError('password', ['id', 'name', 'email']);
    expect(error.message).toBe(
      "Column 'password' is not sortable. Sortable columns: id, name, email",
    );
  });

  it('should have the name InvalidSortColumn', () => {
    const error = new InvalidSortColumnError('x', ['id']);
    expect(error.name).toBe('InvalidSortColumn');
  });
});

describe('InvalidFilterColumnError', () => {
  it('should be a BadRequestException', () => {
    const error = new InvalidFilterColumnError('secret', ['role', 'status']);
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('should include column and allowed columns in message', () => {
    const error = new InvalidFilterColumnError('secret', ['role', 'status']);
    expect(error.message).toBe(
      "Column 'secret' is not filterable. Filterable columns: role, status",
    );
  });

  it('should report invalid operator when provided', () => {
    const error = new InvalidFilterColumnError('role', ['role'], '$regex', ['$eq', '$in']);
    expect(error.message).toBe(
      "Operator '$regex' is not allowed for column 'role'. Allowed operators: $eq, $in",
    );
  });

  it('should have the name InvalidFilterColumn', () => {
    const error = new InvalidFilterColumnError('x', ['id']);
    expect(error.name).toBe('InvalidFilterColumn');
  });
});

describe('InvalidCursorError', () => {
  it('should be a BadRequestException', () => {
    const error = new InvalidCursorError('not-valid-base64');
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('should include the invalid cursor value in the message', () => {
    const error = new InvalidCursorError('abc!!');
    expect(error.message).toBe("Invalid cursor: 'abc!!'");
  });

  it('should have the name InvalidCursor', () => {
    const error = new InvalidCursorError('x');
    expect(error.name).toBe('InvalidCursor');
  });
});
