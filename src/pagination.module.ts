import { DynamicModule, Module } from '@nestjs/common';
import { PAGINATION_MODULE_OPTIONS } from './pagination.constants';
import {
  PaginationModuleOptions,
  PaginationModuleAsyncOptions,
} from './interfaces/pagination-options.interface';

@Module({})
export class PaginationModule {
  static forRoot(options?: PaginationModuleOptions): DynamicModule {
    return {
      module: PaginationModule,
      global: true,
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useValue: options ?? {},
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: PaginationModuleAsyncOptions): DynamicModule {
    return {
      module: PaginationModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }
}
