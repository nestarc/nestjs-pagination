import { SetMetadata } from '@nestjs/common';
import { SortOrder } from '../interfaces/filter-operator.type';

export const PAGINATE_DEFAULTS_KEY = 'PAGINATE_DEFAULTS';

export interface PaginateDefaultsOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultSortBy?: [string, SortOrder][];
  paginationType?: 'offset' | 'cursor';
}

export const PaginateDefaults = (defaults: PaginateDefaultsOptions) =>
  SetMetadata(PAGINATE_DEFAULTS_KEY, defaults);
