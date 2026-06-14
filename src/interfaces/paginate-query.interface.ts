import { SortOrder } from './filter-operator.type';

export interface PaginateQuery {
  limit?: number;
  sortBy?: [string, SortOrder][];
  search?: string;
  filter?: Record<string, string | string[]>;
  withDeleted?: boolean;
  path: string;

  // Offset-based
  page?: number;

  // Cursor-based
  after?: string;
  before?: string;
}
