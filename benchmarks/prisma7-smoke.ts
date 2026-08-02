import assert from 'node:assert/strict';
import { paginate } from '../src/paginate';
import { PaginateConfig } from '../src/interfaces/paginate-config.interface';
import { Product } from './generated/client/client';
import { createPrismaClient } from './prisma-client';

const prisma = createPrismaClient();

const config = {
  sortableColumns: ['id', 'createdAt', 'price'],
  defaultSortBy: [['id', 'ASC']],
  filterableColumns: {
    price: ['$gte'],
  },
} satisfies PaginateConfig<Product>;

async function main(): Promise<void> {
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
  await prisma.product.deleteMany();
  await prisma.product.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Alpha',
        category: 'A',
        price: 10,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Beta',
        category: 'B',
        price: 20,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Gamma',
        category: 'A',
        price: 30,
      },
    ],
  });

  const offset = await paginate<Product>(
    {
      path: '/products',
      page: 1,
      limit: 2,
      filter: { price: '$gte:10' },
    },
    prisma.product,
    config,
  );
  assert.deepEqual(offset.data.map((product) => product.name), ['Alpha', 'Beta']);
  assert.equal(offset.meta.totalItems, 3);

  const firstCursorPage = await paginate<Product>(
    { path: '/products', limit: 2 },
    prisma.product,
    {
      ...config,
      paginationType: 'cursor',
      cursorColumn: 'id',
    },
  );
  assert.deepEqual(
    firstCursorPage.data.map((product) => product.name),
    ['Alpha', 'Beta'],
  );
  assert.ok('endCursor' in firstCursorPage.meta);
  assert.ok(firstCursorPage.meta.endCursor);

  const secondCursorPage = await paginate<Product>(
    {
      path: '/products',
      limit: 2,
      after: firstCursorPage.meta.endCursor,
    },
    prisma.product,
    {
      ...config,
      paginationType: 'cursor',
      cursorColumn: 'id',
    },
  );
  assert.deepEqual(
    secondCursorPage.data.map((product) => product.name),
    ['Gamma'],
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Prisma 7 compatibility smoke test passed');
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    console.error(error);
    process.exitCode = 1;
  });
