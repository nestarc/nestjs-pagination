describe('ApiPaginatedResponse', () => {
  it('should export ApiPaginatedResponse function', async () => {
    const mod = await import('../api-paginated-response.decorator');
    expect(typeof mod.ApiPaginatedResponse).toBe('function');
  });

  it('should export ApiCursorPaginatedResponse function', async () => {
    const mod = await import('../api-paginated-response.decorator');
    expect(typeof mod.ApiCursorPaginatedResponse).toBe('function');
  });

  it('should export ApiPaginationQuery function', async () => {
    const mod = await import('../api-paginated-response.decorator');
    expect(typeof mod.ApiPaginationQuery).toBe('function');
  });

  it('should return a decorator function from ApiPaginatedResponse', async () => {
    const mod = await import('../api-paginated-response.decorator');
    class TestDto { id!: string; }
    const decorator = mod.ApiPaginatedResponse(TestDto);
    expect(typeof decorator).toBe('function');
  });

  it('should return a decorator function from ApiCursorPaginatedResponse', async () => {
    const mod = await import('../api-paginated-response.decorator');
    class TestDto { id!: string; }
    const decorator = mod.ApiCursorPaginatedResponse(TestDto);
    expect(typeof decorator).toBe('function');
  });

  it('should accept configured query options', async () => {
    const mod = await import('../api-paginated-response.decorator');
    class TestDto { id!: string; }
    const decorator = mod.ApiPaginatedResponse(TestDto, {
      sortableColumns: ['id', 'createdAt'],
      searchableColumns: ['email'],
      filterableColumns: { role: ['$eq', '$in'] },
      allowWithDeleted: true,
    });
    expect(typeof decorator).toBe('function');
  });
});
