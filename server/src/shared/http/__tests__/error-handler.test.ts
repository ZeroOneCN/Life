import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/app-error';
import { errorHandler, notFoundHandler } from '../error-handler';

/**
 * 错误处理中间件测试
 */
function createMockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('notFoundHandler', () => {
  it('returns 404 response', () => {
    const req = {} as Request;
    const res = createMockRes();
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: 404,
      message: 'not_found',
      data: null,
    });
  });
});

describe('errorHandler', () => {
  it('handles AppError', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = jest.fn();
    const error = new AppError('参数错误', 422, 10001, { field: 'email' });

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      code: 10001,
      message: '参数错误',
      data: { field: 'email' },
    });
  });

  it('handles generic Error', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = jest.fn();
    const error = new Error('未知错误');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      message: '未知错误',
      data: null,
    });
  });

  it('handles non-Error thrown values', () => {
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = jest.fn();

    errorHandler('string error', req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      message: 'internal_server_error',
      data: null,
    });
  });
});