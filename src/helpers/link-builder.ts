export function buildOffsetLinks(
  path: string,
  currentPage: number,
  limit: number,
  totalPages: number,
): {
  first: string;
  previous: string | null;
  current: string;
  next: string | null;
  last: string;
} {
  return {
    first: `${path}?page=1&limit=${limit}`,
    previous: currentPage > 1 ? `${path}?page=${currentPage - 1}&limit=${limit}` : null,
    current: `${path}?page=${currentPage}&limit=${limit}`,
    next: currentPage < totalPages ? `${path}?page=${currentPage + 1}&limit=${limit}` : null,
    last: `${path}?page=${totalPages}&limit=${limit}`,
  };
}

export function buildCursorLinks(
  path: string,
  limit: number,
  endCursor: string | null,
  startCursor: string | null,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
): {
  current: string;
  next: string | null;
  previous: string | null;
} {
  const base = `${path}?limit=${limit}`;

  return {
    current: endCursor ? `${base}&after=${endCursor}` : base,
    next: hasNextPage && endCursor ? `${base}&after=${endCursor}` : null,
    previous: hasPreviousPage && startCursor ? `${base}&before=${startCursor}` : null,
  };
}
