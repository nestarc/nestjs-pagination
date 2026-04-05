import { Test } from '@nestjs/testing';
import { PaginationModule } from '../pagination.module';
import { PAGINATION_MODULE_OPTIONS } from '../pagination.constants';

describe('PaginationModule', () => {
  it('should create module with forRoot', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 10, maxLimit: 50 })],
    }).compile();
    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(10);
    expect(options.maxLimit).toBe(50);
  });

  it('should create module with forRoot using defaults', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot()],
    }).compile();
    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options).toBeDefined();
  });

  it('should create module with forRootAsync', async () => {
    const module = await Test.createTestingModule({
      imports: [
        PaginationModule.forRootAsync({
          useFactory: () => ({ defaultLimit: 15, maxLimit: 75 }),
        }),
      ],
    }).compile();
    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(15);
    expect(options.maxLimit).toBe(75);
  });

  it('should make options globally available', async () => {
    const module = await Test.createTestingModule({
      imports: [PaginationModule.forRoot({ defaultLimit: 25 })],
    }).compile();
    const options = module.get(PAGINATION_MODULE_OPTIONS);
    expect(options.defaultLimit).toBe(25);
  });
});
