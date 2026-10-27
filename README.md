# @nestarc/pagination

[![npm version](https://img.shields.io/npm/v/@nestarc/pagination.svg)](https://www.npmjs.com/package/@nestarc/pagination)
[![npm downloads](https://img.shields.io/npm/dm/@nestarc/pagination.svg)](https://www.npmjs.com/package/@nestarc/pagination)
[![CI](https://github.com/nestarc/nestjs-pagination/actions/workflows/ci.yml/badge.svg)](https://github.com/nestarc/nestjs-pagination/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-nestarc.dev-blue.svg)](https://nestarc.dev/packages/pagination/)

Prisma cursor & offset pagination for NestJS with filtering, sorting, search, and Swagger auto-documentation.

## Features

- **Offset + cursor** pagination in a single API
- **Composite keyset cursors** with stable tie-breakers and forward/backward navigation
- **Count strategies** — exact totals, omitted totals, or a custom count callback
- **12 filter operators**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$ilike`, `$btw`, `$null`, `$not:null`
- **Multi-column sorting** with null positioning
- **Case-insensitive contains search** across multiple columns
- **Column/operator whitelisting** for security
- **Swagger** auto-documentation (optional)
- **Standalone** `paginate()` function — callable without NestJS module registration
- **Prisma 7-first** compatibility, with Prisma 5 and 6 retained in the peer range
- Compatible with `@nestarc/tenancy` (RLS) and `@nestarc/soft-delete` via Prisma extension chain

## Upgrading to 0.3.1

Version 0.3.1 fixes keyset navigation, cursor projection, and Nest module count defaults. See the [changelog](CHANGELOG.md) for the full release notes.

- Keyset `before` returns the immediately preceding page in the requested sort order. Exact totals cover the full filtered list on every page.
- All effective sort fields are included in keyset cursors. Restart pagination if a cursor issued by an older version lacks a sort value. Fields fetched only to build a cursor are excluded from response `data`.
- Calls through `PaginateService` now honor module-level `withTotalCount: true`. Use an endpoint override of `withTotalCount: false` or `countStrategy: 'none'` when cursor totals are unnecessary. Standalone `paginate()` still requires explicit configuration.
- Requests must use only one of `after` and `before`; supplying both returns HTTP 400. The unused `withLinks` and `fieldNamingStrategy` module options are deprecated.

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
import { PaginateService, PaginateQuery } from '@nestarc/pagination';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginateService,
  ) {}

  async findAll(query: PaginateQuery) {
    return this.pagination.paginate(query, this.prisma.user, {
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

Use the injected `PaginateService` to apply the defaults registered with `PaginationModule`. The standalone `paginate()` function only uses the config passed to that call and the library's built-in defaults.

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
GET /users?limit=20&after=eyJpZCI6IjEwIn0&sortBy=id:ASC
```

| Param | Description | Example |
|-------|-------------|---------|
| `limit` | Items per page | `20` |
| `after` | Forward cursor (Base64url) | `eyJpZCI6IjEwIn0` |
| `before` | Backward cursor | `eyJpZCI6IjUifQ` |
| `sortBy` | Sort | `id:ASC` |

Cursor mode activates automatically when `after`/`before` is present or `paginationType: 'cursor'` is set.

Supply either `after` or `before` in a request. Supplying both returns `400 Bad Request`.

The example uses the default Prisma cursor strategy. Treat response cursors as opaque values and reuse them unchanged. For multi-column ordering, configure the [keyset strategy](#keyset-cursor-strategy).

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

Example for Prisma cursor mode, sorted by `id ASC`, with `limit=2` and a cursor after ID `9`:

```json
{
  "data": [{ "id": "10", "name": "Bob" }, { "id": "11", "name": "Carol" }],
  "meta": {
    "itemsPerPage": 2,
    "hasNextPage": true,
    "hasPreviousPage": true,
    "startCursor": "eyJpZCI6IjEwIn0",
    "endCursor": "eyJpZCI6IjExIn0",
    "sortBy": [["id", "ASC"]]
  },
  "links": {
    "current": "/users?limit=2&after=eyJpZCI6IjkifQ&sortBy=id%3AASC",
    "next": "/users?limit=2&after=eyJpZCI6IjExIn0&sortBy=id%3AASC",
    "previous": "/users?limit=2&before=eyJpZCI6IjEwIn0&sortBy=id%3AASC"
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
  withTotalCount: false,         // cursor default when countStrategy is omitted
  countStrategy: 'exact',        // 'exact' | 'none' | 'custom'; overrides withTotalCount

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
  withTotalCount: true, // include totals by default for cursor endpoints
})
```

These defaults apply to calls through the injected `PaginateService`. Each Nest application keeps its own configuration; registering a module does not change the standalone function.

`withTotalCount` can be overridden per endpoint, including with `false` to omit cursor totals. An explicit endpoint `countStrategy` takes precedence. Offset pagination still counts by default; use `countStrategy: 'none'` to omit its totals.

The legacy module options `withLinks` and `fieldNamingStrategy` are deprecated and have no effect. Responses always include `links`, and metadata uses camelCase.

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

`@PaginateDefaults` supports limits, sort order, and pagination type. Pass the decorated handler as the fourth argument, as shown above, to apply its metadata. `withTotalCount` is resolved from endpoint config and module options.

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

The effective sort order must uniquely identify each row. Include a unique tie-breaker such as `id` in `cursorColumns`; missing cursor columns are appended to the requested sort order using its last direction. Every cursor column must also appear in `sortableColumns`. Use non-null scalar sort columns: keyset pagination does not support traversal across null sort values.

Use `after: result.meta.endCursor` for the next page and `before: result.meta.startCursor` for the immediately preceding page. Returned rows keep the requested sort order in both directions. Keep the same sort and filters when following a cursor. Keyset boundaries contain field values, so deleting the boundary row does not prevent subsequent navigation. Concurrent changes can still affect the result set; paging is not a database snapshot.

Keyset cursors include values for every effective sort column, including client-selected sort columns. When `select` omits a required cursor field, the library fetches it internally and removes it from the returned `data`. Its value is still present in the cursor: default cursors are Base64url-encoded JSON, not encrypted. Choose sortable fields that are appropriate to expose to the client.

## Count Strategy

Exact counts are useful for offset UIs, but can be expensive on large filtered lists. Configure the count policy per endpoint:

| Strategy | Behavior |
|----------|----------|
| `exact` | Calls `delegate.count` with the base conditions, filters, and search |
| `none` | Skips counting and omits `totalItems` and `totalPages` |
| `custom` | Uses the number returned by `countQuery`; the callback is required |

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

With `countStrategy: 'exact'`, both cursor strategies report the entire matching result set after base conditions, filters, and search are applied. The count excludes the `after`/`before` boundary. A custom `countQuery` receives this same base `where` and defines the returned total. Totals can change when matching rows are inserted, updated, or deleted between requests.

Current offset limitation: with `countStrategy: 'none'`, `links.next` is `null` and `links.last` points to the current page because the last page is unknown. Use cursor mode for next/previous navigation without a total count.

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

`paginate()` can be called without creating a Nest application or registering `PaginationModule`. The package still requires its NestJS peer dependencies. Calls do not inherit module options or `@PaginateDefaults`; pass the desired limits, sorting, and count policy explicitly:

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
  {
    sortableColumns: ['id', 'name', 'createdAt'],
    defaultLimit: 20,
    maxLimit: 100,
    defaultSortBy: [['id', 'ASC']],
  },
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

## PostgreSQL Integration Tests

Run the integration suite against the local PostgreSQL 16 service:

```bash
npm ci
docker compose up -d --wait
npm run test:integration
```

The default connection is `postgresql://test:test@localhost:5434/pagination_test`. Set `DATABASE_URL` to use another test database; the database user must be able to create and drop schemas. Each run creates a randomly named schema and removes it in a `finally` block, without clearing an existing `products` table.

The suite exercises forward and backward keyset navigation with tied values and mixed sort directions, first/last page boundaries, filtered exact and custom totals, extra sort columns, selected fields, deleted cursor rows, and Nest module defaults and endpoint overrides. CI runs it with Prisma 7 on Node.js 20, 22, and 24. `npm run test:prisma7:smoke` remains an alias for the integration suite.

`test:integration` builds the package and generates the Prisma client before running the database scenarios. Run `npm test -- --runInBand` for unit tests and `npm run test:prisma7:types` for generated-client type compatibility. When finished with the local test database, run `docker compose down`.

## Error Handling

| Error | Status | When |
|-------|--------|------|
| `InvalidSortColumnError` | 400 | Sort column not in `sortableColumns` |
| `InvalidFilterColumnError` | 400 | Filter column not in `filterableColumns` or operator not allowed |
| `InvalidCursorError` | 400 | Malformed cursor, keyset sort/value mismatch, or both `after` and `before` supplied |

Sort columns are checked against `sortableColumns`. When `filterableColumns` is configured, unknown filter columns and disallowed operators return an error.

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

These are scenario timings from the published 0.3.0 benchmark, not a measurement of library overhead. The deep offset scenario sorts by `createdAt` and includes an exact count; the **0.58ms** cursor scenario sorts by `id` and omits the count. The roughly 78% difference therefore includes changes in sorting and count policy. This benchmark does not compare equivalent queries against direct Prisma calls or measure the keyset strategy.

Prisma cursor queries with a non-PK sort such as `createdAt` were slower in this run. Measure your own data and indexes when choosing offset or keyset pagination for that ordering.

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
