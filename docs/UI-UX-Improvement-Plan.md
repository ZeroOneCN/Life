# LifeOS UI/UX 交互体验改进计划

> 版本：v1.0 | 状态：规划中 | 创建时间：2026-06-02

---

## 一、项目背景与目标

### 1.1 背景

LifeOS 项目当前采用 Linear-inspired 设计语言（Plus Jakarta Sans + Noto Sans SC 字体，暗色/亮色双主题），视觉层面已具备较好的基础。但在**交互体验**方面存在明显短板：卡片组件缺乏悬浮反馈、点击无触感、键盘导航不可见、移动端触摸反馈缺失。整体呈现"静态展示"而非"有生命力的产品"。

### 1.2 目标

| 维度 | 当前状态 | 目标状态 |
|------|---------|---------|
| 卡片 hover 覆盖率 | ~10%（仅5处） | 95%+ |
| 点击按压反馈 | 0 处 | 全局覆盖 |
| 键盘可访问性 | 无 focus 样式 | 所有可交互元素可见焦点 |
| 移动端适配 | hover 粘滞态 | touch-active 替代方案 |
| 过渡动画品质 | 基础 ease | ease-out-expo 专业曲线 |
| 入场动画 | 无 | staggered reveal |

### 1.3 参考标杆

- **Linear App** — 卡片聚光灯跟随、staggered 入场、ease-out-expo 曲线
- **Vercel Dashboard** — 多层柔和阴影、微缩放、精致的 border 渐变
- **Notion** — 左侧色条指示、简洁的 hover 提亮

---

## 二、现状审计结果

### 2.1 已有交互效果（仅 5 处）

| 选择器 | 文件位置 | 效果描述 | 评级 |
|--------|---------|---------|------|
| `.dash-module-card:hover` | `index.css:5432` | `translateY(-2px)` + 边框变色 + 主色阴影发光 | ⭐⭐⭐ 最佳实践 |
| `.storage-overview-grid .stat-card:hover` | `index.css:4394` | `translateY(-2px)` + 边框加深 | ⭐⭐ 仅 Storage 模块生效 |
| `.data-table tr:hover td` | `index.css:1516` | 背景染 6% 主色 | ⭐⭐ 表格行基础反馈 |
| `.btn:hover` | `index.css:1392` | `translateY(-1px)` | ⭐⭐ 按钮微动 |
| `.btn-secondary:hover` | `index.css:1410` | 背景色加深 | ⭐ 基础 |

### 2.2 完全无交互反馈的卡片清单（14 类）

| 卡片类型 | CSS 选择器 | 所在模块 | 使用场景 |
|----------|-----------|---------|---------|
| 通用卡片 | `.card` | 全局 | 各模块容器、表单区域 |
| 统计卡片 | `.stat-card` | Dashboard/各概览页 | 数值指标展示 |
| 分区卡片 | `.section-card` | 全局 | 功能分区容器 |
| 通知渠道卡 | `.channel-card` | 通知中心 | 邮件/企微/钉钉等配置 |
| 开关设置卡 | `.switch-card` / `.notification-status-card` | 各设置区 | 开关+说明组合 |
| 健身图表卡 | `.fitness-chart-card` | Fitness | 折线图/柱状图容器 |
| 健身洞察卡 | `.fitness-insight-card` | Fitness | AI 分析结论展示 |
| 外汇图表卡 | `.forex-chart-card` | Forex | K线/盈亏图容器 |
| 外汇持仓行 | `.forex-position-row` | Forex | 持仓数据行 |
| 外汇结果卡 | `.forex-result-card` | Forex | 计算器结果展示 |
| 外汇洞察卡 | `.forex-insight-card` | Forex | AI 分析文字卡片 |
| 外汇品种汇总 | `.forex-instrument-summary-card` | Forex | 品种统计表格 |
| 购物导入行 | `.shopping-import-table tr` | Shopping | 导入预览表格行 |
| 号卡列表项 | DataTable 行 | Card | 号卡/账单/充值列表 |

### 2.3 诊断总结

```
问题严重度分布：
├── 🔴 严重：90%+ 卡片无任何 hover 反馈 → 用户感知"页面是死的"
├── 🟠 高危：模式不一致 → dash-module-card 有动画但其他 card 没有
├── 🟡 中等：缺少 :active 按压反馈 → 点击无触觉确认
├── 🟡 中等：无 :focus-visible → Tab 键导航不可用
└── 🔵 低优：无入场动画 → 页面切换时内容突然出现
```

---

## 三、改进方案详解

### Phase 1 — P0 全局基础悬浮系统（核心基础）

**目标**：给所有 `.card` 和 `.stat-card` 统一添加 hover/active 反馈。

**改动范围**：仅 `client/src/index.css`

**改动量**：~35 行新增 CSS

**具体规则**：

```css
/* ========== P0: 全局卡片基础悬浮系统 ========== */

.card,
.stat-card {
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.card:hover,
.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-hairline-strong);
  box-shadow:
    0 4px 12px color-mix(in srgb, black 6%, transparent),
    0 1px 3px color-mix(in srgb, black 4%, transparent);
}

.card:active,
.stat-card:active {
  transform: translateY(0) scale(0.99);
  transition-duration: 0.08s;
}
```

**设计决策说明**：

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 上浮距离 | `-2px` | 与现有 dash-module-card 保持一致，不会太夸张 |
| 缓动曲线 | `cubic-bezier(0.22, 1, 0.36, 1)` | Linear/Vercel 同款 ease-out-expo，起始快结束慢，轻盈感 |
| 阴影策略 | 双层阴影（大范围模糊 + 小范围清晰） | 模拟真实光源，比单层更有层次 |
| 按压效果 | `scale(0.99)` + 极短过渡 `0.08s` | 模拟物理按键回弹，确认用户操作已接收 |

**影响组件**（自动生效，无需逐个修改）：

- [ ] 所有 `.card` 容器
- [ ] 所有 `.stat-card` 数据卡片
- [ ] `.section-card` 内嵌的子卡片
- [ ] Storage 概览 stat-card（已有 hover 的会被覆盖统一）
- [ ] 各模块的 overview 区域统计卡片

**不影响**（需单独处理）：
- `.dash-module-card` — 已有更好的效果，保持不变
- `.channel-card` / `.switch-card` — 工具型卡片，P2 单独处理
- 图表/洞察类卡片 — P2a 单独处理
- 表格行 — P2c 单独处理

**验收标准**：

- [ ] 打开任意模块页面，鼠标移入任意 `.card` 或 `.stat-card`，应有 2px 上浮 + 边框加深 + 阴影浮现
- [ ] 点击卡片时有轻微收缩回弹（scale 0.99）
- [ ] 动画流畅不卡顿（60fps）
- [ ] 不破坏现有布局（无 overflow clipping）

---

### Phase 2 — P1 可点击增强卡片（Dashboard 聚光灯）

**目标**：为 Dashboard 首页的模块入口卡片添加光标跟随聚光灯效果。

**改动范围**：`index.css` ~40 行 + `App.tsx` 或新建 hook ~20 行 JS

**视觉效果**：

```
默认态：        悬浮态：
┌──────────┐   ┌──────────┐
│ 📊 Finance │   │ ✨📊 Finance │  ← 光标处有径向渐变光晕
│ 本月支出   │   │ 本月支出   │     边框染主色
│ ¥12,580  │   │ ¥12,580  │     上浮3px + 微缩放
└──────────┘   └──────────┘
               ↑ box-shadow 多层发光
```

**CSS 规则**：

```css
/* ========== P1: 可点击增强卡片（聚光灯）========== */

.dash-module-card,
.clickable-card {
  position: relative;
  overflow: hidden;
}

.dash-module-card::before,
.clickable-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  background: radial-gradient(
    600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    color-mix(in srgb, var(--color-primary) 8%, transparent),
    transparent 40%
  );
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.dash-module-card:hover::before,
.clickable-card:hover::before {
  opacity: 1;
}

.dash-module-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 20%, var(--color-hairline));
  transform: translateY(-3px) scale(1.005);
  box-shadow:
    0 8px 24px color-mix(in srgb, var(--color-primary) 10%, transparent),
    0 2px 6px color-mix(in srgb, black 4%, transparent);
}
```

**JS 部分**（追踪鼠标更新 CSS 变量）：

```typescript
// useSpotlight.ts — 自定义 Hook
import { useCallback, useRef } from 'react';

export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    ref.current.style.setProperty('--mouse-x', `${x}%`);
    ref.current.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  return { ref, onMouseMove: handleMouseMove };
}
```

**使用方式**：

```tsx
// DashboardPage.tsx
const { ref, onMouseMove } = useSpotlight<HTMLDivElement>();
return (
  <div className="dash-module-card" ref={ref} onMouseMove={onMouseMove}>
    ...
  </div>
);
```

**验收标准**：

- [ ] 鼠标在 dash-module-card 上移动时，光晕跟随光标位置变化
- [ ] 移出卡片时光晕平滑淡出（0.35s fade）
- [ ] 上浮距离从 2px 增加到 3px，增加 0.5% 微缩放
- [ ] 阴影带主色调（10% 透明度主色 + 黑色底层）
- [ ] 性能：hover 时 GPU 加速（transform + opacity 仅触发 composite）

---

### Phase 3 — P2 模块专用精细化

#### P2a — 数据展示卡片（图表/洞察类）

**适用组件**：`.fitness-chart-card`, `.fitness-insight-card`, `.forex-chart-card`, `.forex-insight-card`, `.forex-result-card`, `.forex-instrument-summary-card`

**设计意图**：这类卡片偏向"信息阅读"，不需要太强的位移，但需要明确的边界感和层次提升。

```css
.fitness-chart-card,
.fitness-insight-card,
.forex-chart-card,
.forex-insight-card,
.forex-result-card,
.forex-instrument-summary-card {
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    box-shadow 0.25s ease;
}

.fitness-chart-card:hover,
.fitness-insight-card:hover,
.forex-chart-card:hover,
.forex-insight-card:hover,
.forex-result-card:hover,
.forex-instrument-summary-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-hairline));
  box-shadow: 0 6px 20px color-mix(in srgb, black 7%, transparent);
}
```

#### P2b — 工具型卡片（通知渠道/设置开关）

**适用组件**：`.channel-card`, `.switch-card`, `.notification-status-card`

**设计意图**：工具型卡片应克制——只需微妙的边框和阴影提示"这是可交互区域"，不做位移避免干扰表单操作。

```css
.channel-card,
.switch-card,
.notification-status-card {
  transition: border-color 0.18s ease, box-shadow 0.2s ease;
}

.channel-card:hover,
.switch-card:hover,
.notification-status-card:hover {
  border-color: var(--color-hairline-strong);
  box-shadow: 0 2px 10px color-mix(in srgb, black 4%, transparent);
}
```

#### P2c — 表格行增强

**改动点**：

1. 增强 hover 背景色对比度
2. 添加 active 按压态
3. 可点击行左侧主色指示条

```css
.data-table tbody tr {
  transition: background 0.15s ease;
}

.data-table tbody tr:hover td {
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}

.data-table tbody tr:active td {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.data-table tbody tr.clickable-row {
  cursor: pointer;
  position: relative;
}

.data-table tbody tr.clickable-row::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.data-table tbody tr.clickable-row:hover::before {
  opacity: 1;
}
```

**TSX 配合**：DataTable 组件中给可点击行添加 `clickable-row` class。

---

### Phase 4 — P3 可访问性与移动端

#### 3a — 键盘 Focus Visible

```css
.card:focus-visible,
.stat-card:focus-visible,
.dash-module-card:focus-visible,
.clickable-card:focus-visible,
.channel-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

#### 3b — 移动端 Touch 优化

```css
@media (hover: none) and (pointer: coarse) {
  .card:active,
  .stat-card:active,
  .dash-module-card:active {
    transform: scale(0.98);
    transition-duration: 0.05s;
  }

  .card:hover,
  .stat-card:hover,
  .dash-module-card:hover {
    transform: none;
    box-shadow: none;
  }

  /* 移动端禁用聚光灯（性能+体验） */
  .dash-module-card::before,
  .clickable-card::before {
    display: none;
  }
}
```

**技术说明**：`@media (hover: none) and (pointer: coarse)` 是现代 CSS 媒体查询，精确匹配触屏设备（手机/平板），不会影响桌面端。

---

### Phase 5 — P4 进阶微交互（可选锦上添花）

#### 5a — Staggered 入场动画

**场景**：页面切换或数据加载完成后，卡片依次淡入上浮。

**CSS**：

```css
@keyframes card-reveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.card.animate-in,
.stat-card.animate-in {
  opacity: 0;
  animation: card-reveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

**JS 实现**：在父容器挂载后，遍历子元素添加 `animate-in` class 并设置递增 delay：

```typescript
function animateCards(container: HTMLElement) {
  const cards = container.querySelectorAll('.card, .stat-card');
  cards.forEach((card, i) => {
    (card as HTMLElement).style.animationDelay = `${i * 60}ms`;
    card.classList.add('animate-in');
  });
}
```

**注意**：需配合 `IntersectionObserver` 做视口内才触发，避免离屏动画浪费性能。

#### 5b — 数字滚动计数器

**场景**：stat-card 中的数值在数据刷新时有动画过渡。

```css
@keyframes count-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.stat-value.updated {
  animation: count-up 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  color: var(--color-primary);
}
```

**触发时机**：API 数据返回后，检测数值变化，临时添加 `updated` class，动画结束后移除。

#### 5c — Loading 骨架屏脉冲

**场景**：数据加载中的占位符。

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    var(--color-surface-3) 50%,
    var(--color-surface-2) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 6px;
}
```

---

## 四、实施计划

### 4.1 阶段划分与排期

| 阶段 | 内容 | 改动文件 | 新增行数 | 依赖 | 风险 |
|------|------|---------|---------|------|------|
| **Phase 1** | P0 全局基础悬浮 | `index.css` | ~35 | 无 | 低 |
| **Phase 2** | P1 聚光灯增强 | `index.css` + 新建 hook | ~60 | Phase 1 | 低 |
| **Phase 3a** | 图表/洞察卡片 | `index.css` | ~25 | Phase 1 | 低 |
| **Phase 3b** | 设置/通知卡片 | `index.css` | ~15 | Phase 1 | 低 |
| **Phase 3c** | 表格行增强 | `index.css` + TSX 微调 | ~30 + 5 | Phase 1 | 低 |
| **Phase 4** | 无障碍+移动端 | `index.css` | ~25 | Phase 1 | 低 |
| **Phase 5a** | 入场动画 | `index.css` + hook | ~40 | Phase 1 | 中（性能） |
| **Phase 5b** | 数字滚动 | `index.css` + TSX | ~20 | Phase 1 | 低 |
| **Phase 5c** | 骨架屏 | `index.css` | ~15 | 无 | 低 |

**建议实施顺序**：Phase 1 → Phase 3b → Phase 3c → Phase 4 → Phase 3a → Phase 2 → Phase 5

理由：
1. Phase 1 改动最小收益最大（35 行覆盖全局）
2. Phase 3b/c 是纯 CSS 无风险改动
3. Phase 4 是专业必备项
4. Phase 2 聚光灯是最吸睛的效果，放在中期作为亮点
5. Phase 5 是锦上添花，最后做

### 4.2 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `client/src/index.css` | **修改** | 所有 CSS 规则集中在此文件 |
| `client/src/hooks/useSpotlight.ts` | **新建** | P1 聚光灯鼠标追踪 Hook |
| `client/src/hooks/useStaggeredReveal.ts` | **新建** | P5a 入场动画 Hook |
| `client/src/components/ui/ClickableCard.tsx` | **新建**（可选） | 封装 clickable-card 通用组件 |

### 4.3 回归测试检查点

每个 Phase 完成后需验证：

- [ ] **Desktop Chrome/Edge**：所有 hover 效果流畅（60fps via DevTools Performance）
- [ ] **Desktop Firefox**：兼容性验证（cubic-bezier 和 color-mix 支持）
- [ ] **Mobile Safari iOS**：touch-active 生效，hover 不粘滞
- [ ] **Mobile Android Chrome**：同上
- [ ] **暗色主题**：所有效果在暗色模式下视觉协调
- [ ] **亮色主题**：同上
- [ ] **键盘导航**：Tab 键能遍历所有可交互卡片，focus ring 可见
- [ ] **屏幕阅读器**：不影响语义结构（aria-label 无变化）
- [ ] **Reduced Motion**：`prefers-reduced-motion: reduce` 时禁用动画
- [ ] **性能**：Lighthouse Performance 分数不下降

### 4.4 Reduced Motion 适配

```css
@media (prefers-reduced-motion: reduce) {
  .card,
  .stat-card,
  .dash-module-card,
  .clickable-card,
  .fitness-chart-card,
  .forex-chart-card {
    transition: none !important;
  }

  .card:hover,
  .stat-card:hover,
  .dash-module-card:hover {
    transform: none !important;
  }

  .card.animate-in,
  .stat-card.animate-in {
    animation: none !important;
    opacity: 1;
  }
}
```

---

## 五、风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|---------|
| `color-mix()` 兼容性 | 低（现代浏览器均支持） | 中 | 回退方案：使用 `rgba()` 固定值 |
| 聚光灯性能（频繁重绘） | 低（仅 opacity + background-position） | 低 | 已使用 `will-change: opacity` + GPU 合成层 |
| `overflow: hidden` 裁切阴影 | 中 | 中 | 父容器确保 `overflow: visible` 或改用 `filter: drop-shadow` |
| 入场动画导致布局抖动 | 中 | 中 | 使用 `opacity` + `transform`（不触发 layout） |
| 移动端 300ms 点击延迟 | 低 | 低 | 已用 `touch-action: manipulation` + active 替代 hover |

---

## 六、成功指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|---------|
| 卡片 hover 覆盖率 | ~10% | >95% | CSS 选择器审计 |
| 可交互元素 focus 可见率 | 0% | 100% | Tab 键遍历测试 |
| 移动端 touch 反馈覆盖率 | 0% | >90% | 真机测试 |
| Lighthouse Accessibility | 基准分 | 不下降 | Lighthouse CI |
| Lighthouse Performance | 基准分 | 不下降 | Lighthouse CI |
| 用户主观评分（交互流畅度） | 待测 | >4/5 | 内部体验评审 |

---

## 七、附录

### A. CSS 变量参考

项目当前使用的颜色变量（来自 `index.css` root）：

```css
--color-primary: #4f8cff;
--color-surface-1: #ffffff / #0f0f12;
--color-surface-2: #fafafa / #16161d;
--color-surface-3: #f0f0f2 / #1e1e26;
--color-hairline: rgba(0,0,0,.08) / rgba(255,255,255,.08);
--color-hairline-strong: rgba(0,0,0,.15) / rgba(255,255,255,.15);
--color-ink: #111118 / #ededed;
--color-ink-subtle: #6b6b7b / #8b8b9e;
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--shadow-soft: 0 1px 3px rgba(0,0,0,.06);
```

### B. 缓动曲线速查

| 名称 | 值 | 适用场景 |
|------|-----|---------|
| ease-out-expo | `cubic-bezier(0.22, 1, 0.36, 1)` | 位移、阴影（主要曲线） |
| ease-out-back | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性回弹（如按钮按压释放） |
| ease-in-out | `cubic-bezier(0.65, 0, 0.35, 1)` | 颜色、透明度变化 |
| spring | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | 特殊强调动画 |

### C. 浏览器支持矩阵

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| `color-mix()` | 111+ | 113+ | 16.2+ | 111+ |
| `@media (hover:none)` | 41+ | 64+ | 9+ | 16+ |
| `:focus-visible` | 86+ | 85+ | 15.4+ | 86+ |
| `cubic-bezier()` | 全支持 | 全支持 | 全支持 | 全支持 |
| `prefers-reduced-motion` | 74+ | 63+ | 10.1+ | 79+ |
