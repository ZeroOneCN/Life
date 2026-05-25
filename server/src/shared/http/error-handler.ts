import type { NextFunction, Request, Response } from 'express';

export function notFoundHandler(_request: Request, response: Response) {
  response.status(404).json({
    code: 404,
    message: 'not_found',
    data: null,
  });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : 'internal_server_error';
  response.status(500).json({
    code: 500,
    message,
    data: null,
  });
}
