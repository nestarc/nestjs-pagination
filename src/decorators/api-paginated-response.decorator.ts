import { Type, applyDecorators } from '@nestjs/common';
import { FilterOperator } from '../interfaces/filter-operator.type';

let swagger: any;
try {
  swagger = require('@nestjs/swagger');
} catch {
  // @nestjs/swagger not installed — decorators become no-ops
}

export interface ApiPaginationQueryOptions {
  type?: 'offset' | 'cursor';
  sortableColumns?: string[];
  searchableColumns?: string[];
  filterableColumns?: Record<string, FilterOperator[]>;
  allowWithDeleted?: boolean;
}

export function ApiPaginatedResponse(
  dataDto: Type,
  queryOptions: Omit<ApiPaginationQueryOptions, 'type'> = {},
): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, getSchemaPath } = swagger;

  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
              meta: {
                type: 'object',
                properties: {
                  itemsPerPage: { type: 'number', example: 20 },
                  totalItems: { type: 'number', example: 500 },
                  currentPage: { type: 'number', example: 1 },
                  totalPages: { type: 'number', example: 25 },
                  sortBy: { type: 'array', example: [['createdAt', 'DESC']] },
                },
              },
              links: {
                type: 'object',
                properties: {
                  first: { type: 'string' },
                  previous: { type: 'string', nullable: true },
                  current: { type: 'string' },
                  next: { type: 'string', nullable: true },
                  last: { type: 'string' },
                },
              },
            },
          },
        ],
      },
    }),
    ApiPaginationQuery({ type: 'offset', ...queryOptions }),
  );
}

export function ApiCursorPaginatedResponse(
  dataDto: Type,
  queryOptions: Omit<ApiPaginationQueryOptions, 'type'> = {},
): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, getSchemaPath } = swagger;

  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
              meta: {
                type: 'object',
                properties: {
                  itemsPerPage: { type: 'number', example: 20 },
                  hasNextPage: { type: 'boolean', example: true },
                  hasPreviousPage: { type: 'boolean', example: false },
                  startCursor: { type: 'string', nullable: true },
                  endCursor: { type: 'string', nullable: true },
                  sortBy: { type: 'array', example: [['createdAt', 'DESC']] },
                },
              },
              links: {
                type: 'object',
                properties: {
                  current: { type: 'string' },
                  next: { type: 'string', nullable: true },
                  previous: { type: 'string', nullable: true },
                },
              },
            },
          },
        ],
      },
    }),
    ApiPaginationQuery({ type: 'cursor', ...queryOptions }),
  );
}

export function ApiPaginationQuery(
  options: ApiPaginationQueryOptions = {},
): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiQuery } = swagger;
  const type = options.type ?? 'offset';
  const decorators: MethodDecorator[] = [
    ...(type === 'offset'
      ? [ApiQuery({ name: 'page', required: false, type: Number })]
      : [
          ApiQuery({ name: 'after', required: false, type: String }),
          ApiQuery({ name: 'before', required: false, type: String }),
        ]),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      isArray: true,
      example: options.sortableColumns?.[0]
        ? [`${options.sortableColumns[0]}:ASC`]
        : undefined,
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      description: options.searchableColumns?.length
        ? `Searches: ${options.searchableColumns.join(', ')}`
        : undefined,
    }),
  ];

  if (options.filterableColumns) {
    for (const [column, operators] of Object.entries(options.filterableColumns)) {
      decorators.push(ApiQuery({
        name: `filter.${column}`,
        required: false,
        type: String,
        description: `Allowed operators: ${operators.join(', ')}`,
      }));
    }
  }

  if (options.allowWithDeleted) {
    decorators.push(ApiQuery({ name: 'withDeleted', required: false, type: Boolean }));
  }

  return applyDecorators(...decorators);
}
