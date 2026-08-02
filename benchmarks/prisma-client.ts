import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client';

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:5434/pagination_test';

export function createPrismaClient(databaseUrl = DATABASE_URL): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
