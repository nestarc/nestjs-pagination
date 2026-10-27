import { ModuleMetadata } from '@nestjs/common';
import { SortOrder } from './filter-operator.type';

export interface PaginationModuleOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultPaginationType?: 'offset' | 'cursor';
  defaultSortBy?: [string, SortOrder][];
  /** @deprecated Currently ignored. Pagination links are always included. */
  withLinks?: boolean;
  /** Include totals in cursor responses by default; endpoint countStrategy takes precedence. */
  withTotalCount?: boolean;
  /** @deprecated Currently ignored. Pagination metadata always uses camelCase. */
  fieldNamingStrategy?: 'camelCase' | 'snake_case';
}

export interface PaginationModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<PaginationModuleOptions> | PaginationModuleOptions;
  inject?: any[];
}
