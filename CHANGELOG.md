# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-05

### Added

- **Core `paginate()` function** — offset and cursor pagination with auto-detection
  - Offset mode: parallel `findMany` + `count` via `Promise.all`
  - Cursor mode: Base64url cursor encoding, `take: limit+1` for hasNextPage detection, forward (`after`) and backward (`before`) navigation
- **12 filter operators**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$ilike`, `$btw`, `$null`, `$not:null`
- **Multi-column sorting** with `nullSort` positioning (`'first'` | `'last'`)
- **Full-text search** across multiple columns via case-insensitive `OR` conditions
- **Column/operator whitelisting** — `sortableColumns`, `filterableColumns` with per-column operator restrictions
- **`PaginationModule`** — `forRoot()` / `forRootAsync()` DynamicModule for global defaults
- **`PaginateService`** — injectable service that merges module options, `@PaginateDefaults` metadata, and per-endpoint config (priority: config > decorator > module)
- **`@Paginate()` decorator** — parameter decorator that parses HTTP query params into `PaginateQuery`
- **`@PaginateDefaults()` decorator** — method decorator for per-handler overrides (`defaultLimit`, `maxLimit`, `defaultSortBy`, `paginationType`)
- **`@ApiPaginatedResponse()` / `@ApiCursorPaginatedResponse()`** — Swagger auto-documentation decorators (no-op when `@nestjs/swagger` is not installed)
- **Error classes**: `InvalidSortColumnError`, `InvalidFilterColumnError`, `InvalidCursorError` (all 400 Bad Request)
- **Testing utilities** (`@nestarc/pagination/testing`): `createPaginateQuery()` factory, `TestPaginationModule`
- **Standalone usage** — `paginate()` works without NestJS module registration
- **Safe `config.where` merge** — uses Prisma `AND` composition to prevent base conditions from being overwritten by user filters
- **`select` + `relations` conflict prevention** — when both are configured, relations are merged into the select object (never sets `include` and `select` simultaneously)
- **Pagination links preserve full query state** — `sortBy`, `search`, `filter` params are included in all generated links
- **Type-safe filter value coercion** — preserves leading-zero strings (`"00123"` stays as string, not converted to `123`)

### Compatibility

- NestJS 10.x / 11.x
- Prisma 5.x / 6.x
- `@nestjs/swagger` optional peer dependency
- `@nestarc/tenancy` — automatic RLS via Prisma extension chain (no integration code needed)
- `@nestarc/soft-delete` — automatic exclusion via Prisma extension chain
