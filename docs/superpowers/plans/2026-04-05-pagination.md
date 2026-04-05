# @nestarc/pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS + Prisma pagination module supporting offset/cursor pagination, multi-column sorting, filtering with 12 operators, search, and Swagger auto-documentation.

**Architecture:** A single `paginate()` function orchestrates offset or cursor pagination by composing small, focused builders (filter-parser, sort-builder, search-builder, link-builder, cursor-encoder). A `@Paginate()` parameter decorator parses HTTP query params into a `PaginateQuery` object. `PaginationModule.forRoot()` provides global defaults via DI.

**Tech Stack:** TypeScript, NestJS 10+/11+, Prisma 5+/6+, Jest, @nestjs/swagger (optional)

**Spec:** `docs/2026-04-05-pagination-design.md`

---

## File Structure

```
src/
├── pagination.module.ts                # DynamicModule (forRoot/forRootAsync)
├── pagination.constants.ts             # Injection tokens, default values
├── interfaces/
│   ├── pagination-options.interface.ts  # PaginationModuleOptions
│   ├── paginate-config.interface.ts     # PaginateConfig<T>
│   ├── paginate-query.interface.ts      # PaginateQuery
│   ├── paginated.interface.ts           # Paginated<T>, CursorPaginated<T>
│   └── filter-operator.type.ts          # FilterOperator, SortOrder
├── paginate.ts                          # Core paginate() orchestrator
├── cursor/
│   ├── cursor.encoder.ts               # Cursor encode/decode (base64url)
│   └── cursor-paginate.ts              # Cursor-based pagination logic
├── filter/
│   ├── filter-parser.ts                # Query params → Prisma where
│   ├── search-builder.ts               # Search → OR conditions
│   └── sort-builder.ts                 # sortBy → Prisma orderBy
├── decorators/
│   ├── paginate.decorator.ts           # @Paginate() param decorator
│   ├── paginate-defaults.decorator.ts  # @PaginateDefaults() method decorator
│   └── api-paginated-response.decorator.ts  # Swagger decorators
├── pipes/
│   └── paginate-query.pipe.ts          # Request → PaginateQuery parsing
├── helpers/
│   ├── link-builder.ts                 # Pagination links generation
│   └── type-coercion.ts               # Filter value type coercion
├── errors/
│   ├── invalid-sort-column.error.ts
│   ├── invalid-filter-column.error.ts
│   └── invalid-cursor.error.ts
├── testing/
│   ├── test-pagination.module.ts       # Lightweight test module
│   └── create-paginate-query.ts        # PaginateQuery factory
└── index.ts                            # Barrel exports
```

Test files mirror the source structure under `src/__tests__/`.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `jest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@nestarc/pagination",
  "version": "0.1.0",
  "description": "Prisma cursor & offset pagination for NestJS with filtering, sorting, search, and Swagger auto-documentation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "default": "./dist/testing/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "jest",
    "test:cov": "jest --coverage",
    "lint": "eslint \"src/**/*.ts\""
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core": "^10.0.0 || ^11.0.0",
    "@prisma/client": "^5.0.0 || ^6.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "rxjs": "^7.0.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/swagger": {
      "optional": true
    }
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^8.0.0",
    "@nestjs/testing": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^22.0.0",
    "jest": "^29.7.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.7.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.spec.ts"]
}
```

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "src/**/*.spec.ts", "src/__tests__"]
}
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.type.ts',
    '!**/index.ts',
    '!**/__tests__/**',
    '!**/testing/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
```

- [ ] **Step 5: Install dependencies and verify setup**

Run: `npm install`
Expected: Clean install, `node_modules` created, no peer dependency errors.

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, just verifies config).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json jest.config.ts
git commit -m "chore: scaffold project with TypeScript, Jest, and NestJS peer deps"
```

---

### Task 2: Types, Interfaces & Constants

**Files:**
- Create: `src/interfaces/filter-operator.type.ts`
- Create: `src/interfaces/paginate-query.interface.ts`
- Create: `src/interfaces/paginate-config.interface.ts`
- Create: `src/interfaces/paginated.interface.ts`
- Create: `src/interfaces/pagination-options.interface.ts`
- Create: `src/pagination.constants.ts`

- [ ] **Step 1: Create FilterOperator and SortOrder types**

Create `src/interfaces/filter-operator.type.ts`:

```typescript
export type FilterOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$ilike'
  | '$btw'
  | '$null'
  | '$not:null';

export type SortOrder = 'ASC' | 'DESC';
```

- [ ] **Step 2: Create PaginateQuery interface**

Create `src/interfaces/paginate-query.interface.ts`:

```typescript
import { SortOrder } from './filter-operator.type';

export interface PaginateQuery {
  limit?: number;
  sortBy?: [string, SortOrder][];
  search?: string;
  filter?: Record<string, string | string[]>;
  select?: string[];
  path: string;

  // Offset-based
  page?: number;

  // Cursor-based
  after?: string;
  before?: string;
}
```

- [ ] **Step 3: Create PaginateConfig interface**

Create `src/interfaces/paginate-config.interface.ts`:

```typescript
import { FilterOperator, SortOrder } from './filter-operator.type';

export interface PaginateConfig<T = any> {
  sortableColumns: (keyof T & string)[];

  defaultSortBy?: [keyof T & string, SortOrder][];
  nullSort?: 'first' | 'last';

  searchableColumns?: (keyof T & string)[];

  filterableColumns?: {
    [K in keyof T & string]?: FilterOperator[];
  };

  relations?: Record<string, boolean | object>;
  select?: (keyof T & string)[];

  paginationType?: 'offset' | 'cursor';
  cursorColumn?: keyof T & string;
  defaultLimit?: number;
  maxLimit?: number;
  withTotalCount?: boolean;

  where?: object;
  allowWithDeleted?: boolean;
}
```

- [ ] **Step 4: Create Paginated and CursorPaginated interfaces**

Create `src/interfaces/paginated.interface.ts`:

```typescript
import { SortOrder } from './filter-operator.type';

export interface Paginated<T> {
  data: T[];
  meta: {
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
    sortBy: [string, SortOrder][];
    search?: string;
    filter?: Record<string, string>;
  };
  links: {
    first: string;
    previous: string | null;
    current: string;
    next: string | null;
    last: string;
  };
}

export interface CursorPaginated<T> {
  data: T[];
  meta: {
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
    sortBy: [string, SortOrder][];
    search?: string;
    filter?: Record<string, string>;
    totalItems?: number;
  };
  links: {
    current: string;
    next: string | null;
    previous: string | null;
  };
}
```

- [ ] **Step 5: Create PaginationModuleOptions interface**

Create `src/interfaces/pagination-options.interface.ts`:

```typescript
import { ModuleMetadata } from '@nestjs/common';
import { SortOrder } from './filter-operator.type';

export interface PaginationModuleOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultPaginationType?: 'offset' | 'cursor';
  defaultSortBy?: [string, SortOrder][];
  withLinks?: boolean;
  withTotalCount?: boolean;
  fieldNamingStrategy?: 'camelCase' | 'snake_case';
}

export interface PaginationModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<PaginationModuleOptions> | PaginationModuleOptions;
  inject?: any[];
}
```

- [ ] **Step 6: Create constants**

Create `src/pagination.constants.ts`:

```typescript
export const PAGINATION_MODULE_OPTIONS = 'PAGINATION_MODULE_OPTIONS';

export const DEFAULT_LIMIT = 20;
export const DEFAULT_MAX_LIMIT = 100;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGINATION_TYPE = 'offset' as const;
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add type definitions, interfaces, and constants"
```

---

### Task 3: Error Classes

**Files:**
- Create: `src/errors/invalid-sort-column.error.ts`
- Create: `src/errors/invalid-filter-column.error.ts`
- Create: `src/errors/invalid-cursor.error.ts`
- Test: `src/errors/__tests__/errors.spec.ts`

- [ ] **Step 1: Write failing tests for all three error classes**

Create `src/errors/__tests__/errors.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { InvalidSortColumnError } from '../invalid-sort-column.error';
import { InvalidFilterColumnError } from '../invalid-filter-column.error';
import { InvalidCursorError } from '../invalid-cursor.error';

describe('InvalidSortColumnError', () => {
  it('should be a BadRequestException', () => {
    const error = new InvalidSortColumnError('password', [
      'id',
      'name',
      'email',
    ]);
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('should include the column name and sortable columns in the message', () => {
    const error = new InvalidSortColumnError('password', [
      'id',
      'name',
      'email',
    ]);
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
    const error = new InvalidFilterColumnError('role', ['role'], '$regex', [
      '$eq',
      '$in',
    ]);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest errors --no-coverage`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three error classes**

Create `src/errors/invalid-sort-column.error.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

export class InvalidSortColumnError extends BadRequestException {
  constructor(column: string, sortableColumns: string[]) {
    super(
      `Column '${column}' is not sortable. Sortable columns: ${sortableColumns.join(', ')}`,
    );
    this.name = 'InvalidSortColumn';
  }
}
```

Create `src/errors/invalid-filter-column.error.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

export class InvalidFilterColumnError extends BadRequestException {
  constructor(
    column: string,
    filterableColumns: string[],
    operator?: string,
    allowedOperators?: string[],
  ) {
    const message =
      operator && allowedOperators
        ? `Operator '${operator}' is not allowed for column '${column}'. Allowed operators: ${allowedOperators.join(', ')}`
        : `Column '${column}' is not filterable. Filterable columns: ${filterableColumns.join(', ')}`;
    super(message);
    this.name = 'InvalidFilterColumn';
  }
}
```

Create `src/errors/invalid-cursor.error.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

export class InvalidCursorError extends BadRequestException {
  constructor(cursor: string) {
    super(`Invalid cursor: '${cursor}'`);
    this.name = 'InvalidCursor';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest errors --no-coverage`
Expected: 3 suites, all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/errors/
git commit -m "feat: add custom error classes for sort, filter, and cursor validation"
```

---

### Task 4: Cursor Encoder/Decoder

**Files:**
- Create: `src/cursor/cursor.encoder.ts`
- Test: `src/cursor/__tests__/cursor.encoder.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/cursor/__tests__/cursor.encoder.spec.ts`:

```typescript
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
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8'),
    );
    expect(decoded).toEqual({ id: 42 });
  });

  it('should only include the cursor column', () => {
    const cursor = encodeCursor(
      { id: '5', name: 'Bob', email: 'bob@test.com' },
      'id',
    );
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8'),
    );
    expect(decoded).toEqual({ id: '5' });
    expect(decoded.name).toBeUndefined();
  });
});

describe('decodeCursor', () => {
  it('should decode a valid base64url cursor', () => {
    const encoded = Buffer.from(JSON.stringify({ id: '10' })).toString(
      'base64url',
    );
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest cursor.encoder --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cursor encoder**

Create `src/cursor/cursor.encoder.ts`:

```typescript
import { InvalidCursorError } from '../errors/invalid-cursor.error';

export function encodeCursor(
  record: Record<string, any>,
  cursorColumn: string,
): string {
  const value = record[cursorColumn];
  return Buffer.from(JSON.stringify({ [cursorColumn]: value })).toString(
    'base64url',
  );
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest cursor.encoder --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cursor/
git commit -m "feat: add base64url cursor encoder and decoder"
```

---

### Task 5: Type Coercion Helper

**Files:**
- Create: `src/helpers/type-coercion.ts`
- Test: `src/helpers/__tests__/type-coercion.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/helpers/__tests__/type-coercion.spec.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest type-coercion --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement type coercion**

Create `src/helpers/type-coercion.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest type-coercion --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/helpers/
git commit -m "feat: add filter value type coercion helper"
```

---

### Task 6: Filter Parser

**Files:**
- Create: `src/filter/filter-parser.ts`
- Test: `src/filter/__tests__/filter-parser.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/filter/__tests__/filter-parser.spec.ts`:

```typescript
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
    const result = parseFilters(
      { price: '$nin:0,100' },
      filterableColumns,
    );
    expect(result).toEqual({ price: { notIn: [0, 100] } });
  });

  it('should parse $ilike filter', () => {
    const result = parseFilters({ name: '$ilike:john' }, filterableColumns);
    expect(result).toEqual({
      name: { contains: 'john', mode: 'insensitive' },
    });
  });

  it('should parse $btw filter', () => {
    const result = parseFilters(
      { createdAt: '$btw:2024-01-01,2024-12-31' },
      filterableColumns,
    );
    expect(result).toEqual({
      createdAt: { gte: '2024-01-01', lte: '2024-12-31' },
    });
  });

  it('should parse $null filter', () => {
    const result = parseFilters(
      { deletedAt: '$null' },
      filterableColumns,
    );
    expect(result).toEqual({ deletedAt: null });
  });

  it('should parse $not:null filter', () => {
    const result = parseFilters(
      { deletedAt: '$not:null' },
      filterableColumns,
    );
    expect(result).toEqual({ deletedAt: { not: null } });
  });

  it('should throw InvalidFilterColumnError for unknown column', () => {
    expect(() =>
      parseFilters({ secret: '$eq:value' }, filterableColumns),
    ).toThrow(InvalidFilterColumnError);
  });

  it('should throw InvalidFilterColumnError for disallowed operator', () => {
    expect(() =>
      parseFilters({ role: '$gt:10' }, filterableColumns),
    ).toThrow(InvalidFilterColumnError);
  });

  it('should return empty object for undefined filters', () => {
    const result = parseFilters(undefined, filterableColumns);
    expect(result).toEqual({});
  });

  it('should handle multiple filters', () => {
    const result = parseFilters(
      { role: '$eq:admin', age: '$gte:18' },
      filterableColumns,
    );
    expect(result).toEqual({
      role: { equals: 'admin' },
      age: { gte: 18 },
    });
  });

  it('should handle array filter values (multiple filters on same column)', () => {
    const result = parseFilters(
      { age: ['$gte:18', '$lte:65'] },
      filterableColumns,
    );
    expect(result).toEqual({
      age: { gte: 18, lte: 65 },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest filter-parser --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement filter parser**

Create `src/filter/filter-parser.ts`:

```typescript
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
      throw new InvalidFilterColumnError(
        column,
        Object.keys(filterableColumns),
      );
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
  // Handle $null and $not:null (no value part)
  if (raw === '$null') {
    validateOperator('$null', column, allowedOperators);
    return null;
  }

  if (raw === '$not:null') {
    validateOperator('$not:null', column, allowedOperators);
    return { not: null };
  }

  // Parse operator:value format
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) {
    throw new InvalidFilterColumnError(
      column,
      Object.keys({}),
      raw,
      allowedOperators,
    );
  }

  // Handle $not:null which has two colons
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
      throw new InvalidFilterColumnError(
        column,
        [],
        operator,
        allowedOperators,
      );
  }
}

function validateOperator(
  operator: FilterOperator | string,
  column: string,
  allowedOperators: FilterOperator[],
): void {
  if (!allowedOperators.includes(operator as FilterOperator)) {
    throw new InvalidFilterColumnError(
      column,
      [],
      operator,
      allowedOperators,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest filter-parser --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/filter/filter-parser.ts src/filter/__tests__/
git commit -m "feat: add filter parser converting query params to Prisma where"
```

---

### Task 7: Sort Builder

**Files:**
- Create: `src/filter/sort-builder.ts`
- Test: `src/filter/__tests__/sort-builder.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/filter/__tests__/sort-builder.spec.ts`:

```typescript
import { buildOrderBy, validateSortColumns } from '../sort-builder';
import { InvalidSortColumnError } from '../../errors/invalid-sort-column.error';
import { SortOrder } from '../../interfaces/filter-operator.type';

describe('validateSortColumns', () => {
  const sortableColumns = ['id', 'name', 'email', 'createdAt'];

  it('should pass for valid columns', () => {
    expect(() =>
      validateSortColumns(
        [['createdAt', 'DESC']],
        sortableColumns,
      ),
    ).not.toThrow();
  });

  it('should throw for invalid column', () => {
    expect(() =>
      validateSortColumns(
        [['password', 'ASC']],
        sortableColumns,
      ),
    ).toThrow(InvalidSortColumnError);
  });

  it('should pass for multiple valid columns', () => {
    expect(() =>
      validateSortColumns(
        [
          ['name', 'ASC'],
          ['createdAt', 'DESC'],
        ],
        sortableColumns,
      ),
    ).not.toThrow();
  });
});

describe('buildOrderBy', () => {
  it('should convert single sort to Prisma orderBy', () => {
    const result = buildOrderBy([['createdAt', 'DESC']]);
    expect(result).toEqual([{ createdAt: 'desc' }]);
  });

  it('should convert multiple sorts to Prisma orderBy array', () => {
    const result = buildOrderBy([
      ['role', 'ASC'],
      ['createdAt', 'DESC'],
    ]);
    expect(result).toEqual([{ role: 'asc' }, { createdAt: 'desc' }]);
  });

  it('should return empty array for undefined sortBy', () => {
    const result = buildOrderBy(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty sortBy', () => {
    const result = buildOrderBy([]);
    expect(result).toEqual([]);
  });

  it('should handle nullSort last', () => {
    const result = buildOrderBy([['name', 'ASC']], 'last');
    expect(result).toEqual([{ name: { sort: 'asc', nulls: 'last' } }]);
  });

  it('should handle nullSort first', () => {
    const result = buildOrderBy([['name', 'DESC']], 'first');
    expect(result).toEqual([{ name: { sort: 'desc', nulls: 'first' } }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest sort-builder --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement sort builder**

Create `src/filter/sort-builder.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest sort-builder --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/filter/sort-builder.ts src/filter/__tests__/sort-builder.spec.ts
git commit -m "feat: add sort builder converting sortBy to Prisma orderBy"
```

---

### Task 8: Search Builder

**Files:**
- Create: `src/filter/search-builder.ts`
- Test: `src/filter/__tests__/search-builder.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/filter/__tests__/search-builder.spec.ts`:

```typescript
import { buildSearchCondition } from '../search-builder';

describe('buildSearchCondition', () => {
  it('should build OR conditions for searchable columns', () => {
    const result = buildSearchCondition('john', ['name', 'email']);
    expect(result).toEqual({
      OR: [
        { name: { contains: 'john', mode: 'insensitive' } },
        { email: { contains: 'john', mode: 'insensitive' } },
      ],
    });
  });

  it('should return empty object for undefined search', () => {
    const result = buildSearchCondition(undefined, ['name']);
    expect(result).toEqual({});
  });

  it('should return empty object for empty search', () => {
    const result = buildSearchCondition('', ['name']);
    expect(result).toEqual({});
  });

  it('should return empty object for undefined columns', () => {
    const result = buildSearchCondition('john', undefined);
    expect(result).toEqual({});
  });

  it('should return empty object for empty columns array', () => {
    const result = buildSearchCondition('john', []);
    expect(result).toEqual({});
  });

  it('should handle single searchable column', () => {
    const result = buildSearchCondition('test', ['name']);
    expect(result).toEqual({
      OR: [{ name: { contains: 'test', mode: 'insensitive' } }],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest search-builder --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement search builder**

Create `src/filter/search-builder.ts`:

```typescript
export function buildSearchCondition(
  search: string | undefined,
  searchableColumns: string[] | undefined,
): Record<string, any> {
  if (!search || !searchableColumns || searchableColumns.length === 0) {
    return {};
  }

  return {
    OR: searchableColumns.map((column) => ({
      [column]: { contains: search, mode: 'insensitive' },
    })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest search-builder --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/filter/search-builder.ts src/filter/__tests__/search-builder.spec.ts
git commit -m "feat: add search builder for full-text OR conditions"
```

---

### Task 9: Link Builder

**Files:**
- Create: `src/helpers/link-builder.ts`
- Test: `src/helpers/__tests__/link-builder.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/helpers/__tests__/link-builder.spec.ts`:

```typescript
import { buildOffsetLinks, buildCursorLinks } from '../link-builder';

describe('buildOffsetLinks', () => {
  it('should build links for first page', () => {
    const links = buildOffsetLinks('/users', 1, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: null,
      current: '/users?page=1&limit=20',
      next: '/users?page=2&limit=20',
      last: '/users?page=5&limit=20',
    });
  });

  it('should build links for middle page', () => {
    const links = buildOffsetLinks('/users', 3, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: '/users?page=2&limit=20',
      current: '/users?page=3&limit=20',
      next: '/users?page=4&limit=20',
      last: '/users?page=5&limit=20',
    });
  });

  it('should build links for last page', () => {
    const links = buildOffsetLinks('/users', 5, 20, 5);
    expect(links).toEqual({
      first: '/users?page=1&limit=20',
      previous: '/users?page=4&limit=20',
      current: '/users?page=5&limit=20',
      next: null,
      last: '/users?page=5&limit=20',
    });
  });

  it('should handle single page', () => {
    const links = buildOffsetLinks('/users', 1, 20, 1);
    expect(links.previous).toBeNull();
    expect(links.next).toBeNull();
  });
});

describe('buildCursorLinks', () => {
  it('should build links with next cursor', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, true, false);
    expect(links).toEqual({
      current: '/users?limit=20&after=abc',
      next: '/users?limit=20&after=abc',
      previous: null,
    });
  });

  it('should build links with no next page', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, false, false);
    expect(links.next).toBeNull();
  });

  it('should build links with previous cursor', () => {
    const links = buildCursorLinks('/users', 20, 'end', 'start', true, true);
    expect(links.previous).toBe('/users?limit=20&before=start');
    expect(links.next).toBe('/users?limit=20&after=end');
  });

  it('should build current link without cursor on first page', () => {
    const links = buildCursorLinks('/users', 20, 'abc', null, true, false);
    expect(links.current).toContain('/users');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest link-builder --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement link builder**

Create `src/helpers/link-builder.ts`:

```typescript
export function buildOffsetLinks(
  path: string,
  currentPage: number,
  limit: number,
  totalPages: number,
): {
  first: string;
  previous: string | null;
  current: string;
  next: string | null;
  last: string;
} {
  return {
    first: `${path}?page=1&limit=${limit}`,
    previous:
      currentPage > 1
        ? `${path}?page=${currentPage - 1}&limit=${limit}`
        : null,
    current: `${path}?page=${currentPage}&limit=${limit}`,
    next:
      currentPage < totalPages
        ? `${path}?page=${currentPage + 1}&limit=${limit}`
        : null,
    last: `${path}?page=${totalPages}&limit=${limit}`,
  };
}

export function buildCursorLinks(
  path: string,
  limit: number,
  endCursor: string | null,
  startCursor: string | null,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
): {
  current: string;
  next: string | null;
  previous: string | null;
} {
  const base = `${path}?limit=${limit}`;

  return {
    current: endCursor ? `${base}&after=${endCursor}` : base,
    next: hasNextPage && endCursor ? `${base}&after=${endCursor}` : null,
    previous:
      hasPreviousPage && startCursor
        ? `${base}&before=${startCursor}`
        : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest link-builder --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/helpers/link-builder.ts src/helpers/__tests__/link-builder.spec.ts
git commit -m "feat: add link builder for offset and cursor pagination links"
```

---

### Task 10: Paginate Query Pipe & @Paginate Decorator

**Files:**
- Create: `src/pipes/paginate-query.pipe.ts`
- Create: `src/decorators/paginate.decorator.ts`
- Test: `src/pipes/__tests__/paginate-query.pipe.spec.ts`

- [ ] **Step 1: Write failing tests for the pipe**

Create `src/pipes/__tests__/paginate-query.pipe.spec.ts`:

```typescript
import { parsePaginateQuery } from '../paginate-query.pipe';

function mockRequest(query: Record<string, any>, path = '/users'): any {
  return { query, path, url: path };
}

describe('parsePaginateQuery', () => {
  it('should parse basic offset query', () => {
    const req = mockRequest({ page: '2', limit: '20' });
    const result = parsePaginateQuery(req);

    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.path).toBe('/users');
  });

  it('should parse sortBy as single value', () => {
    const req = mockRequest({ sortBy: 'createdAt:DESC' });
    const result = parsePaginateQuery(req);
    expect(result.sortBy).toEqual([['createdAt', 'DESC']]);
  });

  it('should parse sortBy as array', () => {
    const req = mockRequest({ sortBy: ['name:ASC', 'createdAt:DESC'] });
    const result = parsePaginateQuery(req);
    expect(result.sortBy).toEqual([
      ['name', 'ASC'],
      ['createdAt', 'DESC'],
    ]);
  });

  it('should parse search', () => {
    const req = mockRequest({ search: 'john' });
    const result = parsePaginateQuery(req);
    expect(result.search).toBe('john');
  });

  it('should parse filter prefixed params', () => {
    const req = mockRequest({
      'filter.role': '$eq:admin',
      'filter.age': '$gte:18',
    });
    const result = parsePaginateQuery(req);
    expect(result.filter).toEqual({ role: '$eq:admin', age: '$gte:18' });
  });

  it('should parse cursor params', () => {
    const req = mockRequest({ after: 'abc123', limit: '10' });
    const result = parsePaginateQuery(req);
    expect(result.after).toBe('abc123');
    expect(result.limit).toBe(10);
  });

  it('should parse before cursor', () => {
    const req = mockRequest({ before: 'xyz789' });
    const result = parsePaginateQuery(req);
    expect(result.before).toBe('xyz789');
  });

  it('should parse select as comma-separated string', () => {
    const req = mockRequest({ select: 'id,name,email' });
    const result = parsePaginateQuery(req);
    expect(result.select).toEqual(['id', 'name', 'email']);
  });

  it('should clamp page to minimum 1', () => {
    const req = mockRequest({ page: '0' });
    const result = parsePaginateQuery(req);
    expect(result.page).toBe(1);
  });

  it('should clamp limit to minimum 1', () => {
    const req = mockRequest({ limit: '-5' });
    const result = parsePaginateQuery(req);
    expect(result.limit).toBe(1);
  });

  it('should handle missing query params', () => {
    const req = mockRequest({});
    const result = parsePaginateQuery(req);
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
    expect(result.sortBy).toBeUndefined();
    expect(result.search).toBeUndefined();
    expect(result.filter).toBeUndefined();
  });

  it('should handle multiple filter values on same column', () => {
    const req = mockRequest({
      'filter.age': ['$gte:18', '$lte:65'],
    });
    const result = parsePaginateQuery(req);
    expect(result.filter).toEqual({ age: ['$gte:18', '$lte:65'] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest paginate-query.pipe --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pipe**

Create `src/pipes/paginate-query.pipe.ts`:

```typescript
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { SortOrder } from '../interfaces/filter-operator.type';

export function parsePaginateQuery(request: any): PaginateQuery {
  const query = request.query || {};
  const path = request.path || request.url || '/';

  const result: PaginateQuery = { path };

  // Page
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    result.page = isNaN(page) || page < 1 ? 1 : page;
  }

  // Limit
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    result.limit = isNaN(limit) || limit < 1 ? 1 : limit;
  }

  // SortBy
  if (query.sortBy !== undefined) {
    const sortValues = Array.isArray(query.sortBy)
      ? query.sortBy
      : [query.sortBy];
    result.sortBy = sortValues.map((s: string) => {
      const [column, order = 'ASC'] = s.split(':');
      return [column, order.toUpperCase() as SortOrder];
    });
  }

  // Search
  if (query.search !== undefined) {
    result.search = query.search;
  }

  // Filter (filter.column=value)
  const filterEntries: [string, string | string[]][] = [];
  for (const key of Object.keys(query)) {
    if (key.startsWith('filter.')) {
      const column = key.substring('filter.'.length);
      filterEntries.push([column, query[key]]);
    }
  }
  if (filterEntries.length > 0) {
    result.filter = Object.fromEntries(filterEntries);
  }

  // Select
  if (query.select !== undefined) {
    result.select =
      typeof query.select === 'string'
        ? query.select.split(',').map((s: string) => s.trim())
        : query.select;
  }

  // Cursor
  if (query.after !== undefined) {
    result.after = query.after;
  }
  if (query.before !== undefined) {
    result.before = query.before;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest paginate-query.pipe --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Create the @Paginate param decorator**

Create `src/decorators/paginate.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { parsePaginateQuery } from '../pipes/paginate-query.pipe';
import { PaginateQuery } from '../interfaces/paginate-query.interface';

export const Paginate = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PaginateQuery => {
    const request = ctx.switchToHttp().getRequest();
    return parsePaginateQuery(request);
  },
);
```

- [ ] **Step 6: Commit**

```bash
git add src/pipes/ src/decorators/paginate.decorator.ts
git commit -m "feat: add query parsing pipe and @Paginate param decorator"
```

---

### Task 11: Core paginate() — Offset Mode

**Files:**
- Create: `src/paginate.ts`
- Test: `src/__tests__/paginate-offset.spec.ts`

- [ ] **Step 1: Write failing tests for offset pagination**

Create `src/__tests__/paginate-offset.spec.ts`:

```typescript
import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
import { InvalidSortColumnError } from '../errors/invalid-sort-column.error';
import { InvalidFilterColumnError } from '../errors/invalid-filter-column.error';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  age: number;
  createdAt: Date;
}

function createMockDelegate(data: any[] = [], count: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(count),
  };
}

const baseConfig: PaginateConfig<User> = {
  sortableColumns: ['id', 'name', 'email', 'createdAt'],
};

describe('paginate — offset mode', () => {
  it('should return paginated response with meta and links', async () => {
    const mockData = [
      { id: '1', name: 'Alice', email: 'alice@test.com' },
      { id: '2', name: 'Bob', email: 'bob@test.com' },
    ];
    const delegate = createMockDelegate(mockData, 50);

    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    const result = await paginate(query, delegate, baseConfig);

    expect(result.data).toEqual(mockData);
    expect(result.meta.itemsPerPage).toBe(20);
    expect(result.meta.totalItems).toBe(50);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.totalPages).toBe(3);
  });

  it('should use default limit when not provided', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { path: '/users' };
    await paginate(query, delegate, {
      ...baseConfig,
      defaultLimit: 10,
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('should clamp limit to maxLimit', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { limit: 500, path: '/users' };
    await paginate(query, delegate, {
      ...baseConfig,
      maxLimit: 50,
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('should apply sortBy as Prisma orderBy', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = {
      sortBy: [['createdAt', 'DESC']],
      path: '/users',
    };
    await paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
  });

  it('should apply defaultSortBy when no sortBy in query', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { path: '/users' };
    await paginate(query, delegate, {
      ...baseConfig,
      defaultSortBy: [['createdAt', 'DESC']],
    });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
  });

  it('should throw InvalidSortColumnError for disallowed column', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = {
      sortBy: [['password', 'ASC']],
      path: '/users',
    };

    await expect(paginate(query, delegate, baseConfig)).rejects.toThrow(
      InvalidSortColumnError,
    );
  });

  it('should apply filters to Prisma where', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = {
      filter: { role: '$eq:admin' },
      path: '/users',
    };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      filterableColumns: { role: ['$eq', '$in'] },
    };

    await paginate(query, delegate, config);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { equals: 'admin' },
        }),
      }),
    );
  });

  it('should throw InvalidFilterColumnError for disallowed column', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = {
      filter: { secret: '$eq:val' },
      path: '/users',
    };

    await expect(
      paginate(query, delegate, { ...baseConfig, filterableColumns: {} }),
    ).rejects.toThrow(InvalidFilterColumnError);
  });

  it('should apply search as OR conditions', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { search: 'john', path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      searchableColumns: ['name', 'email'],
    };

    await paginate(query, delegate, config);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('should apply config.where as base condition', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      where: { isActive: true },
    };

    await paginate(query, delegate, config);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('should apply relations as include', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      relations: { profile: true, posts: { select: { id: true } } },
    };

    await paginate(query, delegate, config);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { profile: true, posts: { select: { id: true } } },
      }),
    );
  });

  it('should calculate correct skip value', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { page: 3, limit: 20, path: '/users' };
    await paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40 }),
    );
  });

  it('should build correct links', async () => {
    const delegate = createMockDelegate([], 100);

    const query: PaginateQuery = { page: 2, limit: 20, path: '/users' };
    const result = await paginate(query, delegate, baseConfig);

    expect(result.links.first).toBe('/users?page=1&limit=20');
    expect(result.links.previous).toBe('/users?page=1&limit=20');
    expect(result.links.current).toBe('/users?page=2&limit=20');
    expect(result.links.next).toBe('/users?page=3&limit=20');
    expect(result.links.last).toBe('/users?page=5&limit=20');
  });

  it('should run findMany and count in parallel', async () => {
    let findManyStarted = false;
    let countStartedWhileFindManyPending = false;

    const delegate = {
      findMany: jest.fn(() => {
        findManyStarted = true;
        return new Promise((resolve) =>
          setTimeout(() => resolve([]), 10),
        );
      }),
      count: jest.fn(() => {
        if (findManyStarted) countStartedWhileFindManyPending = true;
        return Promise.resolve(0);
      }),
    };

    const query: PaginateQuery = { page: 1, limit: 20, path: '/users' };
    await paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalled();
    expect(delegate.count).toHaveBeenCalled();
    expect(countStartedWhileFindManyPending).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest paginate-offset --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the core paginate function (offset mode)**

Create `src/paginate.ts`:

```typescript
import { PaginateQuery } from './interfaces/paginate-query.interface';
import { PaginateConfig } from './interfaces/paginate-config.interface';
import { Paginated, CursorPaginated } from './interfaces/paginated.interface';
import { DEFAULT_LIMIT, DEFAULT_MAX_LIMIT, DEFAULT_PAGE } from './pagination.constants';
import { parseFilters } from './filter/filter-parser';
import { validateSortColumns, buildOrderBy } from './filter/sort-builder';
import { buildSearchCondition } from './filter/search-builder';
import { buildOffsetLinks, buildCursorLinks } from './helpers/link-builder';
import { encodeCursor, decodeCursor } from './cursor/cursor.encoder';

export async function paginate<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<Paginated<T> | CursorPaginated<T>> {
  const isCursorMode =
    config.paginationType === 'cursor' ||
    query.after !== undefined ||
    query.before !== undefined;

  if (isCursorMode) {
    return paginateCursor(query, delegate, config);
  }

  return paginateOffset(query, delegate, config);
}

async function paginateOffset<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<Paginated<T>> {
  const limit = resolveLimit(query.limit, config);
  const page = query.page ?? DEFAULT_PAGE;

  const sortBy = query.sortBy ?? config.defaultSortBy;
  if (sortBy) {
    validateSortColumns(sortBy, config.sortableColumns);
  }

  const orderBy = buildOrderBy(sortBy, config.nullSort);

  const where = buildWhere(query, config);

  const findManyArgs: any = {
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  };

  if (config.relations) {
    findManyArgs.include = config.relations;
  }

  if (config.select) {
    findManyArgs.select = Object.fromEntries(
      config.select.map((col) => [col, true]),
    );
  }

  const [data, totalItems] = await Promise.all([
    delegate.findMany(findManyArgs),
    delegate.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

  return {
    data,
    meta: {
      itemsPerPage: limit,
      totalItems,
      currentPage: page,
      totalPages,
      sortBy: sortBy ?? [],
      ...(query.search && { search: query.search }),
      ...(query.filter && { filter: flattenFilter(query.filter) }),
    },
    links: buildOffsetLinks(query.path, page, limit, totalPages),
  };
}

async function paginateCursor<T>(
  query: PaginateQuery,
  delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  config: PaginateConfig<T>,
): Promise<CursorPaginated<T>> {
  const limit = resolveLimit(query.limit, config);
  const cursorColumn = (config.cursorColumn ?? 'id') as string;

  const sortBy = query.sortBy ?? config.defaultSortBy;
  if (sortBy) {
    validateSortColumns(sortBy, config.sortableColumns);
  }

  const orderBy = buildOrderBy(sortBy, config.nullSort);
  const where = buildWhere(query, config);

  const findManyArgs: any = {
    where,
    orderBy,
    take: limit + 1,
  };

  if (query.after) {
    const cursorValue = decodeCursor(query.after);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
  } else if (query.before) {
    const cursorValue = decodeCursor(query.before);
    findManyArgs.cursor = cursorValue;
    findManyArgs.skip = 1;
    findManyArgs.take = -(limit + 1);
  }

  if (config.relations) {
    findManyArgs.include = config.relations;
  }

  let data = await delegate.findMany(findManyArgs);

  const hasPreviousPage = !!query.after;
  let hasNextPage: boolean;

  if (query.before) {
    hasNextPage = true;
    if (data.length > limit) {
      data = data.slice(data.length - limit);
    }
  } else {
    hasNextPage = data.length > limit;
    if (hasNextPage) {
      data.pop();
    }
  }

  const startCursor =
    data.length > 0 ? encodeCursor(data[0] as any, cursorColumn) : null;
  const endCursor =
    data.length > 0
      ? encodeCursor(data[data.length - 1] as any, cursorColumn)
      : null;

  const meta: CursorPaginated<T>['meta'] = {
    itemsPerPage: limit,
    hasNextPage,
    hasPreviousPage,
    startCursor,
    endCursor,
    sortBy: sortBy ?? [],
    ...(query.search && { search: query.search }),
    ...(query.filter && { filter: flattenFilter(query.filter) }),
  };

  if (config.withTotalCount) {
    meta.totalItems = await delegate.count({ where });
  }

  return {
    data,
    meta,
    links: buildCursorLinks(
      query.path,
      limit,
      endCursor,
      startCursor,
      hasNextPage,
      hasPreviousPage,
    ),
  };
}

function buildWhere<T>(
  query: PaginateQuery,
  config: PaginateConfig<T>,
): Record<string, any> {
  const where: Record<string, any> = { ...((config.where as any) ?? {}) };

  if (query.filter && config.filterableColumns) {
    const filterWhere = parseFilters(query.filter, config.filterableColumns);
    Object.assign(where, filterWhere);
  }

  if (query.search && config.searchableColumns) {
    const searchWhere = buildSearchCondition(
      query.search,
      config.searchableColumns,
    );
    Object.assign(where, searchWhere);
  }

  return where;
}

function resolveLimit<T>(
  queryLimit: number | undefined,
  config: PaginateConfig<T>,
): number {
  const defaultLimit = config.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = config.maxLimit ?? DEFAULT_MAX_LIMIT;
  const limit = queryLimit ?? defaultLimit;
  return Math.min(Math.max(limit, 1), maxLimit);
}

function flattenFilter(
  filter: Record<string, string | string[]>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    flat[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return flat;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest paginate-offset --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/paginate.ts src/__tests__/paginate-offset.spec.ts
git commit -m "feat: implement core paginate function with offset mode"
```

---

### Task 12: Core paginate() — Cursor Mode

**Files:**
- Modify: `src/paginate.ts` (already contains cursor logic from Task 11)
- Test: `src/__tests__/paginate-cursor.spec.ts`

- [ ] **Step 1: Write failing tests for cursor pagination**

Create `src/__tests__/paginate-cursor.spec.ts`:

```typescript
import { paginate } from '../paginate';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function createMockDelegate(data: any[] = [], count: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(count),
  };
}

const baseConfig: PaginateConfig<User> = {
  sortableColumns: ['id', 'name', 'createdAt'],
  paginationType: 'cursor',
};

function encodeCursorValue(obj: Record<string, any>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

describe('paginate — cursor mode', () => {
  it('should return cursor-paginated response', async () => {
    const mockData = Array.from({ length: 21 }, (_, i) => ({
      id: String(i + 1),
      name: `User ${i + 1}`,
    }));
    const delegate = createMockDelegate(mockData, 50);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = await paginate(query, delegate, baseConfig);

    expect('hasNextPage' in result.meta).toBe(true);
    const cursorResult = result as any;
    expect(cursorResult.meta.hasNextPage).toBe(true);
    expect(cursorResult.data).toHaveLength(20);
  });

  it('should detect no next page when data.length <= limit', async () => {
    const mockData = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      name: `User ${i + 1}`,
    }));
    const delegate = createMockDelegate(mockData, 5);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;

    expect(result.meta.hasNextPage).toBe(false);
    expect(result.data).toHaveLength(5);
  });

  it('should use after cursor', async () => {
    const mockData = [{ id: '11', name: 'User 11' }];
    const delegate = createMockDelegate(mockData, 50);

    const afterCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = {
      limit: 20,
      after: afterCursor,
      path: '/users',
    };
    await paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: '10' },
        skip: 1,
      }),
    );
  });

  it('should use before cursor with negative take', async () => {
    const mockData = [{ id: '5', name: 'User 5' }];
    const delegate = createMockDelegate(mockData, 50);

    const beforeCursor = encodeCursorValue({ id: '10' });
    const query: PaginateQuery = {
      limit: 20,
      before: beforeCursor,
      path: '/users',
    };
    await paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: '10' },
        skip: 1,
        take: -21,
      }),
    );
  });

  it('should generate startCursor and endCursor', async () => {
    const mockData = [
      { id: '10', name: 'User 10' },
      { id: '11', name: 'User 11' },
    ];
    const delegate = createMockDelegate(mockData, 50);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;

    expect(result.meta.startCursor).toBe(encodeCursorValue({ id: '10' }));
    expect(result.meta.endCursor).toBe(encodeCursorValue({ id: '11' }));
  });

  it('should return null cursors for empty data', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;

    expect(result.meta.startCursor).toBeNull();
    expect(result.meta.endCursor).toBeNull();
  });

  it('should not include totalItems by default', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, baseConfig)) as any;

    expect(result.meta.totalItems).toBeUndefined();
    expect(delegate.count).not.toHaveBeenCalled();
  });

  it('should include totalItems when withTotalCount is true', async () => {
    const delegate = createMockDelegate([], 0);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const result = (await paginate(query, delegate, {
      ...baseConfig,
      withTotalCount: true,
    })) as any;

    expect(result.meta.totalItems).toBe(0);
    expect(delegate.count).toHaveBeenCalled();
  });

  it('should auto-detect cursor mode from after param', async () => {
    const delegate = createMockDelegate([{ id: '1' }], 1);

    const afterCursor = encodeCursorValue({ id: '0' });
    const query: PaginateQuery = {
      limit: 20,
      after: afterCursor,
      path: '/users',
    };

    const config: PaginateConfig<User> = {
      sortableColumns: ['id'],
      // No explicit paginationType — should auto-detect from after param
    };

    const result = await paginate(query, delegate, config);
    expect('hasNextPage' in result.meta).toBe(true);
  });

  it('should use custom cursorColumn', async () => {
    const mockData = [{ id: '1', createdAt: new Date('2024-01-01') }];
    const delegate = createMockDelegate(mockData, 1);

    const query: PaginateQuery = { limit: 20, path: '/users' };
    const config: PaginateConfig<User> = {
      ...baseConfig,
      cursorColumn: 'createdAt',
    };
    const result = (await paginate(query, delegate, config)) as any;

    const decoded = JSON.parse(
      Buffer.from(result.meta.startCursor, 'base64url').toString(),
    );
    expect(decoded).toHaveProperty('createdAt');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest paginate-cursor --no-coverage`
Expected: All PASS (implementation already included in Task 11's `paginate.ts`).

If any tests fail, adjust the `paginateCursor` function in `src/paginate.ts` accordingly.

- [ ] **Step 3: Run all tests**

Run: `npx jest --no-coverage`
Expected: All test suites PASS.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/paginate-cursor.spec.ts
git commit -m "test: add cursor pagination tests"
```

---

### Task 13: Decorators — @PaginateDefaults & Swagger

**Files:**
- Create: `src/decorators/paginate-defaults.decorator.ts`
- Create: `src/decorators/api-paginated-response.decorator.ts`
- Test: `src/decorators/__tests__/paginate-defaults.spec.ts`
- Test: `src/decorators/__tests__/api-paginated-response.spec.ts`

- [ ] **Step 1: Write failing test for @PaginateDefaults**

Create `src/decorators/__tests__/paginate-defaults.spec.ts`:

```typescript
import { PAGINATE_DEFAULTS_KEY } from '../paginate-defaults.decorator';

describe('@PaginateDefaults', () => {
  it('should store defaults as metadata', async () => {
    // Dynamic import to avoid issues with decorator loading
    const { PaginateDefaults } = await import(
      '../paginate-defaults.decorator'
    );

    class TestController {
      @PaginateDefaults({ defaultLimit: 10, maxLimit: 50 })
      findAll() {}
    }

    const metadata = Reflect.getMetadata(
      PAGINATE_DEFAULTS_KEY,
      TestController.prototype.findAll,
    );
    expect(metadata).toEqual({ defaultLimit: 10, maxLimit: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest paginate-defaults --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement @PaginateDefaults**

Create `src/decorators/paginate-defaults.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import { PaginateConfig } from '../interfaces/paginate-config.interface';

export const PAGINATE_DEFAULTS_KEY = 'PAGINATE_DEFAULTS';

export const PaginateDefaults = (
  defaults: Partial<Pick<PaginateConfig, 'defaultLimit' | 'maxLimit'>>,
) => SetMetadata(PAGINATE_DEFAULTS_KEY, defaults);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest paginate-defaults --no-coverage`
Expected: PASS.

- [ ] **Step 5: Write test for Swagger decorators**

Create `src/decorators/__tests__/api-paginated-response.spec.ts`:

```typescript
describe('ApiPaginatedResponse', () => {
  it('should export ApiPaginatedResponse function', async () => {
    const mod = await import('../api-paginated-response.decorator');
    expect(typeof mod.ApiPaginatedResponse).toBe('function');
  });

  it('should export ApiCursorPaginatedResponse function', async () => {
    const mod = await import('../api-paginated-response.decorator');
    expect(typeof mod.ApiCursorPaginatedResponse).toBe('function');
  });

  it('should return a decorator function', async () => {
    const mod = await import('../api-paginated-response.decorator');

    class TestDto {
      id!: string;
    }

    const decorator = mod.ApiPaginatedResponse(TestDto);
    expect(typeof decorator).toBe('function');
  });
});
```

- [ ] **Step 6: Implement Swagger decorators with optional @nestjs/swagger support**

Create `src/decorators/api-paginated-response.decorator.ts`:

```typescript
import { Type, applyDecorators } from '@nestjs/common';

let swagger: any;
try {
  swagger = require('@nestjs/swagger');
} catch {
  // @nestjs/swagger not installed — decorators become no-ops
}

export function ApiPaginatedResponse(dataDto: Type): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, ApiQuery, getSchemaPath } = swagger;

  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
              meta: {
                type: 'object',
                properties: {
                  itemsPerPage: { type: 'number', example: 20 },
                  totalItems: { type: 'number', example: 500 },
                  currentPage: { type: 'number', example: 1 },
                  totalPages: { type: 'number', example: 25 },
                  sortBy: {
                    type: 'array',
                    example: [['createdAt', 'DESC']],
                  },
                },
              },
              links: {
                type: 'object',
                properties: {
                  first: { type: 'string' },
                  previous: { type: 'string', nullable: true },
                  current: { type: 'string' },
                  next: { type: 'string', nullable: true },
                  last: { type: 'string' },
                },
              },
            },
          },
        ],
      },
    }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      isArray: true,
    }),
    ApiQuery({ name: 'search', required: false, type: String }),
  );
}

export function ApiCursorPaginatedResponse(dataDto: Type): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, ApiQuery, getSchemaPath } = swagger;

  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
              meta: {
                type: 'object',
                properties: {
                  itemsPerPage: { type: 'number', example: 20 },
                  hasNextPage: { type: 'boolean', example: true },
                  hasPreviousPage: { type: 'boolean', example: false },
                  startCursor: { type: 'string', nullable: true },
                  endCursor: { type: 'string', nullable: true },
                  sortBy: {
                    type: 'array',
                    example: [['createdAt', 'DESC']],
                  },
                },
              },
              links: {
                type: 'object',
                properties: {
                  current: { type: 'string' },
                  next: { type: 'string', nullable: true },
                  previous: { type: 'string', nullable: true },
                },
              },
            },
          },
        ],
      },
    }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'after', required: false, type: String }),
    ApiQuery({ name: 'before', required: false, type: String }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      isArray: true,
    }),
    ApiQuery({ name: 'search', required: false, type: String }),
  );
}
```

- [ ] **Step 7: Run all decorator tests**

Run: `npx jest decorators --no-coverage`
Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/decorators/
git commit -m "feat: add @PaginateDefaults and Swagger response decorators"
```

---

### Task 14: PaginationModule

**Files:**
- Create: `src/pagination.module.ts`
- Test: `src/__tests__/pagination.module.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/pagination.module.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PaginationModule } from '../pagination.module';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';

describe('PaginationModule', () => {
  it('should create module with forRoot', async () => {
    const module = await Test.createTestingModule({
      imports: [
        PaginationModule.forRoot({
          defaultLimit: 10,
          maxLimit: 50,
        }),
      ],
    }).compile();

    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(10);
    expect(options.maxLimit).toBe(50);
  });

  it('should create module with forRoot using defaults', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot()],
    }).compile();

    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options).toBeDefined();
  });

  it('should create module with forRootAsync', async () => {
    const module = await Test.createTestingModule({
      imports: [
        PaginationModule.forRootAsync({
          useFactory: () => ({
            defaultLimit: 15,
            maxLimit: 75,
          }),
        }),
      ],
    }).compile();

    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(15);
    expect(options.maxLimit).toBe(75);
  });

  it('should make options globally available', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 25 })],
    }).compile();

    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(25);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest pagination.module --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PaginationModule**

Create `src/pagination.module.ts`:

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { PAGINATION_MODULE_OPTIONS } from './pagination.constants';
import {
  PaginationModuleOptions,
  PaginationModuleAsyncOptions,
} from './interfaces/pagination-options.interface';

@Module({})
export class PaginationModule {
  static forRoot(options?: PaginationModuleOptions): DynamicModule {
    return {
      module: PaginationModule,
      global: true,
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useValue: options ?? {},
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: PaginationModuleAsyncOptions): DynamicModule {
    return {
      module: PaginationModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest pagination.module --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pagination.module.ts src/__tests__/pagination.module.spec.ts
git commit -m "feat: add PaginationModule with forRoot/forRootAsync"
```

---

### Task 15: Testing Utilities

**Files:**
- Create: `src/testing/create-paginate-query.ts`
- Create: `src/testing/test-pagination.module.ts`
- Create: `src/testing/index.ts`
- Test: `src/testing/__tests__/create-paginate-query.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/testing/__tests__/create-paginate-query.spec.ts`:

```typescript
import { createPaginateQuery } from '../create-paginate-query';

describe('createPaginateQuery', () => {
  it('should create a PaginateQuery with defaults', () => {
    const query = createPaginateQuery();
    expect(query.path).toBe('/');
  });

  it('should override defaults with provided values', () => {
    const query = createPaginateQuery({
      page: 2,
      limit: 10,
      sortBy: [['createdAt', 'DESC']],
      search: 'john',
      path: '/users',
    });

    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.sortBy).toEqual([['createdAt', 'DESC']]);
    expect(query.search).toBe('john');
    expect(query.path).toBe('/users');
  });

  it('should include filter when provided', () => {
    const query = createPaginateQuery({
      filter: { role: '$eq:admin' },
      path: '/users',
    });

    expect(query.filter).toEqual({ role: '$eq:admin' });
  });

  it('should include cursor params when provided', () => {
    const query = createPaginateQuery({
      after: 'abc123',
      limit: 20,
      path: '/items',
    });

    expect(query.after).toBe('abc123');
    expect(query.page).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest create-paginate-query --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement testing utilities**

Create `src/testing/create-paginate-query.ts`:

```typescript
import { PaginateQuery } from '../interfaces/paginate-query.interface';

export function createPaginateQuery(
  overrides: Partial<PaginateQuery> = {},
): PaginateQuery {
  return {
    path: '/',
    ...overrides,
  };
}
```

Create `src/testing/test-pagination.module.ts`:

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';
import { PaginationModuleOptions } from '../interfaces/pagination-options.interface';

@Module({})
export class TestPaginationModule {
  static register(options?: PaginationModuleOptions): DynamicModule {
    return {
      module: TestPaginationModule,
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useValue: options ?? {},
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }
}
```

Create `src/testing/index.ts`:

```typescript
export { createPaginateQuery } from './create-paginate-query';
export { TestPaginationModule } from './test-pagination.module';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest create-paginate-query --no-coverage`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/testing/
git commit -m "feat: add testing utilities (createPaginateQuery, TestPaginationModule)"
```

---

### Task 16: Barrel Exports & Build Verification

**Files:**
- Create: `src/index.ts`
- Verify: `npm run build`
- Verify: `npm test`

- [ ] **Step 1: Create barrel export**

Create `src/index.ts`:

```typescript
// Core Module
export { PaginationModule } from './pagination.module';
export {
  PaginationModuleOptions,
  PaginationModuleAsyncOptions,
} from './interfaces/pagination-options.interface';

// Core Function
export { paginate } from './paginate';

// Interfaces
export { PaginateQuery } from './interfaces/paginate-query.interface';
export { PaginateConfig } from './interfaces/paginate-config.interface';
export {
  Paginated,
  CursorPaginated,
} from './interfaces/paginated.interface';
export { FilterOperator, SortOrder } from './interfaces/filter-operator.type';

// Decorators
export { Paginate } from './decorators/paginate.decorator';
export {
  PaginateDefaults,
  PAGINATE_DEFAULTS_KEY,
} from './decorators/paginate-defaults.decorator';
export {
  ApiPaginatedResponse,
  ApiCursorPaginatedResponse,
} from './decorators/api-paginated-response.decorator';

// Errors
export { InvalidSortColumnError } from './errors/invalid-sort-column.error';
export { InvalidFilterColumnError } from './errors/invalid-filter-column.error';
export { InvalidCursorError } from './errors/invalid-cursor.error';

// Constants
export { PAGINATION_MODULE_OPTIONS } from './pagination.constants';
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: All test suites PASS, 0 failures.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, `dist/` directory created with `.js` and `.d.ts` files.

- [ ] **Step 4: Verify dist structure**

Run: `ls dist/index.js dist/index.d.ts dist/testing/index.js dist/testing/index.d.ts`
Expected: All four files exist.

- [ ] **Step 5: Run test coverage**

Run: `npm run test:cov`
Expected: 90%+ overall coverage.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: add barrel exports and verify build"
```

---

## Dependency Graph

```
Task 1  (scaffolding)
  └→ Task 2  (types/interfaces/constants)
       └→ Task 3  (errors)
       └→ Task 4  (cursor encoder)
       └→ Task 5  (type coercion)
            └→ Task 6  (filter parser)          ← depends on errors, type-coercion
       └→ Task 7  (sort builder)                ← depends on errors
       └→ Task 8  (search builder)
       └→ Task 9  (link builder)
       └→ Task 10 (pipe + @Paginate)
            └→ Task 11 (paginate offset)        ← depends on 6,7,8,9
                 └→ Task 12 (paginate cursor)   ← depends on 4,11
       └→ Task 13 (decorators)
       └→ Task 14 (PaginationModule)
       └→ Task 15 (testing utilities)
            └→ Task 16 (barrel exports + build)  ← depends on all
```

Tasks 3-10 can be parallelized (independent of each other, all depend only on Task 2).
Tasks 11-15 can be partially parallelized (13, 14, 15 are independent of 11/12).
Task 16 must be last.
