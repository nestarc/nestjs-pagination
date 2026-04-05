import { DynamicModule, Module } from '@nestjs/common';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';
import { PaginationModuleOptions } from '../interfaces/pagination-options.interface';

@Module({})
export class TestPaginationModule {
  static register(options?: PaginationModuleOptions): DynamicModule {
    return {
      module: TestPaginationModule,
      providers: [
        {
          provide: PAGINATION_MODULE_OPTIONS,
          useValue: options ?? {},
        },
      ],
      exports: [PAGINATION_MODULE_OPTIONS],
    };
  }
}
