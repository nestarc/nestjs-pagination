import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { CursorPaginated, Paginated, PaginateConfig, PaginateQuery } from '../src';
import { PrismaClient, Product } from './generated/client/client';
import { createPrismaClient, DATABASE_URL } from './prisma-client';

// Exercise the built package, including TypeScript's emitted Nest DI metadata.
const { paginate, PaginationModule, PaginateService } = require('../dist') as typeof import('../src');
const { parsePaginateQuery } = require('../dist/pipes/paginate-query.pipe') as typeof import('../src/pipes/paginate-query.pipe');

const schema = `pagination_test_${randomUUID().replaceAll('-', '')}`;
const admin = createPrismaClient();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }, { schema }),
});
const id = (value: number) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const records = Array.from({ length: 12 }, (_, index) => ({
  id: id(index + 1),
  name: `Product ${String(12 - index).padStart(2, '0')}`,
  category: index < 10 ? 'A' : 'B',
  price: (index + 1) * 10,
  active: index !== 1,
  createdAt: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 3))),
}));
const baseConfig = {
  sortableColumns: ['id', 'createdAt', 'price', 'name'],
  defaultSortBy: [['id', 'ASC']],
  filterableColumns: { price: ['$gte'] },
  searchableColumns: ['name'],
} satisfies PaginateConfig<Product>;
const keysetConfig: PaginateConfig<Product> = {
  ...baseConfig,
  paginationType: 'cursor',
  cursorStrategy: 'keyset',
  cursorColumns: ['createdAt', 'id'],
  defaultSortBy: [['createdAt', 'ASC'], ['id', 'ASC']],
};

async function cursorPage(
  query: Partial<PaginateQuery> = {},
  config: PaginateConfig<Product> = keysetConfig,
): Promise<CursorPaginated<Product>> {
  const result = await paginate<Product>(
    { path: '/products', limit: 2, ...query },
    prisma.product,
    config,
  );
  assert.ok('startCursor' in result.meta, 'expected cursor response');
  return result as CursorPaginated<Product>;
}

function requireCursor(cursor: string | null): string {
  assert.ok(cursor, 'expected a non-empty cursor');
  return cursor;
}

async function walkKeyset(config: PaginateConfig<Product>): Promise<void> {
  const sortBy = config.defaultSortBy!;
  const expected = await prisma.product.findMany({
    orderBy: sortBy.map(([column, order]) => ({ [column]: order.toLowerCase() })),
  });
  const pages: CursorPaginated<Product>[] = [];
  let page = await cursorPage({}, config);
  assert.equal(page.meta.hasPreviousPage, false);
  assert.equal(page.links.previous, null);

  for (let index = 0; ; index++) {
    assert.ok(index < records.length, 'pagination must terminate');
    pages.push(page);
    assert.deepEqual(page.data.map((record) => record.id), expected.slice(index * 2, index * 2 + 2).map((record) => record.id));
    assert.deepEqual(page.meta.sortBy, sortBy, 'response retains requested sort order');
    if (!page.meta.hasNextPage) break;
    page = await cursorPage({ after: requireCursor(page.meta.endCursor) }, config);
  }

  assert.equal(pages.length, 6);
  assert.equal(page.links.next, null);
  assert.deepEqual(pages.flatMap((value) => value.data.map((record) => record.id)), expected.map((record) => record.id));

  // Walking back from the final page must visit the immediately preceding page,
  // including boundaries inside a group of identical timestamps.
  for (let index = pages.length - 2; index >= 0; index--) {
    page = await cursorPage({ before: requireCursor(page.meta.startCursor) }, config);
    assert.deepEqual(page.data, pages[index].data);
    assert.equal(page.meta.hasPreviousPage, index > 0);
    assert.equal(page.meta.hasNextPage, true);
    assert.deepEqual(page.meta.sortBy, sortBy);
  }
  assert.equal(page.links.previous, null);

  const empty = await cursorPage({ after: requireCursor(pages.at(-1)!.meta.endCursor) }, config);
  assert.deepEqual(empty.data, []);
  assert.equal(empty.meta.hasNextPage, false);
  assert.equal(empty.meta.startCursor, null);
  assert.equal(empty.meta.endCursor, null);
}

async function checkBasicPagination(): Promise<void> {
  const offset = await paginate<Product>(
    { path: '/products', page: 2, limit: 2, filter: { price: '$gte:10' } },
    prisma.product,
    baseConfig,
  );
  assert.deepEqual(offset.data.map((record) => record.id), [id(3), id(4)]);
  assert.equal(offset.meta.totalItems, 12);

  const config: PaginateConfig<Product> = { ...baseConfig, paginationType: 'cursor' };
  const first = await cursorPage({}, config);
  const second = await cursorPage({ after: requireCursor(first.meta.endCursor) }, config);
  assert.deepEqual(first.data.map((record) => record.id), [id(1), id(2)]);
  assert.deepEqual(second.data.map((record) => record.id), [id(3), id(4)]);
  const previous = await cursorPage({ before: requireCursor(second.meta.startCursor) }, config);
  assert.deepEqual(previous.data, first.data);
}

function queryFromLink(link: string): PaginateQuery {
  const url = new URL(link, 'http://localhost');
  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((_value, key) => {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  });
  return parsePaginateQuery({ path: url.pathname, query });
}

async function checkCountFreeOffsetNavigation(): Promise<void> {
  const delegate = {
    findMany: (args: Parameters<typeof prisma.product.findMany>[0]) => prisma.product.findMany(args),
    count: async (): Promise<number> => {
      throw new Error('countStrategy:none must never invoke delegate.count');
    },
  };
  const config: PaginateConfig<Product> = {
    ...baseConfig,
    paginationType: 'offset',
    countStrategy: 'none',
    countQuery: async () => {
      throw new Error('countStrategy:none must never invoke countQuery');
    },
    filterableColumns: { price: ['$gte', '$lte'] },
    where: { category: 'A', active: true },
    select: ['id', 'price'],
  };

  async function readPage(query: PaginateQuery, pageConfig = config): Promise<Paginated<Product>> {
    const result = await paginate<Product>(query, delegate, pageConfig);
    assert.ok('currentPage' in result.meta, 'expected offset response');
    assert.equal('totalItems' in result.meta, false, 'unknown totals must be omitted');
    assert.equal('totalPages' in result.meta, false, 'unknown page count must be omitted');
    const page = result as Paginated<Product>;
    assert.equal(page.links.last, null, 'last is unknown even on a terminal or empty page');
    for (const record of page.data) {
      assert.deepEqual(Object.keys(record).sort(), ['id', 'price']);
    }
    return page;
  }

  async function walk(minPrice: number, requestedLimit: number, maxLimit: number): Promise<void> {
    const initial: PaginateQuery = {
      path: '/products',
      page: 1,
      limit: requestedLimit,
      sortBy: [['price', 'DESC'], ['id', 'ASC']],
      search: 'Product 0',
      filter: { price: [`$gte:${minPrice}`, '$lte:120'] },
    };
    const limit = Math.min(requestedLimit, maxLimit);
    const expected = records
      .filter((record) => record.category === 'A' && record.active &&
        record.name.includes(initial.search!) && record.price >= minPrice && record.price <= 120)
      .sort((left, right) => right.price - left.price)
      .map(({ id: productId, price }) => ({ id: productId, price }));
    assert.ok(expected.length > limit * 2, 'fixture must span at least three pages');
    const pages: Paginated<Product>[] = [];
    let query = initial;

    for (let pageNumber = 1; ; pageNumber++) {
      assert.ok(pageNumber <= records.length, 'following next links must terminate');
      const result = await readPage(query, { ...config, maxLimit });
      pages.push(result);
      assert.equal(result.meta.currentPage, pageNumber);
      assert.equal(result.meta.itemsPerPage, limit);
      assert.deepEqual(result.data, expected.slice((pageNumber - 1) * limit, pageNumber * limit));
      assert.deepEqual(result.meta.sortBy, initial.sortBy);

      function assertLink(link: string, targetPage: number): PaginateQuery {
        const parsed = queryFromLink(link);
        assert.deepEqual(parsed, {
          ...initial,
          page: targetPage,
          limit,
        }, 'links must preserve search, repeated filters, and multiple sort columns');
        return parsed;
      }

      assertLink(result.links.first, 1);
      assertLink(result.links.current, pageNumber);
      if (pageNumber === 1) {
        assert.equal(result.links.previous, null);
      } else {
        assert.ok(result.links.previous);
        assertLink(result.links.previous, pageNumber - 1);
      }

      if (pageNumber * limit >= expected.length) {
        assert.equal(result.links.next, null, 'the final page must not advertise an empty successor');
        break;
      }
      assert.ok(result.links.next, 'a lookahead row must produce a next link');
      // Use the advertised URL as the next request, as an HTTP client would.
      query = assertLink(result.links.next, pageNumber + 1);
    }
    assert.deepEqual(pages.flatMap((page) => page.data), expected, 'lookahead rows must not be lost or returned twice');
    assert.equal(pages.length, Math.ceil(expected.length / limit));

    const outOfRangeQuery = { ...initial, page: pages.length + 1 };
    const outOfRange = await readPage(outOfRangeQuery, { ...config, maxLimit });
    assert.deepEqual(outOfRange.data, []);
    assert.equal(outOfRange.links.next, null);
    assert.equal(queryFromLink(outOfRange.links.current).page, pages.length + 1);
    assert.ok(outOfRange.links.previous);
    assert.equal(queryFromLink(outOfRange.links.previous).page, pages.length);
  }

  await walk(50, 100, 2); // Six rows: exact multiple, with the requested limit clamped.
  await walk(30, 3, 4); // Seven rows: a partial final page.

  const empty = await readPage({
    path: '/products',
    page: 1,
    limit: 2,
    search: 'no matching product',
    filter: { price: '$gte:30' },
  });
  assert.deepEqual(empty.data, []);
  assert.equal(empty.links.next, null);
  assert.equal(empty.links.previous, null);
  assert.equal(empty.links.first, empty.links.current);
}

async function checkCounts(): Promise<void> {
  const query = { filter: { price: '$gte:30' }, search: 'Product' };
  const matchingIds = records.filter((record) => record.category === 'A' && record.price >= 30).map((record) => record.id);

  for (const countStrategy of ['exact', 'custom'] as const) {
    const config: PaginateConfig<Product> = {
      ...keysetConfig,
      where: { category: 'A' },
      countStrategy,
      countQuery: async ({ delegate, where }) => {
        // The callback must receive the complete base/filter/search predicate,
        // not the cursor boundary for the current page.
        const matches = await prisma.product.findMany({ where, orderBy: { id: 'asc' } });
        assert.deepEqual(matches.map((record) => record.id), matchingIds);
        return delegate.count({ where });
      },
    };
    const first = await cursorPage(query, config);
    const second = await cursorPage({ ...query, after: requireCursor(first.meta.endCursor) }, config);
    const third = await cursorPage({ ...query, after: requireCursor(second.meta.endCursor) }, config);
    const previous = await cursorPage({ ...query, before: requireCursor(third.meta.startCursor) }, config);
    for (const page of [first, second, third, previous]) {
      assert.equal(page.meta.totalItems, matchingIds.length, `${countStrategy} total remains independent of cursor`);
    }
    assert.deepEqual(previous.data, second.data);
  }
}

async function checkAdditionalSortAndSelection(): Promise<void> {
  const config: PaginateConfig<Product> = {
    ...keysetConfig,
    cursorColumns: ['id'],
    defaultSortBy: [['name', 'ASC'], ['id', 'ASC']],
    select: ['price'],
  };
  const first = await cursorPage({}, config);
  const payload = JSON.parse(Buffer.from(requireCursor(first.meta.endCursor), 'base64url').toString('utf8'));
  assert.equal(payload.values.name, 'Product 02');
  assert.equal(payload.values.id, id(11));
  assert.deepEqual(first.data, [{ price: 120 }, { price: 110 }]);

  const second = await cursorPage({ after: requireCursor(first.meta.endCursor) }, config);
  assert.deepEqual(second.data, [{ price: 100 }, { price: 90 }]);
  const previous = await cursorPage({ before: requireCursor(second.meta.startCursor) }, config);
  assert.deepEqual(previous.data, first.data);
  for (const record of [...first.data, ...second.data, ...previous.data]) {
    assert.deepEqual(Object.keys(record), ['price'], 'internally selected cursor fields must not leak into data');
  }

  // A selected cursor column remains present, while only internal additions disappear.
  const selected = await cursorPage({}, { ...config, select: ['id', 'price'] });
  assert.deepEqual(selected.data, [{ id: id(12), price: 120 }, { id: id(11), price: 110 }]);
}

async function checkDeletedAnchor(): Promise<void> {
  const first = await cursorPage();
  const anchor = first.data.at(-1)!;
  await prisma.product.delete({ where: { id: anchor.id } });
  try {
    const second = await cursorPage({ after: requireCursor(first.meta.endCursor) });
    assert.deepEqual(second.data.map((record) => record.id), [id(3), id(4)]);
    const previous = await cursorPage({ before: requireCursor(second.meta.startCursor) });
    assert.deepEqual(previous.data.map((record) => record.id), [id(1)]);
    assert.equal(previous.meta.hasPreviousPage, false);
  } finally {
    await prisma.product.create({ data: anchor });
  }
}

async function checkModuleDefaults(): Promise<void> {
  const module = await Test.createTestingModule({
    imports: [PaginationModule.forRoot({
      defaultLimit: 3,
      maxLimit: 4,
      defaultPaginationType: 'cursor',
      defaultSortBy: [['id', 'DESC']],
      withTotalCount: true,
    })],
  }).compile();
  const asyncModule = await Test.createTestingModule({
    imports: [PaginationModule.forRootAsync({
      useFactory: async () => ({
        defaultLimit: 2,
        maxLimit: 3,
        defaultPaginationType: 'cursor',
        defaultSortBy: [['id', 'ASC']],
        withTotalCount: false,
      }),
    })],
  }).compile();

  try {
    const service = module.get(PaginateService);
    const config: PaginateConfig<Product> = { sortableColumns: ['id'] };
    const first = await service.paginate({ path: '/products' }, prisma.product, config);
    assert.ok('startCursor' in first.meta);
    assert.equal(first.meta.itemsPerPage, 3);
    assert.equal(first.meta.totalItems, 12);
    assert.deepEqual(first.meta.sortBy, [['id', 'DESC']]);
    assert.deepEqual(first.data.map((record) => record.id), [id(12), id(11), id(10)]);

    const capped = await service.paginate({ path: '/products', limit: 100 }, prisma.product, config);
    assert.equal(capped.data.length, 4);
    assert.equal(capped.meta.itemsPerPage, 4);

    const override = await service.paginate({ path: '/products', limit: 100 }, prisma.product, {
      ...config,
      maxLimit: 2,
      paginationType: 'offset',
      defaultSortBy: [['id', 'ASC']],
      countStrategy: 'none',
    });
    assert.ok('currentPage' in override.meta);
    assert.equal(override.meta.itemsPerPage, 2);
    assert.equal(override.meta.totalItems, undefined);
    assert.deepEqual(override.data.map((record) => record.id), [id(1), id(2)]);

    const noCount = await service.paginate({ path: '/products' }, prisma.product, {
      ...config,
      defaultLimit: 1,
      withTotalCount: false,
    });
    assert.equal(noCount.meta.itemsPerPage, 1);
    assert.equal(noCount.meta.totalItems, undefined);

    const other = await asyncModule.get(PaginateService).paginate({ path: '/products' }, prisma.product, config);
    assert.equal(other.meta.itemsPerPage, 2);
    assert.equal(other.meta.totalItems, undefined);
    assert.deepEqual(other.data.map((record) => record.id), [id(1), id(2)]);
    const original = await service.paginate({ path: '/products' }, prisma.product, config);
    assert.deepEqual(original.data, first.data, 'independent Nest modules must not overwrite each other');
  } finally {
    await module.close();
    await asyncModule.close();
  }
}

async function main(): Promise<void> {
  let schemaCreated = false;
  try {
    // The identifier is generated above from a UUID; no user input is interpolated.
    // Isolate every run so existing benchmark/application tables remain untouched.
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await admin.$executeRawUnsafe(`
      CREATE TABLE "${schema}".products (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        rating DOUBLE PRECISION NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.product.createMany({ data: records });

    const scenarios: [string, () => Promise<void>][] = [
      ['offset and Prisma cursor navigation', checkBasicPagination],
      ['count-free offset links, filtered traversal, and page boundaries', checkCountFreeOffsetNavigation],
      ...(['ASC', 'DESC'] as const).flatMap((dateOrder) =>
        (['ASC', 'DESC'] as const).map((idOrder): [string, () => Promise<void>] => [
          `keyset round trip: createdAt ${dateOrder}, id ${idOrder}`,
          () => walkKeyset({ ...keysetConfig, defaultSortBy: [['createdAt', dateOrder], ['id', idOrder]] }),
        ]),
      ),
      ['filtered exact/custom totals across cursor boundaries', checkCounts],
      ['additional sort fields and internal cursor selection', checkAdditionalSortAndSelection],
      ['navigation after deleting the cursor record', checkDeletedAnchor],
      ['Nest global settings, endpoint overrides, and module isolation', checkModuleDefaults],
    ];
    for (const [name, run] of scenarios) {
      await run();
      console.log(`PASS ${name}`);
    }
    console.log(`PostgreSQL integration tests passed (${scenarios.length} scenarios)`);
  } finally {
    await prisma.$disconnect();
    try {
      if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
