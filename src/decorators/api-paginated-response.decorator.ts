import { Type, applyDecorators } from '@nestjs/common';

let swagger: any;
try {
  swagger = require('@nestjs/swagger');
} catch {
  // @nestjs/swagger not installed — decorators become no-ops
}

export function ApiPaginatedResponse(dataDto: Type): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, ApiQuery, getSchemaPath } = swagger;

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
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'sortBy', required: false, type: String, isArray: true }),
    ApiQuery({ name: 'search', required: false, type: String }),
  );
}

export function ApiCursorPaginatedResponse(dataDto: Type): MethodDecorator {
  if (!swagger) {
    return applyDecorators();
  }

  const { ApiOkResponse, ApiQuery, getSchemaPath } = swagger;

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
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'after', required: false, type: String }),
    ApiQuery({ name: 'before', required: false, type: String }),
    ApiQuery({ name: 'sortBy', required: false, type: String, isArray: true }),
    ApiQuery({ name: 'search', required: false, type: String }),
  );
}
