import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { parsePaginateQuery } from '../pipes/paginate-query.pipe';
import { PaginateQuery } from '../interfaces/paginate-query.interface';

export const Paginate = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PaginateQuery => {
    const request = ctx.switchToHttp().getRequest();
    return parsePaginateQuery(request);
  },
);
