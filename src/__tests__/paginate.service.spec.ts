import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaginateService } from '../paginate.service';
import { PaginationModule } from '../pagination.module';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
import { PaginateDefaults } from '../decorators/paginate-defaults.decorator';
import { PaginationModuleOptions } from '../interfaces/pagination-options.interface';
import { paginate } from '../paginate';

interface User {
  id: string;
  name: string;
  createdAt: Date;
}

function createMockDelegate(data: any[] = [], count: number = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(data),
    count: jest.fn().mockResolvedValue(count),
  };
}

const baseConfig: PaginateConfig<User> = {
  sortableColumns: ['id', 'name', 'createdAt'],
};

describe('PaginateService', () => {
  describe('global option resolution', () => {
    const modules: TestingModule[] = [];

    afterEach(async () => {
      await Promise.all(modules.splice(0).map((module) => module.close()));
    });

    async function createService(options: PaginationModuleOptions, asyncFactory = false) {
      const module = await Test.createTestingModule({
        imports: [asyncFactory
          ? PaginationModule.forRootAsync({ useFactory: async () => options })
          : PaginationModule.forRoot(options)],
      }).compile();
      modules.push(module);
      return module.get(PaginateService);
    }

    it.each([false, true])('applies registered defaults and cursor totals (async factory: %s)', async (asyncFactory) => {
      const service = await createService({
        defaultLimit: 4,
        maxLimit: 6,
        defaultSortBy: [['id', 'DESC']],
        defaultPaginationType: 'cursor',
        withTotalCount: true,
      }, asyncFactory);
      const delegate = createMockDelegate([], 10);

      const first = await service.paginate({ path: '/users' }, delegate, baseConfig);
      expect(first.meta).toEqual(expect.objectContaining({ itemsPerPage: 4, totalItems: 10 }));
      expect(delegate.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        take: 5,
        orderBy: [{ id: 'desc' }],
      }));
      expect(delegate.count).toHaveBeenCalledWith({ where: {} });

      const limited = await service.paginate({ path: '/users', limit: 100 }, delegate, baseConfig);
      expect(limited.meta.itemsPerPage).toBe(6);
      expect(delegate.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 7 }));
    });

    it.each([false, true])('honors endpoint count overrides (async factory: %s)', async (asyncFactory) => {
      const service = await createService({
        defaultPaginationType: 'cursor',
        withTotalCount: true,
      }, asyncFactory);
      const delegate = createMockDelegate([], 10);

      const withoutTotals = await service.paginate({ path: '/users' }, delegate, {
        ...baseConfig,
        withTotalCount: false,
      });
      expect(withoutTotals.meta).not.toHaveProperty('totalItems');
      expect(delegate.count).not.toHaveBeenCalled();

      const explicitNone = await service.paginate({ path: '/users' }, delegate, {
        ...baseConfig,
        countStrategy: 'none',
      });
      expect(explicitNone.meta).not.toHaveProperty('totalItems');
      expect(delegate.count).not.toHaveBeenCalled();

      const explicitExact = await service.paginate({ path: '/users' }, delegate, {
        ...baseConfig,
        withTotalCount: false,
        countStrategy: 'exact',
      });
      expect(explicitExact.meta.totalItems).toBe(10);
      expect(delegate.count).toHaveBeenCalledTimes(1);
    });

    it('can enable cursor totals on an endpoint when the module disables them', async () => {
      const service = await createService({
        defaultPaginationType: 'cursor',
        withTotalCount: false,
      });
      const delegate = createMockDelegate([], 10);

      const result = await service.paginate({ path: '/users' }, delegate, {
        ...baseConfig,
        withTotalCount: true,
      });

      expect(result.meta.totalItems).toBe(10);
      expect(delegate.count).toHaveBeenCalledTimes(1);
    });

    it('keeps defaults isolated between applications and the standalone function', async () => {
      const firstService = await createService({
        defaultLimit: 2,
        defaultPaginationType: 'cursor',
        withTotalCount: true,
      });
      const secondService = await createService({
        defaultLimit: 5,
        defaultPaginationType: 'cursor',
        withTotalCount: false,
      }, true);
      const firstDelegate = createMockDelegate([], 10);
      const secondDelegate = createMockDelegate([], 10);
      const standaloneDelegate = createMockDelegate([], 10);

      const first = await firstService.paginate({ path: '/users' }, firstDelegate, baseConfig);
      const second = await secondService.paginate({ path: '/users' }, secondDelegate, baseConfig);
      const standalone = await paginate({ path: '/users' }, standaloneDelegate, {
        ...baseConfig,
        paginationType: 'cursor',
      });

      expect(first.meta).toEqual(expect.objectContaining({ itemsPerPage: 2, totalItems: 10 }));
      expect(second.meta.itemsPerPage).toBe(5);
      expect(second.meta).not.toHaveProperty('totalItems');
      expect(secondDelegate.count).not.toHaveBeenCalled();
      expect(standalone.meta.itemsPerPage).toBe(20);
      expect(standalone.meta).not.toHaveProperty('totalItems');
      expect(standaloneDelegate.count).not.toHaveBeenCalled();
    });
  });

  it('should apply module defaultLimit when config does not specify one', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 10 })],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };

    await service.paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('should let config override module defaultLimit', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 10 })],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };

    await service.paginate(query, delegate, { ...baseConfig, defaultLimit: 25 });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it('should apply @PaginateDefaults over module options', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 10 })],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };

    class TestController {
      @PaginateDefaults({ defaultLimit: 15 })
      findAll() {}
    }

    await service.paginate(query, delegate, baseConfig, TestController.prototype.findAll);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 15 }),
    );
  });

  it('should let explicit config override @PaginateDefaults', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 10 })],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };

    class TestController {
      @PaginateDefaults({ defaultLimit: 15 })
      findAll() {}
    }

    await service.paginate(query, delegate, { ...baseConfig, defaultLimit: 25 }, TestController.prototype.findAll);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it('should apply module maxLimit', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ maxLimit: 50 })],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { limit: 200, path: '/users' };

    await service.paginate(query, delegate, baseConfig);

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('should work without module options (standalone)', async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: PAGINATION_MODULE_OPTIONS, useValue: {} },
        PaginateService,
        Reflector,
      ],
    }).compile();

    const service = module.get(PaginateService);
    const delegate = createMockDelegate([], 0);
    const query: PaginateQuery = { path: '/users' };

    await service.paginate(query, delegate, baseConfig);

    // Default limit from constants (20)
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it('should be provided by PaginationModule', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot()],
    }).compile();

    const service = module.get(PaginateService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(PaginateService);
  });
});
