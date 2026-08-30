import { useCallback, useRef, useState } from 'react';

/**
 * API 缓存配置
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 轻量级 API 缓存 Hook
 *
 * 对不变数据（汇率、配置、枚举值等）提供内存缓存，减少重复请求。
 * 支持自定义 TTL（生存时间），到期后自动失效。
 *
 * @param defaultTTL - 默认缓存时间（毫秒），默认 5 分钟
 *
 * @returns { get, set, invalidate, clear }
 *
 * @example
 * ```tsx
 * const cache = useApiCache(5 * 60 * 1000);
 *
 * const fetchRates = async () => {
 *   const cached = cache.get<ExchangeRate[]>('exchange-rates');
 *   if (cached) return cached;
 *   const rates = await api.getRates();
 *   cache.set('exchange-rates', rates);
 *   return rates;
 * };
 * ```
 */
export function useApiCache(defaultTTL = 5 * 60 * 1000) {
  const cacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map());
  const [, setTick] = useState(0);

  /**
   * 获取缓存数据
   * @returns 缓存数据（未过期），或 undefined（不存在/已过期）
   */
  const get = useCallback(<T>(key: string): T | undefined => {
    const entry = cacheRef.current.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttl) {
      cacheRef.current.delete(key);
      return undefined;
    }
    return entry.data as T;
  }, []);

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 数据
   * @param ttl 可选，自定义过期时间（毫秒）
   */
  const set = useCallback(<T>(key: string, data: T, ttl?: number) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? defaultTTL,
    });
  }, [defaultTTL]);

  /**
   * 使指定键的缓存失效
   */
  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  /**
   * 清除所有缓存
   */
  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  /**
   * 获取缓存条目数
   */
  const size = cacheRef.current.size;

  return { get, set, invalidate, clear, size };
}

/**
 * 带缓存的数据获取 Hook
 *
 * 封装 API 请求 + 缓存逻辑，返回标准 { data, loading, error } 状态。
 *
 * @example
 * ```tsx
 * const { data: rates, loading } = useCachedFetch(
 *   'exchange-rates',
 *   () => api.getRates(),
 *   10 * 60 * 1000,
 * );
 * ```
 */
export function useCachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttl = 5 * 60 * 1000,
) {
  const cache = useApiCache(ttl);
  const [data, setData] = useState<T | undefined>(() => cache.get<T>(cacheKey));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      cache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [cacheKey, fetcher, cache]);

  return { data, loading, error, refresh };
}