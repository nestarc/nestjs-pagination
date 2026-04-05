import { BadRequestException } from '@nestjs/common';

export class InvalidFilterColumnError extends BadRequestException {
  constructor(
    column: string,
    filterableColumns: string[],
    operator?: string,
    allowedOperators?: string[],
  ) {
    const message =
      operator && allowedOperators
        ? `Operator '${operator}' is not allowed for column '${column}'. Allowed operators: ${allowedOperators.join(', ')}`
        : `Column '${column}' is not filterable. Filterable columns: ${filterableColumns.join(', ')}`;
    super(message);
    this.name = 'InvalidFilterColumn';
  }
}
