/**
 * Benchmark: Pagination performance — offset vs cursor at depth
 *
 * Measures:
 *   A) Offset pagination — page 1 (shallow)
 *   B) Offset pagination — page 100 (deep, OFFSET 1000)
 *   C) Cursor pagination — first page
 *   D) Cursor pagination — deep page (after cursor)
 *   E) Filtered + sorted query
 *   F) Full-text search across columns
 *
 * Usage:
 *   docker compose up -d
 *   DATABASE_URL=postgresql://test:test@localhost:5434/pagination_test \
 *     npx prisma generate --schema=benchmarks/prisma/schema.prisma && \
 *     npx ts-node benchmarks/pagination-overhead.ts
 */

import { paginate } from '../src/paginate';
import { PaginateQuery } from '../src/interfaces/paginate-query.interface';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:5434/pagination_test';

const WARMUP = 20;
const ITERATIONS = 200;

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

interface BenchResult {
  label: string;
  iterations: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function analyze(label: string, timings: number[]): BenchResult {
  const sorted = [...timings].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  return {
    label,
    iterations: sorted.length,
    avgMs: Math.round((total / sorted.length) * 100) / 100,
    p50Ms: Math.round(percentile(sorted, 50) * 100) / 100,
    p95Ms: Math.round(percentile(sorted, 95) * 100) / 100,
    p99Ms: Math.round(percentile(sorted, 99) * 100) / 100,
    minMs: Math.round(sorted[0] * 100) / 100,
    maxMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
  };
}

function printResult(r: BenchResult) {
  console.log(`\n${r.label}`);
  console.log(`  Iterations: ${r.iterations}`);
  console.log(
    `  Avg: ${r.avgMs}ms | P50: ${r.p50Ms}ms | P95: ${r.p95Ms}ms | P99: ${r.p99Ms}ms`,
  );
  console.log(`  Min: ${r.minMs}ms | Max: ${r.maxMs}ms`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== @nestarc/pagination Benchmark ===\n');

  const { PrismaClient } = require('./generated/client');
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  await prisma.$connect();

  // Setup table
  console.log('Setting up database...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS products (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      category   TEXT NOT NULL,
      price      INTEGER NOT NULL,
      rating     DOUBLE PRECISION NOT NULL DEFAULT 0,
      active     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_prod_category ON products (category)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_prod_price ON products (price)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_prod_created ON products (created_at)');

  // Seed 10,000 products
  const ROW_COUNT = 10_000;
  const existingCount = await prisma.product.count();

  if (existingCount < ROW_COUNT) {
    console.log(`Seeding ${ROW_COUNT} products...`);
    await prisma.$executeRawUnsafe('DELETE FROM products');

    const categories = ['Electronics', 'Books', 'Clothing', 'Home', 'Sports'];
    const batchSize = 500;
    for (let batch = 0; batch < ROW_COUNT / batchSize; batch++) {
      const values: string[] = [];
      const params: any[] = [];
      for (let i = 0; i < batchSize; i++) {
        const idx = batch * batchSize + i;
        const pIdx = params.length;
        values.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
        params.push(
          `Product ${idx}`,
          categories[idx % categories.length],
          Math.floor(Math.random() * 10000) + 100,
          Math.round(Math.random() * 50) / 10,
          idx % 10 !== 0,
        );
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO products (name, category, price, rating, active) VALUES ${values.join(',')}`,
        ...params,
      );
    }
  }

  console.log(`Total products: ${await prisma.product.count()}\n`);

  const delegate = prisma.product;
  const baseConfig: any = {
    sortableColumns: ['createdAt', 'price', 'name'],
    defaultSortBy: [['createdAt', 'DESC']],
    defaultLimit: 10,
    maxLimit: 100,
    filterableColumns: {
      category: ['$eq', '$in'],
      price: ['$gte', '$lte', '$btw'],
      active: ['$eq'],
      rating: ['$gte'],
    },
    searchableColumns: ['name', 'category'],
  };

  // ===================================================================
  // A: Offset page 1
  // ===================================================================
  const queryA: PaginateQuery = { path: '/products', page: 1, limit: 10 };

  for (let i = 0; i < WARMUP; i++) await paginate(queryA, delegate, baseConfig);

  console.log(`Running A: offset page 1 (${ITERATIONS} iterations)...`);
  const timingsA: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await paginate(queryA, delegate, baseConfig);
    timingsA.push(performance.now() - start);
  }

  // ===================================================================
  // B: Offset page 100 (deep)
  // ===================================================================
  const queryB: PaginateQuery = { path: '/products', page: 100, limit: 10 };

  for (let i = 0; i < WARMUP; i++) await paginate(queryB, delegate, baseConfig);

  console.log(`Running B: offset page 100 (${ITERATIONS} iterations)...`);
  const timingsB: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await paginate(queryB, delegate, baseConfig);
    timingsB.push(performance.now() - start);
  }

  // ===================================================================
  // C: Cursor — first page
  // ===================================================================
  const cursorConfig: any = { ...baseConfig, paginationType: 'cursor' as const, cursorColumn: 'id' };
  const queryC: PaginateQuery = { path: '/products', limit: 10 };

  for (let i = 0; i < WARMUP; i++) await paginate(queryC, delegate, cursorConfig);

  console.log(`Running C: cursor first page (${ITERATIONS} iterations)...`);
  const timingsC: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await paginate(queryC, delegate, cursorConfig);
    timingsC.push(performance.now() - start);
  }

  // ===================================================================
  // D: Cursor — deep page (navigate to page ~100 by chaining cursors)
  // ===================================================================
  // First, get a cursor deep into the dataset
  let deepCursor: string | null = null;
  let currentResult = await paginate({ path: '/products', limit: 10 }, delegate, cursorConfig);
  for (let i = 0; i < 99; i++) {
    const meta = (currentResult as any).meta;
    if (!meta.hasNextPage) break;
    deepCursor = meta.endCursor;
    currentResult = await paginate(
      { path: '/products', limit: 10, after: deepCursor! },
      delegate,
      cursorConfig,
    );
  }

  let resultD: BenchResult | null = null;
  if (deepCursor) {
    const queryD: PaginateQuery = { path: '/products', limit: 10, after: deepCursor };

    for (let i = 0; i < WARMUP; i++) await paginate(queryD, delegate, cursorConfig);

    console.log(`Running D: cursor deep page (${ITERATIONS} iterations)...`);
    const timingsD: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await paginate(queryD, delegate, cursorConfig);
      timingsD.push(performance.now() - start);
    }
    resultD = analyze('D) cursor — deep page (~page 100)', timingsD);
  }

  // ===================================================================
  // E: Filtered + sorted query
  // ===================================================================
  const queryE: PaginateQuery = {
    path: '/products',
    page: 1,
    limit: 10,
    sortBy: [['price', 'ASC']],
    filter: { category: '$eq:Electronics', price: '$gte:5000' },
  };

  for (let i = 0; i < WARMUP; i++) await paginate(queryE, delegate, baseConfig);

  console.log(`Running E: filtered + sorted (${ITERATIONS} iterations)...`);
  const timingsE: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await paginate(queryE, delegate, baseConfig);
    timingsE.push(performance.now() - start);
  }

  // ===================================================================
  // F: Full-text search
  // ===================================================================
  const queryF: PaginateQuery = { path: '/products', page: 1, limit: 10, search: 'Product 500' };

  for (let i = 0; i < WARMUP; i++) await paginate(queryF, delegate, baseConfig);

  console.log(`Running F: full-text search (${ITERATIONS} iterations)...`);
  const timingsF: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await paginate(queryF, delegate, baseConfig);
    timingsF.push(performance.now() - start);
  }

  // ===================================================================
  // Results
  // ===================================================================
  const resultA = analyze('A) offset — page 1 (shallow)', timingsA);
  const resultB = analyze('B) offset — page 100 (deep, SKIP 990)', timingsB);
  const resultC = analyze('C) cursor — first page', timingsC);
  const resultE = analyze('E) filtered + sorted (category + price)', timingsE);
  const resultF = analyze('F) full-text search', timingsF);

  const deepPenalty = resultB.avgMs - resultA.avgMs;
  const deepPct = ((deepPenalty / resultA.avgMs) * 100).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));

  const results = [resultA, resultB, resultC];
  if (resultD) results.push(resultD);
  results.push(resultE, resultF);

  for (const r of results) {
    printResult(r);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(
    `Deep offset penalty (page 100 vs page 1): +${deepPenalty.toFixed(2)}ms (+${deepPct}%)`,
  );
  if (resultD) {
    console.log(
      `Cursor deep page: ${resultD.avgMs}ms vs offset deep page: ${resultB.avgMs}ms`,
    );
  }
  console.log('-'.repeat(70));

  // Cleanup
  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
