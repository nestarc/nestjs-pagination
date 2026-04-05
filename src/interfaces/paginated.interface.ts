import { SortOrder } from './filter-operator.type';

export interface Paginated<T> {
  data: T[];
  meta: {
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
    sortBy: [string, SortOrder][];
    search?: string;
    filter?: Record<string, string>;
  };
  links: {
    first: string;
    previous: string | null;
    current: string;
    next: string | null;
    last: string;
  };
}

export interface CursorPaginated<T> {
  data: T[];
  meta: {
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
    sortBy: [string, SortOrder][];
    search?: string;
    filter?: Record<string, string>;
    totalItems?: number;
  };
  links: {
    current: string;
    next: string | null;
    previous: string | null;
  };
}
