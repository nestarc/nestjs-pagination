import { SetMetadata } from '@nestjs/common';
import { PaginateConfig } from '../interfaces/paginate-config.interface';

export const PAGINATE_DEFAULTS_KEY = 'PAGINATE_DEFAULTS';

export const PaginateDefaults = (
  defaults: Partial<Pick<PaginateConfig, 'defaultLimit' | 'maxLimit'>>,
) => SetMetadata(PAGINATE_DEFAULTS_KEY, defaults);
