import { PAGINATE_DEFAULTS_KEY } from '../paginate-defaults.decorator';

describe('@PaginateDefaults', () => {
  it('should store defaults as metadata', async () => {
    const { PaginateDefaults } = await import('../paginate-defaults.decorator');

    class TestController {
      @PaginateDefaults({ defaultLimit: 10, maxLimit: 50 })
      findAll() {}
    }

    const metadata = Reflect.getMetadata(
      PAGINATE_DEFAULTS_KEY,
      TestController.prototype.findAll,
    );
    expect(metadata).toEqual({ defaultLimit: 10, maxLimit: 50 });
  });

  it('should store expanded fields', async () => {
    const { PaginateDefaults } = await import('../paginate-defaults.decorator');

    class TestController {
      @PaginateDefaults({
        defaultLimit: 10,
        maxLimit: 50,
        defaultSortBy: [['createdAt', 'DESC']],
        paginationType: 'cursor',
      })
      findAll() {}
    }

    const metadata = Reflect.getMetadata(
      PAGINATE_DEFAULTS_KEY,
      TestController.prototype.findAll,
    );
    expect(metadata.defaultSortBy).toEqual([['createdAt', 'DESC']]);
    expect(metadata.paginationType).toBe('cursor');
  });
});
