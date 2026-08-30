import { describe, it, expect } from 'vitest';
import { buildApiErrorMessage } from '../api';

/**
 * buildApiErrorMessage 测试
 */
describe('buildApiErrorMessage', () => {
  it('returns fallback for null error', () => {
    expect(buildApiErrorMessage(null)).toBe('请求失败，请稍后重试。');
  });

  it('returns fallback for undefined error', () => {
    expect(buildApiErrorMessage(undefined)).toBe('请求失败，请稍后重试。');
  });

  it('returns custom fallback', () => {
    expect(buildApiErrorMessage(null, '自定义错误')).toBe('自定义错误');
  });

  it('handles Error instance', () => {
    const error = new Error('something went wrong');
    expect(buildApiErrorMessage(error)).toBe('something went wrong');
  });

  it('handles string error as Error instance', () => {
    expect(buildApiErrorMessage(new Error('直接错误信息'))).toBe('直接错误信息');
  });
});