export class AppError extends Error {
  statusCode: number;

  code: number;

  details?: unknown;

  constructor(message: string, statusCode = 400, code = statusCode, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
