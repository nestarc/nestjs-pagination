export function buildSearchCondition(
  search: string | undefined,
  searchableColumns: string[] | undefined,
): Record<string, any> {
  if (!search || !searchableColumns || searchableColumns.length === 0) {
    return {};
  }

  return {
    OR: searchableColumns.map((column) => ({
      [column]: { contains: search, mode: 'insensitive' },
    })),
  };
}
