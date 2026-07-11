# LifeOS 页面预览生成 Prompt

> 用于生成与 LifeOS 系统设计语言一致的 HTML 预览页面，供用户确认效果后再改正式代码。

---

## 角色

你是一名前端 UI 工程师，需要基于 LifeOS 系统的现有设计语言，生成一个 HTML 预览页面供用户确认效果。预览页面是独立的静态 HTML 文件，不依赖任何框架或构建工具。

## 整体布局

- 左侧固定侧边栏（232px 宽），白底 + 右边框，sticky 定位
- 侧边栏包含：品牌名、分组菜单（带 SVG 图标）、当前页面高亮（主色浅底）
- 主内容区左对齐，padding: 24px 28px，不居中
- 页面顶部放一个"预览模式"标签（黄底胶囊）和页面切换按钮（PillTabs 风格）
- 内容区使用 page-stack 垂直排列，gap: 16px

## 设计系统变量

```css
:root {
  /* 主色 */
  --color-primary: #533afd;
  --color-primary-hover: #665efd;
  --color-primary-press: #2e2b8c;
  --color-primary-soft: #b9b9f9;
  --color-primary-subtle: #ede9fe;
  --color-brand-dark: #1c1e54;
  --color-accent-purple: #7c3aed;

  /* 文字 */
  --color-ink: #0d253d;
  --color-ink-secondary: #273951;
  --color-ink-tertiary: #42567a;
  --color-ink-mute: #64748b;
  --color-ink-subtle: #8b95a5;

  /* 背景 */
  --color-canvas: #ffffff;
  --color-surface-2: #f8f9fc;
  --color-surface-3: #f1f2f7;

  /* 边框 */
  --color-hairline: #e3e8ee;
  --color-border: #cdd2de;

  /* 语义色 */
  --color-success: #28ca42;
  --color-success-bg: rgba(40,202,66,0.10);
  --color-success-strong: #16a34a;
  --color-danger: #ea2261;
  --color-danger-bg: rgba(234,34,97,0.10);
  --color-danger-strong: #e11d48;
  --color-warning: #ffbd2e;
  --color-warning-bg: rgba(255,189,46,0.10);

  /* 字号 */
  --fs-display: 24px;  /* 页面标题 */
  --fs-title: 15px;     /* 卡片标题 */
  --fs-body: 14px;      /* 正文 */
  --fs-label: 13px;    /* 表单标签 */
  --fs-caption: 12px;  /* 辅助文字 */
  --fs-overline: 11px;  /* 标签/overline */

  /* 字体 */
  --font-sans: 'Outfit', 'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif;

  /* 布局 */
  --sidebar-width: 232px;
}
```

## 组件规范

### 1. 统计卡片（StatCard）

- 网格布局：`repeat(auto-fit, minmax(170px, 1fr))`，gap: 10px
- 白底 + hairline 边框 + 10px 圆角
- 底部 3px 色条指示趋势：`.is-up` 绿色、`.is-down` 红色、`.is-neutral` 紫色浅
- hover 时色条变粗 + 微阴影
- 结构：label(11.5px灰) → value(24px粗体深色) → helper(11px浅灰，可嵌入趋势标签)
- 不使用 emoji 或图标，纯文字
- 趋势标签：`.stat-card-trend.is-up` 绿色、`.stat-card-trend.is-down` 红色

```css
.stat-card {
  position: relative;
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 14px 16px 16px;
  overflow: hidden;
}
.stat-card::after {
  content: '';
  position: absolute;
  left: 0; bottom: 0;
  width: 100%; height: 3px;
  background: var(--color-hairline);
  transition: height 0.2s ease;
}
.stat-card:hover::after { height: 4px; }
.stat-card.is-up::after { background: var(--color-success); }
.stat-card.is-down::after { background: var(--color-danger); }
.stat-card.is-neutral::after { background: var(--color-primary-soft); }
```

### 2. 卡片容器（SectionCard）

- 白底 + hairline 边框 + 10px 圆角 + padding: 16px 18px
- 标题前加 3px 主色竖条（`card-title-bar::before`）
- 标题 15px 粗体，描述 12px 灰色
- header 左右布局：标题在左，操作按钮/搜索框在右

```css
.card {
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 16px 18px;
}
.card-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title-bar::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--color-primary);
  flex-shrink: 0;
}
```

### 3. 按钮（Btn）

- 胶囊形：`border-radius: 9999px`
- 三种样式：
  - `btn-primary`：主色填充 + 白字 + 主色阴影
  - `btn-secondary`：白底 + 主色描边 + 主色字
  - `btn-ghost`：透明底 + 主色字
- 小号 `btn-sm`：font-size: 12px，padding: 5px 12px
- hover：translateY(-1px) + 阴影加深
- 所有按钮必须设置 `type="button"` 防止意外提交

### 4. 图标按钮（IconButton）

- 30×30px + 8px 圆角 + 透明底
- 三种颜色：默认灰、`btn-icon-secondary` 主色、`btn-icon-danger` 红色
- hover 时浅底高亮
- 使用 SVG 图标（14×14），不用 emoji
- 带 title 属性做 tooltip

### 5. 选项卡（PillTabs）

- 灰底容器（surface-3）+ 999px 圆角 + padding: 4px
- 按钮 32px 高 + 999px 圆角 + 12.5px 字号
- 选中：白底 + 主色字 + 微阴影
- 未选中：透明底 + 灰色字
- 容器使用 `.merged-page-tabs` 类：`width: fit-content; max-width: 100%`

### 6. 表单字段（Field）

- label 12.5px 灰色 + input 8px 圆角 + border 边框
- input padding: 7px 11px + 13px 字号
- focus：主色边框 + 3px 主色半透明阴影
- select：自定义下拉箭头（background-image SVG）
- Field 组件需支持 children 渲染，否则回退到默认 `<input>`

### 7. 表单分组（FormGroup）

- surface-2 浅灰背景 + hairline 边框 + 8px 圆角 + padding: 12px 14px
- 分组标题前加 2.5px 浅紫色竖条
- 标题 11px 大写 + letter-spacing: 0.06em
- 网格布局：3列或5列，gap: 12px
- 使用 `auto-fit` + `minmax(160px, 1fr)` 防止小屏按钮溢出

### 8. 表格（DataTable）

- 外层包裹：8px 圆角 + hairline 边框
- 表头：surface-2 背景 + sticky + 11px 大写 + letter-spacing: 0.04em
- 隔行斑马纹：偶数行 surface-2 背景
- hover 行：primary-subtle 浅紫底（用 `!important` 覆盖斑马纹）
- 核心数据列加粗（`<strong>` 标签）
- 操作列：图标按钮，76px 固定宽
- 文字截断：固定宽度列 + `text-overflow: ellipsis` + `title` 属性显示完整内容

### 9. 步数录入专用

- meta 条：surface-2 背景 + 主色小圆点指示器（6px 圆形）
- 主行：3列网格（步数 + 时间 + 保存按钮），`align-items: flex-end`
- 时间段按钮：38px 宽 + 30px 高 + 8px 圆角，选中为主色浅底
- 快捷时间点：`btn-secondary btn-sm` 胶囊按钮

### 10. 对比卡片

- 3列网格 + 8px gap
- 左边框 3px 色条区分状态（`border-left: 3px solid`）
- 结构：label(11px大写) → value(20px粗体) → helper(11.5px)

### 11. AI 提示区域

- primary-subtle 浅紫背景 + dashed 主色软边框 + 8px 圆角
- 标签胶囊：`.is-cache` 绿色、`.is-ai` 紫色
- 文字 12px 灰色

### 12. 搜索框

- padding: 6px 10px + 8px 圆角 + 160px 宽
- focus 时主色边框

## 布局原则

1. 内容左对齐，不居中
2. 卡片间距 16px（page-stack gap）
3. 表单分组内间距 12px
4. 统计卡片间距 10px
5. 不使用渐变背景，全部纯色
6. 不使用 emoji，用 SVG 图标或纯文字
7. 圆角统一：卡片 10px、输入框 8px、图标按钮 8px、普通按钮 9999px（胶囊形）
8. 阴影克制：默认无阴影，hover 才有微阴影
9. 弹窗（Modal）只能通过关闭按钮关闭，不支持点击外部或 ESC 关闭

## 交互细节

- 所有 hover 有 0.15s ease 过渡
- 页面切换有 fadeIn 动画（0.3s cubic-bezier(0.22, 1, 0.36, 1)）
- 按钮hover 上移 1px
- 统计卡片 hover 色条变粗
- 数据加载时保留旧数据 + `opacity: 0.6; pointer-events: none`，不使用骨架屏
- 切换数据时只更新对应组件，不触发全局页面刷新

## 响应式断点

- `1200px`：表单从3列变2列，保存按钮占满整行
- `1024px`：表单从5列变2列
- `768px`：隐藏侧边栏，所有网格变单列，padding 缩小到 16px

## 用户偏好

- 按钮文本和色调匹配操作语义（如"归档"用主色调，不用危险色）
- 列表操作用 SVG 图标按钮 + tooltip，不用文字标签
- 表格文字截断时用原生 HTML `title` 属性显示完整内容
- 表单使用多列紧凑布局（4列优先），数字输入框限制最大宽度
- 表单提交按钮放在 `<form>` 标签内

## 输出要求

1. 生成一个完整的独立 HTML 文件
2. 所有 CSS 内联在 `<style>` 标签中，使用上述 CSS 变量
3. 包含模拟侧边栏（带菜单项和 SVG 图标）
4. 包含页面切换按钮（如果有多页面）
5. 用 JS 实现页面切换功能
6. 填充合理的示例数据（中文）
7. 表格至少3行数据
8. 所有图标用内联 SVG（Lucide 风格，stroke-width: 2，14×14 尺寸）
9. 表单字段按逻辑分组，每组有标题和浅灰背景

## 使用方式

将上述规范和需要预览的页面业务内容（表单字段、表格列、统计指标）一起提供给 AI，即可生成符合 LifeOS 设计语言的预览 HTML。
