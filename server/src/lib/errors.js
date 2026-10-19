import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);
