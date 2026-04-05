import { BadRequestException } from '@nestjs/common';

export class InvalidCursorError extends BadRequestException {
  constructor(cursor: string) {
    super(`Invalid cursor: '${cursor}'`);
    this.name = 'InvalidCursor';
  }
}
