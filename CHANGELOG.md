# Changelog

All notable changes to this project will be documented in this file.

## [0.3.2] - 2026-10-27

### Fixed

- Offset pagination with `countStrategy: 'none'` detects the next page by fetching one additional matching row, returns at most the requested limit, and sets `links.next` only when that row exists
- Count-free offset responses set `links.last` to `null` on every page, including terminal and empty pages, instead of presenting the current page as the known last page

### Added

- PostgreSQL regression coverage for offset navigation without counts across filtered results, terminal pages, and empty pages

### Changed

- The public `Paginated<T>.links.last` type is now `string | null`, and the Swagger offset response marks this field nullable
- Documented count-free offset navigation: `totalItems` and `totalPages` remain omitted, neither `delegate.count` nor `countQuery` runs, and exact/custom count behavior is unchanged

### Upgrade Notes

- Guard against `null` before rendering or following `links.last`. This is a public TypeScript response type change: code that previously treated the field as an unconditional `string` must handle the unknown-last-page case.
- Count-free offset clients can now follow `links.next` until it is `null`. `links.last` remains `null` even on terminal and empty pages; it no longer points to the current page. Exact and custom count strategies retain their existing navigation behavior.

## [0.3.1] - 2026-10-27

### Fixed

- Keyset `before` navigation returns the immediately preceding page, including from deep pages and across tied sort values, while preserving the requested output order
- Cursor requests containing both `after` and `before` return `400 Bad Request` (`InvalidCursorError`)
- Keyset exact and custom counts use the entire result set matching base conditions, filters, and search; cursor boundaries no longer reduce `totalItems`
- Keyset cursors include every effective sort column, so an allowed sort column outside `cursorColumns` remains usable on subsequent pages
- Cursor fields omitted by `select` are fetched for cursor generation; only internally added fields are removed from returned `data`, preserving explicitly selected fields
- `PaginateService` applies `withTotalCount` from `forRoot()` and `forRootAsync()`, preserving endpoint overrides including `false` and the precedence of an explicit `countStrategy`
- Quick Start uses the injected `PaginateService` so registered module defaults take effect

### Added

- PostgreSQL integration suite with nine scenario groups: offset/Prisma cursor navigation; four composite keyset round trips covering `createdAt`/`id` ASC/ASC, ASC/DESC, DESC/ASC, and DESC/DESC; filtered exact/custom totals; additional sort fields and selection; deleted boundary rows; and Nest module defaults, overrides, and isolation
- Integration runs exercise the built package with a generated Prisma 7 client, use a unique schema, and clean it up without clearing existing application or benchmark tables
- `test:integration` script, also used by the existing `test:prisma7:smoke` command

### Changed

- Deprecated the unused `withLinks` and `fieldNamingStrategy` module options; links remain included and metadata remains camelCase
- Documented standalone configuration, keyset requirements and cursor contents, count semantics, and integration test setup
- Qualified the existing benchmark comparison to explain its different sorting and count workloads

### Upgrade Notes

- Cursor endpoints using `PaginateService` with a module-level `withTotalCount: true` now issue the count query and return `meta.totalItems`. Set endpoint `withTotalCount: false` to override that default, or `countStrategy: 'none'` to explicitly disable counting.
- For keyset endpoints, treat `totalItems` as the size of the entire matching result set. Code that previously interpreted it as the number of rows remaining after a cursor should be updated.
- Restart a traversal from its first page if a cached keyset cursor lacks a value for any active sort column. Newly generated cursors include all effective sort values, even when those fields are omitted from returned `data` by `select`.
- Send only one of `after` or `before` per request; sending both now returns HTTP 400.

## [0.3.0] - 2026-08-02

### Added

- Prisma 7 generated-client type verification and PostgreSQL offset/cursor smoke tests in CI
- Prisma 7 benchmark configuration using `prisma.config.ts` and the PostgreSQL driver adapter

### Changed

- Prisma 7 is now the primary development and CI version while Prisma 5 and 6 remain supported peer ranges
- CI now runs on Node.js 20, 22, and 24 to match Prisma 7 runtime requirements
- Standalone Prisma setup documentation now uses a generated client and driver adapter
- Performance figures were rerun with Prisma 7.9.1 and PostgreSQL 16

## [0.2.0] - 2026-06-14

### Added

- **Keyset composite cursor strategy** — stable cursor pagination with non-unique sort columns and tie-breaker columns
- **Count strategy options** — exact, omitted, and custom count behavior for cost-aware pagination
- **Config-aware Swagger query documentation** — endpoint-specific sort, search, filter, and soft-delete query params
- **`withDeleted` query parsing and pass-through** — opt-in soft-delete integration via `allowWithDeleted`

### Changed

- Package metadata now includes repository, homepage, and issue links for npm discoverability
- Documentation now describes current search as case-insensitive contains search

## [0.1.0] - 2026-04-05

### Added

- **Core `paginate()` function** — offset and cursor pagination with auto-detection
  - Offset mode: parallel `findMany` + `count` via `Promise.all`
  - Cursor mode: Base64url cursor encoding, `take: limit+1` for hasNextPage detection, forward (`after`) and backward (`before`) navigation
- **12 filter operators**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$ilike`, `$btw`, `$null`, `$not:null`
- **Multi-column sorting** with `nullSort` positioning (`'first'` | `'last'`)
- **Case-insensitive contains search** across multiple columns via `OR` conditions
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
