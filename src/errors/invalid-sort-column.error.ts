import { BadRequestException } from '@nestjs/common';

export class InvalidSortColumnError extends BadRequestException {
  constructor(column: string, sortableColumns: string[]) {
    super(
      `Column '${column}' is not sortable. Sortable columns: ${sortableColumns.join(', ')}`,
    );
    this.name = 'InvalidSortColumn';
  }
}
