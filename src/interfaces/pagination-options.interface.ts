import { ModuleMetadata } from '@nestjs/common';
import { SortOrder } from './filter-operator.type';

export interface PaginationModuleOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultPaginationType?: 'offset' | 'cursor';
  defaultSortBy?: [string, SortOrder][];
  withLinks?: boolean;
  withTotalCount?: boolean;
  fieldNamingStrategy?: 'camelCase' | 'snake_case';
}

export interface PaginationModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<PaginationModuleOptions> | PaginationModuleOptions;
  inject?: any[];
}
