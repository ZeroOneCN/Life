import { AppError } from '../app-error';

/**
 * AppError 类测试
 */
describe('AppError', () => {
  it('creates error with default values', () => {
    const error = new AppError('出错了');
    expect(error.message).toBe('出错了');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(400);
    expect(error.details).toBeUndefined();
    expect(error.name).toBe('AppError');
  });

  it('creates error with custom status code', () => {
    const error = new AppError('未授权', 401);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe(401);
  });

  it('creates error with custom code and details', () => {
    const error = new AppError('参数错误', 422, 10001, { field: 'email' });
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe(10001);
    expect(error.details).toEqual({ field: 'email' });
  });
});