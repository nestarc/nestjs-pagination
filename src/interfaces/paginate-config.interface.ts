import { FilterOperator, SortOrder } from './filter-operator.type';

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
  cursorColumn?: keyof T & string;
  defaultLimit?: number;
  maxLimit?: number;
  withTotalCount?: boolean;

  where?: object;
  allowWithDeleted?: boolean;
}
