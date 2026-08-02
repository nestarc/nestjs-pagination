# @nestarc/pagination

[![npm version](https://img.shields.io/npm/v/@nestarc/pagination.svg)](https://www.npmjs.com/package/@nestarc/pagination)
[![npm downloads](https://img.shields.io/npm/dm/@nestarc/pagination.svg)](https://www.npmjs.com/package/@nestarc/pagination)
[![CI](https://github.com/nestarc/nestjs-pagination/actions/workflows/ci.yml/badge.svg)](https://github.com/nestarc/nestjs-pagination/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-nestarc.dev-blue.svg)](https://nestarc.dev/packages/pagination/)

Prisma cursor & offset pagination for NestJS with filtering, sorting, search, and Swagger auto-documentation.

## Features

- **Offset + cursor** pagination in a single API
- **12 filter operators**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$ilike`, `$btw`, `$null`, `$not:null`
- **Multi-column sorting** with null positioning
- **Case-insensitive contains search** across multiple columns
- **Column/operator whitelisting** for security
- **Swagger** auto-documentation (optional)
- **Standalone** `paginate()` function — works without NestJS
- **Prisma 7-first** compatibility, with Prisma 5 and 6 retained in the peer range
- Compatible with `@nestarc/tenancy` (RLS) and `@nestarc/soft-delete` via Prisma extension chain

## Quick Start

### Install

```bash
npm install @nestarc/pagination
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `@prisma/client` 5/6/7, `reflect-metadata`, `rxjs`

Prisma 7 is the primary generated-client and CI target. Prisma 5 and 6 remain accepted peer versions for existing applications.

### 1. Register the module

```typescript
import { PaginationModule } from '@nestarc/pagination';

@Module({
  imports: [
    PaginationModule.forRoot({
      defaultLimit: 20,
      maxLimit: 100,
    }),
  ],
})
export class AppModule {}
```

### 2. Use in a controller

```typescript
import { Paginate, PaginateQuery, ApiPaginatedResponse } from '@nestarc/pagination';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiPaginatedResponse(UserDto)
  async findAll(@Paginate() query: PaginateQuery) {
    return this.userService.findAll(query);
  }
}
```

### 3. Use in a service

```typescript
import { paginate, PaginateQuery } from '@nestarc/pagination';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginateQuery) {
    return paginate(query, this.prisma.user, {
      sortableColumns: ['id', 'name', 'email', 'createdAt'],
      defaultSortBy: [['createdAt', 'DESC']],
      searchableColumns: ['name', 'email'],
      filterableColumns: {
        role: ['$eq', '$in'],
        createdAt: ['$gte', '$lte'],
      },
    });
  }
}
```

## Query Parameters

### Offset

```
GET /users?page=2&limit=20&sortBy=createdAt:DESC&search=john&filter.role=$eq:admin
```

| Param | Description | Example |
|-------|-------------|---------|
| `page` | Page number (1-based) | `2` |
| `limit` | Items per page | `20` |
| `sortBy` | Sort (multi allowed) | `createdAt:DESC` |
| `search` | Case-insensitive contains search | `john` |
| `filter.{col}` | Filter by column | `filter.role=$eq:admin` |

### Cursor

```
GET /users?limit=20&after=eyJpZCI6IjEwIn0&sortBy=createdAt:DESC
```

| Param | Description | Example |
|-------|-------------|---------|
| `limit` | Items per page | `20` |
| `after` | Forward cursor (Base64url) | `eyJpZCI6IjEwIn0` |
| `before` | Backward cursor | `eyJpZCI6NX0` |
| `sortBy` | Sort | `createdAt:DESC` |

Cursor mode activates automatically when `after`/`before` is present or `paginationType: 'cursor'` is set.

## Filter Operators

| Operator | Prisma | Example |
|----------|--------|---------|
| `$eq` | `{ equals }` | `filter.role=$eq:admin` |
| `$ne` | `{ not }` | `filter.status=$ne:deleted` |
| `$gt` | `{ gt }` | `filter.age=$gt:18` |
| `$gte` | `{ gte }` | `filter.age=$gte:18` |
| `$lt` | `{ lt }` | `filter.price=$lt:100` |
| `$lte` | `{ lte }` | `filter.price=$lte:100` |
| `$in` | `{ in }` | `filter.role=$in:admin,user` |
| `$nin` | `{ notIn }` | `filter.role=$nin:banned` |
| `$ilike` | `{ contains, mode: 'insensitive' }` | `filter.name=$ilike:john` |
| `$btw` | `{ gte, lte }` | `filter.price=$btw:10,100` |
| `$null` | `null` | `filter.deletedAt=$null` |
| `$not:null` | `{ not: null }` | `filter.verifiedAt=$not:null` |

## Response Format

### Offset

```json
{
  "data": [{ "id": "1", "name": "Alice" }],
  "meta": {
    "itemsPerPage": 20,
    "totalItems": 500,
    "currentPage": 1,
    "totalPages": 25,
    "sortBy": [["createdAt", "DESC"]]
  },
  "links": {
    "first": "/users?page=1&limit=20&sortBy=createdAt%3ADESC",
    "previous": null,
    "current": "/users?page=1&limit=20&sortBy=createdAt%3ADESC",
    "next": "/users?page=2&limit=20&sortBy=createdAt%3ADESC",
    "last": "/users?page=25&limit=20&sortBy=createdAt%3ADESC"
  }
}
```

### Cursor

```json
{
  "data": [{ "id": "10", "name": "Bob" }],
  "meta": {
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPreviousPage": true,
    "startCursor": "eyJpZCI6IjEwIn0",
    "endCursor": "eyJpZCI6IjI5In0",
    "sortBy": [["createdAt", "DESC"]]
  },
  "links": {
    "current": "/users?limit=20&after=eyJpZCI6IjEwIn0",
    "next": "/users?limit=20&after=eyJpZCI6IjI5In0",
    "previous": "/users?limit=20&before=eyJpZCI6IjEwIn0"
  }
}
```

## PaginateConfig

```typescript
const config: PaginateConfig<User> = {
  // Required
  sortableColumns: ['id', 'name', 'email', 'createdAt'],

  // Sorting
  defaultSortBy: [['createdAt', 'DESC']],
  nullSort: 'last',

  // Search
  searchableColumns: ['name', 'email'],

  // Filtering
  filterableColumns: {
    role: ['$eq', '$in'],
    age: ['$gt', '$gte', '$lt', '$lte'],
    createdAt: ['$gte', '$lte', '$btw'],
  },

  // Relations (Prisma include)
  relations: { profile: true },

  // Column selection (Prisma select)
  select: ['id', 'name', 'email'],

  // Pagination
  paginationType: 'offset',     // 'offset' | 'cursor'
  cursorColumn: 'id',            // default: 'id'
  cursorStrategy: 'prisma',      // 'prisma' | 'keyset'
  cursorColumns: ['createdAt', 'id'],
  defaultLimit: 20,
  maxLimit: 100,
  withTotalCount: false,         // cursor mode: include total count
  countStrategy: 'exact',        // 'exact' | 'none' | 'custom'

  // Base where condition
  where: { isActive: true },
};
```

> When both `select` and `relations` are set, relations are merged into the select object to avoid Prisma's include/select conflict.

## Module Options

### forRoot

```typescript
PaginationModule.forRoot({
  defaultLimit: 20,
  maxLimit: 100,
  defaultPaginationType: 'offset',
  defaultSortBy: [['createdAt', 'DESC']],
})
```

### forRootAsync

```typescript
PaginationModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    defaultLimit: config.get('PAGINATION_DEFAULT_LIMIT', 20),
    maxLimit: config.get('PAGINATION_MAX_LIMIT', 100),
  }),
  inject: [ConfigService],
})
```

## PaginateService

`PaginateService` merges module options, `@PaginateDefaults` metadata, and per-endpoint config (highest priority wins):

```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginateService: PaginateService,
  ) {}

  @Get()
  @PaginateDefaults({ defaultLimit: 10, maxLimit: 50 })
  async findAll(@Paginate() query: PaginateQuery) {
    return this.paginateService.paginate(
      query,
      this.prisma.user,
      { sortableColumns: ['id', 'name', 'createdAt'] },
      this.findAll,
    );
  }
}
```

Priority: `config` (per-endpoint) > `@PaginateDefaults` (per-handler) > `forRoot()` (global)

## Swagger

Install `@nestjs/swagger` (optional peer dependency) for auto-documentation:

```typescript
@Get()
@ApiPaginatedResponse(UserDto)          // offset response schema
async findAll(@Paginate() query: PaginateQuery) { ... }

@Get('stream')
@ApiCursorPaginatedResponse(UserDto)    // cursor response schema
async findAllCursor(@Paginate() query: PaginateQuery) { ... }
```

Decorators can document endpoint-specific query capabilities:

```typescript
@Get()
@ApiPaginatedResponse(UserDto, {
  sortableColumns: ['id', 'email', 'createdAt'],
  searchableColumns: ['email', 'name'],
  filterableColumns: {
    role: ['$eq', '$in'],
    createdAt: ['$gte', '$lte', '$btw'],
  },
  allowWithDeleted: true,
})
async findAll(@Paginate() query: PaginateQuery) { ... }
```

If `@nestjs/swagger` is not installed, decorators are no-ops.

## Keyset Cursor Strategy

Use Prisma cursor mode for simple unique cursor columns such as `id`. Use keyset mode when the list is sorted by a non-unique column and needs a stable tie-breaker:

```typescript
const result = await paginate(query, this.prisma.user, {
  sortableColumns: ['id', 'createdAt', 'email'],
  paginationType: 'cursor',
  cursorStrategy: 'keyset',
  cursorColumns: ['createdAt', 'id'],
  defaultSortBy: [['createdAt', 'DESC'], ['id', 'DESC']],
});
```

For best performance, add a matching database index for the sort tuple, for example `(createdAt DESC, id DESC)`. Cursor columns should be stable and should not change while clients page through a list.

## Count Strategy

Exact counts are useful for offset UIs, but can be expensive on large filtered lists. Configure the count policy per endpoint:

```typescript
await paginate(query, this.prisma.user, {
  sortableColumns: ['id', 'createdAt'],
  countStrategy: 'none', // omit totalItems and totalPages
});

await paginate(query, this.prisma.user, {
  sortableColumns: ['id', 'createdAt'],
  countStrategy: 'custom',
  countQuery: ({ delegate, where }) => delegate.count({ where }),
});
```

Defaults: offset uses `exact`; cursor uses `none` unless `withTotalCount: true` or `countStrategy: 'exact'` is set.

## Soft Delete

`withDeleted` is parsed from the query string and passed through only when the endpoint opts in:

```typescript
await paginate(query, this.prisma.user, {
  sortableColumns: ['id', 'createdAt'],
  allowWithDeleted: true,
});
```

`GET /users?withDeleted=true` passes `withDeleted: true` to `findMany` and `count`. The soft-delete Prisma extension remains responsible for interpreting that flag.

## Standalone Usage

`paginate()` works without NestJS:

For a direct PostgreSQL connection with Prisma 7, install `@prisma/adapter-pg` and `pg` alongside your generated client.

```typescript
import { paginate } from '@nestarc/pagination';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const result = await paginate(
  { page: 1, limit: 20, path: '/users' },
  prisma.user,
  { sortableColumns: ['id', 'name', 'createdAt'] },
);
```

## Testing Utilities

```typescript
import { createPaginateQuery, TestPaginationModule } from '@nestarc/pagination/testing';

// Test module
const module = await Test.createTestingModule({
  imports: [TestPaginationModule.register({ defaultLimit: 10 })],
  providers: [UserService],
}).compile();

// Query factory
const query = createPaginateQuery({
  page: 1,
  limit: 10,
  sortBy: [['createdAt', 'DESC']],
  path: '/users',
});
```

## Error Handling

| Error | Status | When |
|-------|--------|------|
| `InvalidSortColumnError` | 400 | Sort column not in `sortableColumns` |
| `InvalidFilterColumnError` | 400 | Filter column not in `filterableColumns` or operator not allowed |
| `InvalidCursorError` | 400 | Invalid Base64url cursor |

Unknown sort/filter columns throw errors (not silently ignored) to prevent clients from trusting incorrect results.

## Performance

Measured with PostgreSQL 16, Prisma 7.9.1, 10,000 rows, 200 iterations on Apple Silicon:

| Scenario | Avg | P50 | P95 | P99 |
|----------|-----|-----|-----|-----|
| Offset — page 1 | 1.04ms | 1.03ms | 1.21ms | 1.27ms |
| Offset — page 100 | 2.61ms | 2.53ms | 2.94ms | 4.67ms |
| **Cursor — first page (sort by id)** | **0.56ms** | **0.53ms** | **0.76ms** | **1.01ms** |
| **Cursor — deep page (sort by id)** | **0.58ms** | **0.55ms** | **0.78ms** | **0.92ms** |
| Cursor — deep page (sort by createdAt) | 11.05ms | 11.06ms | 11.51ms | 11.70ms |
| Filtered + sorted | 0.92ms | 0.92ms | 1.16ms | 1.29ms |
| Case-insensitive contains search | 8.55ms | 8.35ms | 10.70ms | 13.31ms |

Cursor + PK sort stays near **0.58ms** at depth and is 78% faster than deep offset in this run. **Note:** Cursor with non-PK sort columns (e.g. `createdAt`) triggers a Prisma subquery — use offset or keyset pagination for non-PK ordering.

Decision guide:

| Need | Recommended mode |
|------|------------------|
| Jump to arbitrary page | Offset |
| Infinite scroll by unique `id` | Prisma cursor |
| Infinite scroll by `createdAt`, `name`, or another non-unique sort | Keyset cursor with tie-breaker |
| Avoid expensive totals | Cursor or `countStrategy: 'none'` |

> Reproduce: `docker compose up -d && npm run bench`

## License

MIT
