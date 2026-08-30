import { successResponse, buildListData } from '../response';

/**
 * API 响应工具函数测试
 */
describe('successResponse', () => {
  it('returns success response with data', () => {
    const result = successResponse({ id: '1' });
    expect(result).toEqual({
      code: 0,
      message: 'ok',
      data: { id: '1' },
    });
  });

  it('returns success response with custom message', () => {
    const result = successResponse(null, '自定义消息');
    expect(result.message).toBe('自定义消息');
  });

  it('returns success response with array data', () => {
    const result = successResponse([1, 2, 3]);
    expect(result.data).toEqual([1, 2, 3]);
  });
});

/**
 * 分页列表数据构建测试
 */
describe('buildListData', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }];

  it('builds list data with default pagination', () => {
    const result = buildListData(items);
    expect(result.items).toHaveLength(3);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(3);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(1);
  });

  it('builds list data with custom pagination', () => {
    const result = buildListData(items, 2, 2, 10);
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(2);
    expect(result.total).toBe(10);
    expect(result.totalPages).toBe(5);
  });

  it('calculates totalPages correctly for partial pages', () => {
    const result = buildListData(items, 1, 2, 5);
    expect(result.totalPages).toBe(3);
  });

  it('handles empty items', () => {
    const result = buildListData([], 1, 20, 0);
    expect(result.items).toHaveLength(0);
    expect(result.totalPages).toBe(1);
  });

  it('handles single page with many items', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
    const result = buildListData(manyItems, 1, 20, 10);
    expect(result.totalPages).toBe(1);
  });
});