import { FilterOperator, SortOrder } from './filter-operator.type';
import { PaginateQuery } from './paginate-query.interface';
import { CursorPayload } from '../cursor/cursor.encoder';

export type CountStrategy = 'exact' | 'none' | 'custom';
export type CursorStrategy = 'prisma' | 'keyset';

export interface PaginateConfig<T = any> {
  sortableColumns: (keyof T & string)[];

  defaultSortBy?: [keyof T & string, SortOrder][];
  nullSort?: 'first' | 'last';

  searchableColumns?: (keyof T & string)[];

  filterableColumns?: {
    [K in keyof T & string]?: FilterOperator[];
  };

  relations?: Record<string, boolean | object>;
  select?: (keyof T & string)[];

  paginationType?: 'offset' | 'cursor';
  /**
   * Column used as cursor for cursor-based pagination. Defaults to 'id'.
   *
   * Requirements:
   * - Must be included in `sortableColumns`
   * - Should have unique, sequential values (e.g., auto-increment ID, UUID v7, timestamp)
   * - Non-unique cursor columns may produce inconsistent results across pages
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination
  */
  cursorColumn?: keyof T & string;
  cursorStrategy?: CursorStrategy;
  cursorColumns?: (keyof T & string)[];
  encodeCursor?: (payload: CursorPayload) => string;
  decodeCursor?: (cursor: string) => CursorPayload;
  defaultLimit?: number;
  maxLimit?: number;
  withTotalCount?: boolean;
  countStrategy?: CountStrategy;
  countQuery?: (args: {
    where: Record<string, any>;
    delegate: { count: (args: any) => Promise<number> };
    query: PaginateQuery;
    config: PaginateConfig<T>;
  }) => Promise<number>;

  where?: object;
  allowWithDeleted?: boolean;
}
