import { Injectable, Optional, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAGINATION_MODULE_OPTIONS } from './pagination.constants';
import { PaginationModuleOptions } from './interfaces/pagination-options.interface';
import { PaginateQuery } from './interfaces/paginate-query.interface';
import { PaginateConfig } from './interfaces/paginate-config.interface';
import { Paginated, CursorPaginated } from './interfaces/paginated.interface';
import { paginate } from './paginate';
import { PAGINATE_DEFAULTS_KEY, PaginateDefaultsOptions } from './decorators/paginate-defaults.decorator';

@Injectable()
export class PaginateService {
  constructor(
    @Optional()
    @Inject(PAGINATION_MODULE_OPTIONS)
    private readonly moduleOptions: PaginationModuleOptions = {},
    private readonly reflector: Reflector,
  ) {}

  async paginate<T>(
    query: PaginateQuery,
    delegate: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
    config: PaginateConfig<T>,
    handler?: Function,
  ): Promise<Paginated<T> | CursorPaginated<T>> {
    const mergedConfig = this.mergeConfig(config, handler);
    return paginate(query, delegate, mergedConfig);
  }

  private mergeConfig<T>(
    config: PaginateConfig<T>,
    handler?: Function,
  ): PaginateConfig<T> {
    // Read @PaginateDefaults metadata from handler
    const defaults: PaginateDefaultsOptions | undefined = handler
      ? this.reflector.get<PaginateDefaultsOptions>(PAGINATE_DEFAULTS_KEY, handler)
      : undefined;

    // Priority: config (highest) > @PaginateDefaults (medium) > module options (lowest)
    return {
      ...config,
      defaultLimit:
        config.defaultLimit ??
        defaults?.defaultLimit ??
        this.moduleOptions.defaultLimit,
      maxLimit:
        config.maxLimit ??
        defaults?.maxLimit ??
        this.moduleOptions.maxLimit,
      defaultSortBy:
        config.defaultSortBy ??
        (defaults?.defaultSortBy as any) ??
        (this.moduleOptions.defaultSortBy as any),
      paginationType:
        config.paginationType ??
        defaults?.paginationType ??
        this.moduleOptions.defaultPaginationType,
    };
  }
}
