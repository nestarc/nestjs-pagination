import { DynamicModule, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAGINATION_MODULE_OPTIONS } from './pagination.constants';
import {
  PaginationModuleOptions,
  PaginationModuleAsyncOptions,
} from './interfaces/pagination-options.interface';
import { PaginateService } from './paginate.service';

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
        PaginateService,
        Reflector,
      ],
      exports: [PAGINATION_MODULE_OPTIONS, PaginateService],
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
        PaginateService,
        Reflector,
      ],
      exports: [PAGINATION_MODULE_OPTIONS, PaginateService],
    };
  }
}
