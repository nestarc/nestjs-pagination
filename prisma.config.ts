import { defineConfig } from 'prisma/config';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:5434/pagination_test';

export default defineConfig({
  schema: 'benchmarks/prisma/schema.prisma',
  datasource: {
    url: DATABASE_URL,
  },
});
