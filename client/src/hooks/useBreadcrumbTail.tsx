import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * 面包屑尾部（第三级）上下文。
 *
 * 允许页面组件在运行时注入一个动态的第三级面包屑标签，
 * 通常用于展示当前 Tab 名称（如 ['健康中心', '运动健身', '饮食记录']）。
 *
 * 用法：
 * ```tsx
 * const [tab] = usePageTab('dashboard', TABS);
 * useBreadcrumbTail(TAB_LABELS[tab]);
 * ```
 */
interface BreadcrumbTailContextValue {
  tail: string | null;
  setTail: (tail: string | null) => void;
}

const BreadcrumbTailContext = createContext<BreadcrumbTailContextValue>({
  tail: null,
  setTail: () => {},
});

/**
 * 面包屑尾部 Provider，包裹在 MainLayout 内容区。
 */
export function BreadcrumbTailProvider({ children }: { children: React.ReactNode }) {
  const [tail, setTail] = useState<string | null>(null);

  const value = useMemo(() => ({ tail, setTail }), [tail]);

  return (
    <BreadcrumbTailContext.Provider value={value}>
      {children}
    </BreadcrumbTailContext.Provider>
  );
}

/**
 * 获取当前面包屑尾部（第三级），供 MainLayout 消费。
 */
export function useBreadcrumbTailContext() {
  return useContext(BreadcrumbTailContext);
}

/**
 * 注入面包屑第三级标签。
 *
 * 当 `tail` 为非空字符串时，MainLayout 会在静态面包屑后追加此项；
 * 为 null 时不追加。页面卸载或 tail 变化时自动同步。
 *
 * @param tail 第三级标签文本，如 "饮食记录"。传 null 或空字符串则清除。
 */
export function useBreadcrumbTail(tail: string | null | undefined) {
  const { setTail } = useBreadcrumbTailContext();

  useEffect(() => {
    setTail(tail || null);
    return () => {
      setTail(null);
    };
  }, [tail, setTail]);
}
