# LifeOS2 UI 配色体系改进方案

> 聚焦色彩维度：现状诊断 → 问题分析 → 改进方向（不写代码）

---

## 一、当前配色架构

### 1.1 色彩变量体系（CSS Custom Properties）

```
:root (暗色默认)
├── --color-primary:       #5e6ad2  (靛蓝/紫蓝)
├── --color-primary-hover: #7684ef
├── --color-primary-focus: #4957c7
├── --color-canvas:        #010102  (近黑底)
├── --color-surface-1~4:   #0f1011 → #1f2125 (4级灰阶表面)
├── --color-hairline:      #23252a  (分割线)
├── --color-hairline-strong: #343741
├── --color-ink:           #f7f8f8  (主文字)
├── --color-ink-muted:     #d0d6e0
├── --color-ink-subtle:    #8a8f98
├── --color-ink-tertiary:  #636973
├── --color-success:       #27a644  (绿)
├── --color-danger:        #e5484d  (红)
└── --color-warning:       #f59e0b  (琥珀黄)

[data-theme="light"] 仅覆盖 canvas/surface/hairline/ink/shadow
→ primary / semantic 颜色在亮暗模式下完全相同
```

### 1.2 配色来源

基于 **Linear Design** 暗色主题色板（DESIGN.md），以 `#5e6ad2` 紫蓝为唯一主色。

---

## 二、诊断发现的 7 个配色问题

### 问题 1：全局单色疲劳 — 整个 App 只有 1 种主色

**现象**：
- 所有模块的激活态、选中态、链接、按钮、焦点环 → **全部是 `#5e6ad2`**
- 健康中心 / 财务中心 / 生活中心 / 投资中心 → **视觉上无色彩区分**
- 17 个子页面看起来像是同一个页面的 17 个 Tab

**影响**：用户需要读文字才能辨别当前在哪个模块，缺乏「一眼识别」的色彩身份。

### 问题 2：语义色缺位 — 无 Info 色，Success/Danger/Warning 缺少浅色背景变体

**现状**：
```
有：--color-success(纯色) / danger(纯色) / warning(纯色)
缺：--color-info / --color-info-bg
缺：success-bg / danger-bg / warning-bg / info-bg (浅色背景用)
```

实际代码中只能用 `color-mix(in srgb, var(--color-success) 14%, transparent)` 这种方式拼凑浅色背景，
没有预定义的语义背景色变量。导致：
- Tag 组件的背景色凭感觉 `mix 14%`
- 状态卡片的背景色各处不一致（有的 10%，有的 12%，有的 18%）
- Insight 卡片的 `.is-warning` / `.is-positive` / `.is-neutral` 各自定义硬编码

### 问题 3：硬编码颜色散落 — 约 23 处绕过变量系统

| 位置 | 硬编码值 | 应该用什么 |
|------|---------|-----------|
| 排名索引 badge | `#5e6ad2` + `#fff` | `var(--color-primary)` + `var(--color-on-primary)` |
| 日程提醒条 | `#f59e0b` × 3处 | `var(--color-warning)` |
| 日程文字 | `#b45309` | `var(--color-warning-dark)` （不存在）|
| 导入确认按钮 hover | `#2ecc71` | `var(--color-success-hover)` （不存在）|
| 背景光晕 | `rgba(94,106,210,0.12)` | `var(--color-primary-alpha-100)` |
| 图表色板 | fitness.ts 中 9 个独立 hex | 统一色板变量 |
| PDF 背景 | `#0f1011` | `var(--color-surface-1)` |

### 问题 4：图表色板混乱 — 每个模块自己定义

**fitness.ts** 自定义色板：
```js
breakfast: '#f0b90b', lunch: '#0ecb81', dinner: '#f6465d', snack: '#1eaedb'
cardio: '#f6465d', strength: '#1eaedb', flexibility: '#a855f7'
low: '#848e9c', medium: '#f0b90b', high: '#f6465d'
```

**StorageDashboardSection** 又一套：
```js
['#5e6ad2', '#1eaedb', '#27a644', '#f59e0b', '#e5484d', '#10b981']
```

**Forex / Subscription** 又各自内联 `#27a644` / `#e5484d` / `#5e6ad2`

→ **同一语义（盈利=绿/亏损=红）在各模块中不完全一致**
→ **无统一的图表色板常量**

### 问题 5：亮色模式主色未优化 — 同一套紫蓝用在白底上对比度/观感欠佳

**现状**：`--color-primary: #5e6ad2` 在暗色模式(`#010102`底)上表现好，
但在亮色模式(`#f6f7fb`底)上：
- 这个偏暗的紫蓝在白色背景下显得**沉闷、不够鲜明**
- Linear 官方亮色主题的主色其实会更亮一些
- `primary-hover: #7684ef` 在白底上还行，但 base 色偏重

### 问题 6：缺少模块身份色（Module Accent Colors）

**现象**：4 大中心的图标和标题区域没有任何色彩标识。

| 中心 | 当前状态 | 建议 |
|------|---------|------|
| **健康中心** | 无专属色 | 绿色系 `#10b981` (翠绿) |
| **财务中心** | 无专属色 | 蓝色系 `#3b82f6` (天蓝) |
| **生活中心** | 无专属色 | 橙色系 `#f59e0b` (琥珀) |
| **投资中心** | 无专属色 | 紫色系 `#8b5cf6` (紫罗兰) |

**应用位置**：侧边栏菜单 icon 底色、模块页面 header 装饰线、Dashboard 卡片左侧彩条、统计数字的 accent 色

### 问题 7：渐变使用单一且保守

**当前渐变模式**（出现 30 次）几乎全部是同一种：
```css
linear-gradient(180deg, surface-3混合 → surface-2)  /* 微妙纵向渐变 */
linear-gradient(135deg, primary 10% → surface-2 94%) /* 仅用于 stat-card */
```

**缺失**：
- 无品牌渐变（如 primary → 紫粉渐变作为 hero 区域装饰）
- 无模块特色渐变（健康=绿渐变、财务=蓝渐变...）
- body 的 radial-gradient 光晕仅 2 处且非常微弱（12% + 8% opacity），几乎不可见

---

## 三、改进方案（6 个方向）

### 方向 A：建立完整色阶体系（Token 化）

#### A1. 主色色阶（Primary Scale）

从单一的 3 个 primary 变量扩展为完整的 9 级色阶：

```
现有：primary(500) / hover(400) / focus(600)

建议补充：
  primary-50   最浅背景（如选中态填充）
  primary-100  浅底色（tag/badge 背景）
  primary-200  边框色
  primary-300  弱文字
  primary-400  hover 态（现 hover 值）
  primary-500  基准色（现 primary 值）
  primary-600  focus/按下态（现 focus 值）
  primary-700  深色文字（深底上的 primary 文字）
  primary-800  最深（特殊强调）
  primary-900  极深
```

#### A2. 语义色完整色阶

```
每个语义色都需要：base / light / lighter / bg / border / text
例 Success:
  success:        #27a644   (基准)
  success-light:  #34d058   (hover)
  success-bg:     rgba(39,166,68,0.10)  (浅背景)
  success-border: rgba(39,166,68,0.25)  (边框)
  success-text:   #1a7a32   (深底上的成功文字)

同理 Danger / Warning / Info(新增)
```

#### A3. 中性色灰阶校验

当前 4 级 surface + 4 级 ink + 2 级 hairline = 10 级中性色。
检查相邻两级之间的对比度是否足够（WCAG AA 要求至少 3:1 for large text, 4.5:1 for body text）。

**已知风险点**：
- 暗色模式下 `surface-3(#191b1d)` vs `surface-4(#1f2125)` 差异极小，肉眼难辨
- `ink-subtle(#8a8f98)` vs `ink-tertiary(#636973)` 在某些屏幕上可能混淆

---

### 方向 B：引入模块身份色（Module Identity）

#### B1. 四中心专属色定义

```css
/* 建议色值（需在暗色/亮色双模式下验证） */
--color-module-health:    #10b981;  /* 翠绿 - 健康/活力 */
--color-module-finance:   #3b82f6;  /* 天蓝 - 财务/信任 */
--color-module-life:      #f59e0b;  /* 琥珀 - 生活/温暖 */
--color-module-invest:    #8b5cf6;  /* 紫罗兰 - 投资/成长 */
```

#### B2. 应用场景

| 场景 | 实现方式 | 效果 |
|------|---------|------|
| **侧边栏菜单 icon** | icon 容器 background 使用对应模块色 10% | 每个中心一目了然 |
| **Dashboard 模块卡片** | 左侧 3px 彩条使用模块色 | 快速定位 |
| **页面 Header 区域** | 标题下方装饰线或 icon 底色 | 页面身份标识 |
| **统计数字 accent** | 关键指标的高亮色用模块色而非 global primary | 层次丰富 |
| **空状态插图色调** | EmptyState 的 icon 色跟随所属模块 | 一致性 |

---

### 方向 C：统一图表色板（Chart Palette）

#### C1. 定义全局图表色板变量

```css
/* 顺序排列的 12 色数据色板（经过无障碍验证） */
--chart-1: #5e6ad2;  /* 默认主色 */
--chart-2: #10b981;  /* 绿 */
--chart-3: #f59e0b;  /* 琥珀 */
--chart-4: #e5484d;  /* 红 */
--chart-5: #3b82f6;  /* 蓝 */
--chart-6: #8b5cf6;  /* 紫 */
--chart-7: #ec4899;  /* 粉 */
--chart-8: #14b8a6;  /* 青 */
--chart-9: #f97316;  /* 橙 */
--chart-10: #64748b; /* 灰 */
--chart-11: #84cc16; /* 黄绿 */
--chart-12: #06b6d4; /* 青蓝 */

/* 固定语义映射（所有模块统一） */
--chart-profit:   #27a644;  /* 盈利/正向 */
--chart-loss:     #e5484d;  /* 亏损/负向 */
--chart-neutral:  #94a3b8;  /* 中性/持平 */
```

#### C2. 清理现有硬编码

将 fitness.ts / StorageDashboardSection / ForexDashboardSection / SubscriptionDashboardSection 中的
内联 hex 全部替换为引用 `var(--chart-N)` 或 `var(--chart-semantic)`。

---

### 方向 D：亮色模式主色优化

#### D1. 亮色模式独立主色

```css
[data-theme="light"] {
  /* 亮底上更鲜活的主色 */
  --color-primary: #4f46e5;      /* 更深的靛蓝，白底对比度更好 */
  --color-primary-hover: #6366f1;
  --color-primary-focus: #4338ca;

  /* 或者保持 hue 但提高 saturation */
  /* --color-primary: #5558E3; */  /* 更亮的紫蓝 */
}
```

#### D2. 语义色亮色适配

部分语义色在亮色底上需要调整以确保 WCAG 对比度：
- `warning: #f59e0b` 在白底上对比度约 3.2:1（小字不够 AA）→ 亮色模式加深为 `#d97706`
- `success: #27a644` 白底对比度约 3.0:1 → 亮色模式调整为 `#16a34a`

---

### 方向 E：增强视觉层次与氛围

#### E1. Body 背景光晕强化

当前 body 有 2 个极弱的 radial-gradient（12% + 8% opacity），几乎看不见。

建议：
- 提升到 15%~20% opacity，或扩大覆盖范围到 40%
- 增加第 3 个光点（比如右下角用 module-life 琥珀色）
- 让暗色模式的背景有微妙的"深度感"而不是纯平黑

#### E2. 渐变多样化

当前 30 处渐变几乎全是 `surface-3 → surface-2` 微妙纵向渐变。

建议增加：
- **品牌渐变**：primary → primary-shift（用于登录页 hero、Dashboard 欢迎区）
- **模块渐变**：各中心页面顶部 header 区域使用对应 module 色的微妙渐变
- **Glassmorphism 元素**：卡片/面板使用 `backdrop-filter: blur()` + 半透明渐变（已有 sidebar 用了 blur，可扩展到浮层/card）

#### E3. 卡片层次深化

当前卡片只有 1 种背景(surface-2) + 1 种边框(hairline)：

建议增加 **层级变体**：
```
card-elevated:  surface-1 + 微妙阴影向上投影（重要/交互区域）
card-default:   surface-2 + hairline（常规内容，当前默认）
card-subtle:    surface-3 + 无边框或极淡边（次要/嵌套信息）
card-ghost:     透明/半透明（悬浮层/overlay 内）
```

---

### 方向 F：消除硬编码 + 建立 Color API

#### F1. 全面审计并替换硬编码颜色

目标：**index.css 和 .tsx 中零硬编码 hex/rgba**（除 chart palette 变量定义处外）。

重点清理清单：
| 硬编码值 | 替换为 |
|---------|--------|
| `#5e6ad2` (排名badge等) | `var(--color-primary)` |
| `#f59e0b` (日程条×3) | `var(--color-warning)` |
| `#b45309` (日程文字) | 新建 `--color-warning-strong` |
| `#2ecc71` (按钮hover) | 新建 `--color-success-hover` |
| `#0f1011` (PDF背景) | `var(--color-surface-1)` |
| `rgba(94,106,210,...)` (光晕) | `var(--color-primary-alpha-100)` 等 |
| `#fff` (文字色) | `var(--color-canvas-inverse)` 或 `--color-white` |

#### F2. 建立组件级颜色约束

为通用组件定义颜色使用规范：
```
Button:       只允许 primary / success / danger / warning (ghost 变体)
Tag/Badge:    只允许 semantic 色 (success/danger/warning/info/primary)
Card:         只允许 surface / hairline / ink 系列
Input:        只允许 surface / hairline / ink / primary(focus)
Icon:         允许 ink系列 / primary / semantic / module 色
Chart:        只允许 chart-palette 变量
```

---

## 四、优先级建议

```
投入产出比排序：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 最高优先（影响全App观感）
  ① 方向A：色阶 Token 化 — 解决 root cause，其他方向的基础
  ② 方向B：模块身份色 — 4个中心视觉区分，用户体验质变
  ③ 方向F：消除硬编码 — 技术债务清理，必须做

🟡 高优先（显著提升品质）
  ④ 方向C：统一图表色板 — 数据一致性
  ⑤ 方向D：亮色主色优化 — 亮日模式体验

🟢 中优先（锦上添花）
  ⑥ 方向E：视觉氛围增强 — 渐变/光晕/卡片层次
```

## 五、执行建议

如果决定实施，建议按以下顺序：

**第一步（基础层）**：方向 A + F
- 扩展 CSS 变量为完整色阶
- 全局替换硬编码
- 这一步不改视觉效果，只改代码结构，**零风险**

**第二步（识别层）**：方向 B + C
- 引入 4 中心模块色
- 统一图表色板
- 用户能立即感知到的变化

**第三步（精调层）**：方向 D + E
- 亮色模式主色优化
- 渐变/光晕/卡片层次增强
- 最后做微调，因为最主观

---

*文档生成时间：2026-06-02*
