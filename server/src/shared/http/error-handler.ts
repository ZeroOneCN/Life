import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error';

export function notFoundHandler(_request: Request, response: Response) {
  response.status(404).json({
    code: 404,
    message: 'not_found',
    data: null,
  });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      data: error.details ?? null,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'internal_server_error';
  response.status(500).json({
    code: 500,
    message,
    data: null,
  });
}
