# @nestarc/pagination 0.2.0 Design Spec

Date: 2026-06-14
Status: Proposed

## Goal

Ship a focused 0.2.0 release that makes `@nestarc/pagination` more credible for production NestJS + Prisma list endpoints without turning it into a broad query builder.

The release should close the highest-value gaps found in the 2026-06-14 research pass:

1. Cursor pagination needs stronger stability for non-unique sort columns and deleted cursor rows.
2. Count behavior needs to be explicit because exact counts are useful but often expensive.
3. Swagger output should document the actual query contract, not only generic `page`, `limit`, and `sortBy` params.
4. The existing `allowWithDeleted` option should either work or be removed; for 0.2.0 it should be wired as a soft-delete integration contract.
5. npm/package metadata and docs should make the package easier to discover and evaluate.

## Current State

`0.1.0` provides the core package shape:

- `paginate()` works with a Prisma-like delegate exposing `findMany()` and `count()`.
- Offset mode uses `skip`/`take` plus parallel `findMany` and `count`.
- Cursor mode uses Prisma `cursor`, `skip: 1`, and `take: limit + 1`.
- Filters, sort columns, and search columns are whitelist-driven.
- Swagger decorators are optional no-ops when `@nestjs/swagger` is not installed.
- `allowWithDeleted` exists in `PaginateConfig` but is not parsed or applied.

This is a good foundation, but 0.1.0 still leaves production users to reason about cursor edge cases, count cost, exact OpenAPI query docs, and soft-delete behavior themselves.

## Positioning

`@nestarc/pagination` should remain the NestARC Foundation package for reusable list endpoints:

- Prisma-first, matching `@nestarc/tenancy`, `@nestarc/soft-delete`, and other NestARC modules.
- NestJS-friendly, with decorators, module defaults, Swagger support, and testing utilities.
- Safer than ad hoc query parsing through explicit column/operator whitelists.
- More integrated than generic Prisma pagination extensions.

It should not try to replace `nestjs-paginate` feature-for-feature in one release. The right 0.2.0 move is to strengthen the Prisma-specific parts that TypeORM packages do not solve.

## Release Scope

### 1. Package Trust And Discovery

Add package metadata and release docs before adding new API surface.

Required changes:

- Add `repository`, `homepage`, and `bugs` to `package.json`.
- Keep keywords aligned with the actual value proposition: `nestjs`, `prisma`, `pagination`, `cursor-pagination`, `offset-pagination`, `swagger`, `filter`, `sorting`, `search`.
- Add a `0.2.0` section to `CHANGELOG.md`.
- Update README language so current search is described as case-insensitive contains search unless PostgreSQL full-text search is actually implemented.
- Add a short comparison section covering:
  - `nestjs-paginate`: TypeORM feature benchmark, not Prisma.
  - `prisma-extension-pagination`: Prisma extension, no NestJS query parsing or Swagger.
  - `nestjs-prisma-querybuilder`: query parser, not a focused pagination contract.

Success criteria:

- npm page links back to GitHub and docs.
- README does not overstate search as PostgreSQL full-text.
- Users can understand why this package exists in one screen.

### 2. Keyset Composite Cursor

Add an opt-in cursor strategy that encodes the sorted tuple instead of relying only on Prisma `cursor`.

Problem:

The current cursor mode works for simple unique cursor columns, especially `id`, but production lists often sort by `createdAt`, `updatedAt`, `name`, or another non-unique column. Prisma cursor pagination can also need a lookup of the cursor row, which becomes fragile when the row has been deleted and can be slower for some query shapes.

Design:

Keep the existing behavior as the default for backward compatibility, and add a keyset strategy:

```typescript
const result = await paginate(query, prisma.user, {
  sortableColumns: ['id', 'createdAt', 'email'],
  defaultSortBy: [['createdAt', 'DESC']],
  paginationType: 'cursor',
  cursorStrategy: 'keyset',
  cursorColumns: ['createdAt', 'id'],
});
```

New config fields:

```typescript
interface PaginateConfig<T = any> {
  cursorColumn?: keyof T & string;
  cursorStrategy?: 'prisma' | 'keyset';
  cursorColumns?: (keyof T & string)[];
  encodeCursor?: (payload: CursorPayload) => string;
  decodeCursor?: (cursor: string) => CursorPayload;
}

interface CursorPayload {
  v: 2;
  values: Record<string, string | number | boolean | Date | null>;
  sortBy: [string, SortOrder][];
}
```

Behavior:

- `cursorStrategy` defaults to `'prisma'`.
- `cursorStrategy: 'keyset'` requires `cursorColumns`.
- `cursorColumns` must include a stable tie-breaker, normally `id`.
- `cursorColumns` must be included in `sortableColumns`.
- The first cursor column should match the active primary sort column.
- If `select` is used, cursor columns must be included in the internal select even if they are stripped from the returned DTO later.
- The cursor payload is opaque Base64url JSON and includes a version number.
- Invalid version, malformed payload, missing values, or sort mismatch throws `InvalidCursorError`.
- Keyset mode builds lexicographic Prisma `where` conditions instead of setting Prisma `cursor`.

Example for `createdAt DESC, id DESC` after cursor:

```typescript
{
  OR: [
    { createdAt: { lt: cursor.createdAt } },
    {
      createdAt: cursor.createdAt,
      id: { lt: cursor.id },
    },
  ],
}
```

Backward pagination:

- `before` reverses the comparison operators.
- The final returned data order remains the user-requested order.
- `take: limit + 1` is still used for `hasNextPage` / `hasPreviousPage` detection.

Non-goals:

- Do not support relation-path cursor columns in 0.2.0.
- Do not infer unique indexes from Prisma DMMF in 0.2.0.
- Do not remove `cursorColumn`; it remains the simple/default API.

Success criteria:

- Existing cursor tests continue to pass unchanged.
- New tests cover duplicate `createdAt` values with `id` tie-breaker.
- Deleted cursor-row scenarios are documented as improved because keyset mode does not require Prisma `cursor` lookup.

### 3. Count Strategy

Make count cost and behavior explicit.

Problem:

Users often need `totalItems` for UI pagination, but exact counts can be expensive with filters, relations, RLS, and soft-delete extensions. Prisma users repeatedly ask for a single `findManyAndCount()` style API, but the package should expose clear policies rather than hiding count cost.

New config:

```typescript
type CountStrategy = 'exact' | 'none' | 'custom';

interface PaginateConfig<T = any> {
  withTotalCount?: boolean;
  countStrategy?: CountStrategy;
  countQuery?: (args: {
    where: Record<string, any>;
    delegate: { count: (args: any) => Promise<number> };
    query: PaginateQuery;
    config: PaginateConfig<T>;
  }) => Promise<number>;
}
```

Behavior:

- Offset default: `countStrategy: 'exact'`.
- Cursor default: `countStrategy: 'none'`, matching the current `withTotalCount: false` direction.
- `withTotalCount: true` maps to `countStrategy: 'exact'` for backward compatibility.
- `countStrategy: 'none'` omits `totalItems` and `totalPages`.
- `countStrategy: 'custom'` requires `countQuery`.
- `countQuery` receives the same safe merged `where` used by `findMany`.
- If `countQuery` throws, the pagination call throws; no silent partial response.

Deferred:

- `estimated` is not part of 0.2.0 because it requires database-specific raw SQL and model/table metadata.
- A transaction mode is deferred until the package has a clear Prisma transaction integration API.

Success criteria:

- Count behavior is visible from config.
- Cursor users can opt into exact counts deliberately.
- Large-list users can avoid count work without losing cursor navigation metadata.

### 4. Swagger Query Contract

Make Swagger decorators describe the configured query shape.

Problem:

The 0.1.0 decorators document only generic pagination params. They do not expose filterable columns, allowed operators, cursor mode differences, or example query strings. Users still need manual `ApiQuery` annotations for production docs.

Design:

Add optional second argument to both response decorators:

```typescript
@ApiPaginatedResponse(UserDto, {
  sortableColumns: ['id', 'email', 'createdAt'],
  searchableColumns: ['email', 'name'],
  filterableColumns: {
    role: ['$eq', '$in'],
    createdAt: ['$gte', '$lte', '$btw'],
  },
})
```

Also export query-only decorators for teams that already own their response schema:

```typescript
@ApiPaginationQuery({
  type: 'cursor',
  sortableColumns: ['id', 'createdAt'],
  filterableColumns: { role: ['$eq', '$in'] },
})
```

Documented params:

- Offset: `page`, `limit`, `sortBy`, `search`, `filter.{column}`.
- Cursor: `limit`, `after`, `before`, `sortBy`, `search`, `filter.{column}`.
- Soft-delete when enabled: `withDeleted`.

Behavior:

- `filter.{column}` params include operator examples.
- `sortBy` includes examples from `sortableColumns`.
- Decorators remain no-ops without `@nestjs/swagger`.
- Existing decorator calls without options remain valid.

Non-goals:

- Do not generate every possible filter combination.
- Do not model deep object query DTOs in 0.2.0; the package uses flat query params.

Success criteria:

- Swagger output explains the same query format the parser accepts.
- Users can delete most manual `ApiQuery` annotations from list endpoints.

### 5. Soft Delete Query Wiring

Make `allowWithDeleted` meaningful.

Problem:

`allowWithDeleted` exists in `PaginateConfig`, but `PaginateQuery` and `parsePaginateQuery()` do not parse `withDeleted`. This creates a misleading API surface.

New query field:

```typescript
interface PaginateQuery {
  withDeleted?: boolean;
}
```

Parsing:

- `withDeleted=true`, `withDeleted=1`, and `withDeleted=yes` parse to `true`.
- Other values parse to `false`.
- The parsed value is ignored unless `config.allowWithDeleted === true`.

Delegate behavior:

- When enabled, pass `withDeleted: true` through `findManyArgs` and `count` args.
- Pagination does not add `deletedAt` filters itself.
- The soft-delete Prisma extension is responsible for consuming the flag.
- If the current `@nestarc/soft-delete` API uses a different pass-through key, align the two packages before publishing 0.2.0.

Swagger:

- `withDeleted` is documented only when the decorator options include `allowWithDeleted: true`.

Success criteria:

- The option no longer appears dead.
- The behavior is explicit and does not weaken default soft-delete filtering.

## Deferred Scope

These are useful, but should not block 0.2.0:

- Relation path whitelist for `author.name`, `profile.city`, and nested relation search.
- Relay adapter returning `edges`, `node`, `cursor`, and `pageInfo`.
- PostgreSQL `tsvector` / `tsquery` full-text search.
- JSON path / JSONB filters.
- Boolean `$and` / `$or` filter groups in the public query DSL.
- Prisma 7 peer dependency expansion, unless CI can verify it before release.
- Estimated counts through PostgreSQL statistics.
- Prisma `$extends()` pagination API.

## API Compatibility

0.2.0 must be non-breaking:

- Existing `paginate(query, delegate, config)` calls continue to work.
- Existing cursors generated by 0.1.0 continue to decode in the default `prisma` strategy.
- New keyset cursors are versioned and should not be accepted by the old decoder.
- Existing Swagger decorator calls remain valid.
- Existing `withTotalCount` behavior remains valid, but docs should prefer `countStrategy`.

## Error Handling

Add or reuse errors as follows:

- Reuse `InvalidCursorError` for malformed, version-mismatched, or sort-mismatched cursors.
- Reuse `InvalidSortColumnError` when `cursorColumns` contains a non-sortable column.
- Reuse `InvalidFilterColumnError` for invalid filter operators.
- Add `InvalidPaginationConfigError` only if validation errors cannot be expressed by existing errors.

Configuration errors should fail at request time with actionable messages. Silent fallback from keyset to Prisma cursor is not allowed.

## Testing Plan

Unit tests:

- Keyset cursor encoding and decoding with versioned payloads.
- Forward keyset pagination with duplicate first-sort-column values.
- Backward keyset pagination preserves requested result order.
- Mixed ASC/DESC sort directions generate correct comparison operators.
- Invalid cursor payloads throw `InvalidCursorError`.
- `countStrategy: 'none'` omits totals.
- `countStrategy: 'exact'` calls delegate `count`.
- `countStrategy: 'custom'` calls the provided `countQuery`.
- `withDeleted` parsing accepts true-ish values and rejects other values.
- `withDeleted` is passed only when `allowWithDeleted` is true.
- Swagger decorators produce query params for configured sort/filter/search fields.
- Existing 0.1.0 tests remain unchanged.

Integration or benchmark checks:

- Keep the existing benchmark script runnable.
- Add at least one benchmark note comparing Prisma cursor and keyset cursor for `createdAt + id` ordering.

Verification commands:

```bash
npm test
npm run build
```

## Documentation Plan

Update README with:

- Count strategy examples.
- Keyset cursor examples and when to use them.
- Offset vs Prisma cursor vs keyset cursor decision table.
- Index guidance:
  - `ORDER BY createdAt DESC, id DESC` should have a matching composite index.
  - Cursor columns should be stable and immutable for best results.
- Soft-delete `withDeleted` behavior.
- Swagger option examples.
- Search wording correction.

Update changelog with:

- New keyset composite cursor strategy.
- New count strategy options.
- Enhanced Swagger query docs.
- `withDeleted` query parsing and pass-through.
- Package metadata improvements.

## Acceptance Criteria

0.2.0 is ready when:

- The release is backward compatible with 0.1.0 public API.
- Keyset cursor mode handles duplicate sort values without skipping or duplicating rows.
- Count behavior is configurable and documented.
- Swagger docs reflect endpoint-specific query capabilities.
- `allowWithDeleted` has a working query path.
- README accurately states current search behavior.
- `npm test` and `npm run build` pass locally.

