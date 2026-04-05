import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PaginateService } from '../paginate.service';
import { PaginationModule } from '../pagination.module';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';
import { PaginateQuery } from '../interfaces/paginate-query.interface';
import { PaginateConfig } from '../interfaces/paginate-config.interface';
import { PaginateDefaults } from '../decorators/paginate-defaults.decorator';

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
