import { create } from 'zustand';

/**
 * 工作区 Pane（Split View 子面板）
 */
export interface WorkspacePane {
  /** Pane 唯一 ID */
  id: string;
  /** 路由路径 */
  path: string;
  /** 选中项 ID（用于详情联动） */
  selectedItemId?: string;
  /** 滚动位置（恢复时用） */
  scrollPosition?: number;
}

/**
 * 工作区布局模式
 * - single: 单视图（默认）
 * - split: 左右分屏
 * - stack: 上下堆叠
 * - grid: 网格（4 卡片）
 */
export type WorkspaceLayout = 'single' | 'split' | 'stack' | 'grid';

/**
 * 工作区 Tab
 */
export interface WorkspaceTab {
  /** Tab 唯一 ID */
  id: string;
  /** 路由路径 */
  path: string;
  /** 显示名 */
  title: string;
  /** 图标名（IconKey） */
  icon?: string;
  /** 是否固定（Pin Tab 排在最前） */
  pinned?: boolean;
  /** 布局模式 */
  layout: WorkspaceLayout;
  /** 子面板（Split 模式下多个） */
  panes: WorkspacePane[];
  /** 筛选状态 */
  filters?: Record<string, unknown>;
  /** 最后访问时间戳 */
  lastVisited: number;
}

/**
 * Inspector 面板模式
 * - detail: 显示选中项详情
 * - ai: AI 副驾
 * - actions: 快捷操作
 * - null: 隐藏
 */
export type InspectorMode = 'detail' | 'ai' | 'actions' | null;

/**
 * 收藏项类型
 * - page: 页面收藏
 * - record: 记录收藏（阶段 C 预留）
 * - filter: 筛选收藏（阶段 C 预留）
 */
export type PinType = 'page' | 'record' | 'filter';

/**
 * 收藏项
 */
export interface WorkspacePin {
  /** 唯一 ID */
  id: string;
  /** 显示名 */
  title: string;
  /** 跳转路径（page 类型） */
  path?: string;
  /** 类型 */
  type: PinType;
  /** 图标名（IconKey） */
  icon?: string;
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 工作区状态（Zustand store）
 */
interface WorkspaceState {
  /** 所有打开的 Tab */
  tabs: WorkspaceTab[];
  /** 当前活跃 Tab ID */
  activeTabId: string | null;
  /** 收藏列表 */
  pins: WorkspacePin[];
  /** Inspector 模式 */
  inspectorMode: InspectorMode;
  /** Inspector 宽度（px） */
  inspectorWidth: number;
  /** Nav Rail 是否展开（240px） */
  navRailExpanded: boolean;
  /** 命令面板是否打开 */
  commandPaletteOpen: boolean;
  /** 最近关闭的 Tab（用于恢复） */
  recentlyClosed: WorkspaceTab[];

  // === Actions ===
  /** 打开新 Tab（或激活已存在的同路径 Tab） */
  openTab: (config: Partial<WorkspaceTab> & { path: string }) => void;
  /** 关闭 Tab */
  closeTab: (id: string) => void;
  /** 设置活跃 Tab */
  setActiveTab: (id: string) => void;
  /** 更新 Tab 配置 */
  updateTab: (id: string, patch: Partial<WorkspaceTab>) => void;
  /** Pin/Unpin Tab */
  pinTab: (id: string, pinned: boolean) => void;
  /** 拖拽排序：将 fromId 移到 toId 位置 */
  reorderTabs: (fromId: string, toId: string) => void;
  /** 关闭其他 Tab（保留指定 id 与已 Pin 的） */
  closeOtherTabs: (id: string) => void;
  /** 设置 Tab 布局模式 */
  setTabLayout: (id: string, layout: WorkspaceLayout) => void;
  /** 设置 Inspector 模式 */
  setInspectorMode: (mode: InspectorMode) => void;
  /** 设置 Inspector 宽度 */
  setInspectorWidth: (width: number) => void;
  /** 添加收藏（页面/记录/筛选） */
  addPin: (pin: Omit<WorkspacePin, 'id' | 'createdAt'>) => void;
  /** 移除收藏 */
  removePin: (id: string) => void;
  /** 根据路径切换收藏状态，返回是否已收藏 */
  togglePinByPath: (config: Omit<WorkspacePin, 'id' | 'createdAt'>) => boolean;
  /** 切换 Nav Rail 展开/折叠 */
  toggleNavRail: () => void;
  /** 打开/关闭命令面板 */
  setCommandPaletteOpen: (open: boolean) => void;
  /** 恢复最近关闭的 Tab */
  restoreRecentlyClosed: () => void;
  /** 从 localStorage 恢复工作区状态 */
  restore: () => void;
}

/** Tab 数量上限 */
const MAX_TABS = 8;

/** localStorage 存储 key */
const STORAGE_KEY = 'lifeos-workspace-v1';

/**
 * 生成 Tab 唯一 ID
 * @returns 形如 tab-xxxx 的 ID
 */
function generateTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 从 localStorage 恢复工作区状态
 * @returns 恢复的 tabs、pins 和 activeTabId，或 null
 */
function restoreFromStorage(): { tabs: WorkspaceTab[]; pins: WorkspacePin[]; activeTabId: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tabs: WorkspaceTab[]; pins?: WorkspacePin[]; activeTabId: string | null };
    if (!Array.isArray(parsed.tabs)) return null;
    // 过滤过期 Tab（超过 7 天未访问）
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const validTabs = parsed.tabs.filter((t) => t.lastVisited >= sevenDaysAgo);
    const pins = Array.isArray(parsed.pins) ? parsed.pins : [];
    return { tabs: validTabs, pins, activeTabId: parsed.activeTabId };
  } catch {
    return null;
  }
}

/**
 * 持久化工作区状态到 localStorage
 * @param tabs - Tab 列表
 * @param activeTabId - 活跃 Tab ID
 * @param pins - 收藏列表（可选，缺省时保留 store 内当前值）
 */
function persistToStorage(tabs: WorkspaceTab[], activeTabId: string | null, pins?: WorkspacePin[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId, pins }));
  } catch {
    // localStorage 满或不可用，静默失败
  }
}

/**
 * 工作区状态管理 Store
 *
 * 使用 Zustand 替代 Context，避免频繁的选中项/滚动变化导致全树重渲染。
 * Tab 状态持久化到 localStorage，刷新后恢复。
 */
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  pins: [],
  inspectorMode: null,
  inspectorWidth: 320,
  navRailExpanded: false,
  commandPaletteOpen: false,
  recentlyClosed: [],

  openTab: (config) => {
    const state = get();
    // 如果同路径 Tab 已存在，激活它
    const existing = state.tabs.find((t) => t.path === config.path);
    if (existing) {
      set({
        activeTabId: existing.id,
        tabs: state.tabs.map((t) =>
          t.id === existing.id ? { ...t, lastVisited: Date.now() } : t,
        ),
      });
      persistToStorage(get().tabs, get().activeTabId, get().pins);
      return;
    }

    // 新建 Tab
    const newTab: WorkspaceTab = {
      id: generateTabId(),
      path: config.path,
      title: config.title || config.path,
      icon: config.icon,
      pinned: config.pinned ?? false,
      layout: config.layout ?? 'single',
      panes: config.panes ?? [
        { id: generateTabId(), path: config.path },
      ],
      filters: config.filters,
      lastVisited: Date.now(),
    };

    let nextTabs = [...state.tabs, newTab];

    // 超过上限：按 LRU 关闭非 Pin 的最旧 Tab
    if (nextTabs.length > MAX_TABS) {
      const unpinned = nextTabs.filter((t) => !t.pinned);
      if (unpinned.length > 0) {
        const oldest = unpinned.reduce((a, b) => (a.lastVisited < b.lastVisited ? a : b));
        nextTabs = nextTabs.filter((t) => t.id !== oldest.id);
        set({ recentlyClosed: [...state.recentlyClosed.slice(-9), oldest] });
      }
    }

    set({ tabs: nextTabs, activeTabId: newTab.id });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  closeTab: (id) => {
    const state = get();
    const closed = state.tabs.find((t) => t.id === id);
    if (!closed) return;

    const nextTabs = state.tabs.filter((t) => t.id !== id);
    let nextActiveId = state.activeTabId;

    // 如果关闭的是活跃 Tab，切换到相邻 Tab
    if (state.activeTabId === id) {
      const closedIndex = state.tabs.findIndex((t) => t.id === id);
      const nextTab = nextTabs[closedIndex] || nextTabs[closedIndex - 1] || null;
      nextActiveId = nextTab?.id ?? null;
    }

    set({
      tabs: nextTabs,
      activeTabId: nextActiveId,
      recentlyClosed: [...state.recentlyClosed.slice(-9), closed],
    });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  setActiveTab: (id) => {
    set({
      activeTabId: id,
      tabs: get().tabs.map((t) =>
        t.id === id ? { ...t, lastVisited: Date.now() } : t,
      ),
    });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  updateTab: (id, patch) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  pinTab: (id, pinned) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return;
    const updated = { ...tab, pinned };
    // Pin 的 Tab 排到最前
    const nextTabs = [
      ...state.tabs.filter((t) => t.id !== id && t.pinned),
      ...(pinned ? [updated] : []),
      ...state.tabs.filter((t) => t.id !== id && !t.pinned),
    ];
    set({ tabs: nextTabs });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  setTabLayout: (id, layout) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, layout } : t)),
    });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  reorderTabs: (fromId: string, toId: string) => {
    const state = get();
    if (fromId === toId) return;
    const fromIndex = state.tabs.findIndex((t) => t.id === fromId);
    const toIndex = state.tabs.findIndex((t) => t.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...state.tabs];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({ tabs: next });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  closeOtherTabs: (id: string) => {
    const state = get();
    const kept = state.tabs.filter((t) => t.id === id || t.pinned);
    if (kept.length === state.tabs.length) return;
    const closed = state.tabs.filter((t) => t.id !== id && !t.pinned);
    set({
      tabs: kept,
      activeTabId: state.activeTabId && kept.some((t) => t.id === state.activeTabId)
        ? state.activeTabId
        : id,
      recentlyClosed: [...state.recentlyClosed.slice(-9), ...closed],
    });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  setInspectorMode: (mode) => set({ inspectorMode: mode }),
  setInspectorWidth: (width) => set({ inspectorWidth: Math.max(280, Math.min(560, width)) }),

  addPin: (pin) => {
    const state = get();
    // 避免重复收藏（同 path + type 视为同一项）
    const duplicated = state.pins.some((p) => p.path === pin.path && p.type === pin.type);
    if (duplicated) return;
    const newPin: WorkspacePin = { ...pin, id: generateTabId(), createdAt: Date.now() };
    set({ pins: [...state.pins, newPin] });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  removePin: (id) => {
    set({ pins: get().pins.filter((p) => p.id !== id) });
    persistToStorage(get().tabs, get().activeTabId, get().pins);
  },

  togglePinByPath: (config) => {
    const state = get();
    const existing = state.pins.find((p) => p.path === config.path && p.type === config.type);
    if (existing) {
      get().removePin(existing.id);
      return false;
    }
    get().addPin(config);
    return true;
  },
  toggleNavRail: () => set({ navRailExpanded: !get().navRailExpanded }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  restoreRecentlyClosed: () => {
    const state = get();
    const last = state.recentlyClosed[state.recentlyClosed.length - 1];
    if (!last) return;
    set({ recentlyClosed: state.recentlyClosed.slice(0, -1) });
    get().openTab({ path: last.path, title: last.title, icon: last.icon });
  },

  restore: () => {
    const restored = restoreFromStorage();
    if (restored && restored.tabs.length > 0) {
      set({
        tabs: restored.tabs,
        pins: restored.pins,
        activeTabId: restored.activeTabId || restored.tabs[0].id,
      });
    } else if (restored) {
      // 仅有收藏、无 Tab 时也恢复收藏
      set({ pins: restored.pins });
    }
  },
}));

/**
 * 工作区状态 Hook（便捷别名）
 *
 * 用法：
 * ```tsx
 * const { tabs, activeTabId, openTab } = useWorkspace();
 * const activeTab = useWorkspace((s) => s.tabs.find((t) => t.id === s.activeTabId));
 * ```
 */
export const useWorkspace = useWorkspaceStore;
