# LifeOS 2 — 技术开发文档

> 本文档专门面向**后续开发者**，把项目用到的技术栈、代码结构、设计系统、组件模式、数据流、调试技巧全部整理在一起，作为开发手册持续维护。
>
> 📁 项目地址: `c:\Code\LifeOS2`
> 🛠️ 开发平台: Mac (也兼容 Windows PowerShell 环境)
> 🎨 设计原则: 单一前端 (React) + 单一后端 (Express) + 单一数据库 (SQLite/TypeORM)

---

## 📑 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [本地开发与调试](#4-本地开发与调试)
5. [设计系统（Design Tokens）](#5-设计系统design-tokens)
6. [组件体系](#6-组件体系)
7. [页面与路由](#7-页面与路由)
8. [状态管理 + 数据流](#8-状态管理--数据流)
9. [后端 API 体系](#9-后端-api-体系)
10. [样式编写规范](#10-样式编写规范)
11. [业务模块开发模板](#11-业务模块开发模板)
12. [常见开发任务](#12-常见开发任务)
13. [调试与排错](#13-调试与排错)
14. [代码质量与提交](#14-代码质量与提交)
15. [附录：术语表](#15-附录术语表)

---

## 1. 项目概览

LifeOS 2 是一个**个人生活数字化管理平台**，按 5 大业务域组织：

| 域 | 路由 | 模块 |
|---|---|---|
| 首页 | `/` | Dashboard 总览 |
| 健康中心 | `/health/*` | fitness / medication / checkup / step |
| 财务中心 | `/finance/*` | loan / rent / shopping / subscription / travel |
| 生活中心 | `/life/*` | todo / card / storage |
| 投资中心 | `/investment/*` | forex / crypto / us-stock / hk-stock |
| 通知中心 | `/notifications/*` | notification-center |
| 个人中心 | `/settings/*` | profile |

技术选型为「够用即可」原则：单进程 Node 后端、SQLite 文件库、React 18 + Vite + 单一 `index.css`。所有样式变量化，所有功能模块化。

---

## 2. 技术栈

### 2.1 前端 (`client/`)

| 项 | 版本/库 | 用途 |
|---|---|---|
| 框架 | React 18 + TypeScript 5 | 主框架 |
| 构建 | Vite 5 | 开发/构建 |
| 路由 | React Router 6 | 客户端路由 |
| 状态 | React Context (auth/theme) + useState/useMemo | 轻量级状态 |
| 图表 | Recharts | 趋势/柱状/饼图 |
| 日期 | dayjs | 日期格式化/计算 |
| HTTP | fetch + 拦截器 (`lib/api.ts`) | API 调用 |
| 样式 | 原生 CSS + CSS Variables | 不引入 UI 库 |
| 图标 | 内联 SVG path 字符串 | 不依赖图标包 |

### 2.2 后端 (`server/`)

| 项 | 版本/库 | 用途 |
|---|---|---|
| 运行时 | Node.js 18+ + TypeScript 5 | |
| 框架 | Express 4 | HTTP |
| ORM | TypeORM | 数据库 |
| 数据库 | SQLite (better-sqlite3) | 文件数据库 `lifeos.db` |
| 安全 | helmet + cors + compression | 通用安全中间件 |
| 校验 | zod | DTO/请求体验证 |
| 鉴权 | bcrypt + 自实现 session token | 登录态 |

### 2.3 工具链

| 项 | 工具 |
|---|---|
| 包管理 | npm |
| Lint/Type | tsc --noEmit (项目里没单独配 ESLint，类型由 TS 保证) |
| 代码风格 | 无强制格式化工具，靠团队约定 |
| 开发服务器 | Vite (前端) + tsx watch (后端) |

---

## 3. 目录结构

```
LifeOS2/
├── client/                        # 前端
│   ├── src/
│   │   ├── App.tsx                # 路由入口
│   │   ├── main.tsx               # ReactDOM mount
│   │   ├── index.css              # ★ 全局样式（设计 token + 所有页面样式）
│   │   ├── layout/                # 顶层 layout（MainLayout 侧边栏/顶栏）
│   │   ├── pages/                 # 路由对应的页面
│   │   │   ├── investment/
│   │   │   │   ├── Crypto.tsx
│   │   │   │   ├── Forex.tsx
│   │   │   │   ├── HKStock.tsx
│   │   │   │   ├── USStock.tsx
│   │   │   │   └── ...
│   │   │   ├── life/
│   │   │   ├── finance/
│   │   │   ├── health/
│   │   │   └── ...
│   │   ├── components/            # 可复用 UI 组件 + 业务组件
│   │   │   ├── ui.tsx             # ★ 基础原子组件库（Btn/Modal/Field/...）
│   │   │   ├── page.tsx           # ★ 通用页面布局（PageHeader/SectionCard/StatGrid/EmptyState）
│   │   │   ├── date.tsx           # 日期选择器
│   │   │   ├── health/            # 健康业务组件
│   │   │   ├── finance/
│   │   │   ├── life/
│   │   │   ├── investment/
│   │   │   └── shared/            # 共享业务组件
│   │   ├── services/              # API 调用层
│   │   │   ├── api.ts             # ★ 通用 fetch 拦截器
│   │   │   ├── auth.ts            # 鉴权
│   │   │   ├── forexApi.ts
│   │   │   ├── investmentStorage.ts  # localStorage 投资记录
│   │   │   └── ...
│   │   ├── types/                 # 全局 TypeScript 类型
│   │   ├── hooks/                 # 自定义 hooks
│   │   ├── lib/                   # 工具库
│   │   ├── config/                # 路由/导航配置
│   │   │   └── navigation.tsx
│   │   └── data/                  # 静态数据
│   └── package.json
├── server/                        # 后端
│   ├── src/
│   │   ├── main.ts                # 启动入口
│   │   ├── app.ts                 # Express 应用工厂
│   │   ├── routes.ts              # 路由注册
│   │   ├── shared/                # 共享后端工具
│   │   │   ├── db/                # TypeORM data-source
│   │   │   └── http/              # error-handler / response shape
│   │   └── modules/               # 业务模块（每个一目录）
│   │       ├── finance/           # loan/rent/shopping/subscription/travel
│   │       ├── health/            # checkup/fitness/medication/step
│   │       ├── investment/        # forex
│   │       ├── life/              # todo/card/storage
│   │       ├── notifications/     # notification-center
│   │       └── system/            # auth/dashboard/provision
│   ├── data/                      # SQLite 文件位置
│   ├── tsconfig.json
│   └── package.json
├── DESIGN.md                      # 产品设计文档（业务侧，非技术）
├── README.md                      # 项目说明
└── DEVELOPMENT.md                 # ← 你正在读的这份
```

### 3.1 文件命名约定

- **页面**: `src/pages/<domain>/<Name>.tsx` (PascalCase, 默认导出)
- **业务组件**: `src/components/<domain>/<Name>Section.tsx` (PascalCase + Section 后缀)
- **共享组件**: `src/components/<Name>.tsx`
- **服务**: `src/services/<name>Api.ts` 或 `<name>.ts`
- **类型**: `src/types/<name>.ts`
- **样式**: 全部进 `src/index.css`，按域分块

---

## 4. 本地开发与调试

### 4.1 启动顺序

```bash
# 1. 启动后端（默认端口 4000）
cd server
npm install
npm run dev          # tsx watch src/main.ts

# 2. 启动前端（默认端口 3000；Vite 自动 fallback 到 3001）
cd client
npm install
npm run dev          # vite
```

访问: <http://localhost:3000> (前端，自动代理 `/api` 到 4000)

### 4.2 数据初始化

首次启动后端会自动：
- 创建 `server/data/lifeos.db` (SQLite)
- 同步 TypeORM schema
- 调用 `provision-user-defaults.ts` 给默认用户播种演示数据

如果想重置：
```bash
rm server/data/lifeos.db && npm run dev
```

### 4.3 端口代理 (Vite)

`client/vite.config.ts` 配了 `/api` 代理到 `http://localhost:4000`，前端 fetch 写 `/api/...` 即可。

### 4.4 默认账号

种子用户见 `server/src/modules/system/provision-user-defaults.ts`。开发时通常以该账号登录。

### 4.5 调试工具

| 工具 | 用途 |
|---|---|
| Vite HMR | 前端代码改动自动热更新 |
| React DevTools | 组件树/Hook 状态查看 |
| `console.log` + `debugger` | 常规断点 |
| Network 面板 | 查 API 请求/响应 |
| SQLite Browser | 直接查 `server/data/lifeos.db` |
| `tsx watch` | 后端改代码自动重启 |

---

## 5. 设计系统（Design Tokens）

**所有 token 都在 `client/src/index.css` 第 1-80 行**，改一处全站生效。

### 5.1 颜色（CSS Variables）

#### 5.1.1 亮色（默认）

```css
--color-primary:        #533afd    /* 主色：靛蓝，按钮/链接 */
--color-primary-hover:  #665efd
--color-primary-focus:  #4434d4
--color-primary-press:  #2e2b8c
--color-primary-soft:   #b9b9f9    /* 主色淡背景 */

--color-brand-dark:     #1c1e54    /* 深色背景，dashboard 顶部渐变 */

--color-ink:            #0d253d    /* 主文字 */
--color-ink-secondary:  #273951    /* 次文字 */
--color-ink-mute:       #64748b    /* 弱化文字/描述 */
--color-ink-mute-2:     #61718a
--color-ink-subtle:     #94a3b8    /* 图表轴/placeholder */

--color-canvas:         #ffffff    /* 页面底色 */
--color-canvas-soft:    #f6f9fc    /* 浅色块底 */
--color-canvas-cream:   #f5e9d4    /* 暖色块底 */
--color-surface-1:      #ffffff    /* 卡片底 */
--color-surface-2:      #f8f9fc
--color-surface-3:      #f1f2f7
--color-surface-4:      #eceef5

--color-hairline:        #e3e8ee   /* 1px 边线 */
--color-hairline-input:  #a8c3de
--color-hairline-strong: #cdd2de

--color-success:        #28ca42
--color-success-bg:     rgba(40,202,66,0.10)
--color-danger:         #ea2261
--color-danger-bg:      rgba(234,34,97,0.10)
--color-warning:        #ffbd2e
--color-warning-bg:     rgba(255,189,46,0.10)

--color-ruby:           #ea2261
--color-magenta:        #f96bee
--color-lemon:          #9b6829

--shadow-blue:          rgba(0,55,112,0.08)
--shadow-soft:          0 16px 40px rgba(20,26,36,0.08)
```

#### 5.1.2 暗色（`[data-theme="dark"]`）

通过 `document.documentElement[data-theme="dark"]` 切换，token 全部覆盖：
- canvas/surface 翻转为深灰黑
- ink 翻转为浅色
- hairline 翻转为深色边线
- shadow 变为黑色

切换由 `client/src/hooks/useTheme.tsx` 控制，存 `localStorage:lifeos_theme`。

#### 5.1.3 模块主题色

通过组件根 `style={{ '--invest-accent': '#xxx' }}` 注入：
- Crypto: `#f59e0b` (琥珀)
- US Stock: `#533afd` (靛蓝)
- HK Stock: `#dc2626` (中国红)

### 5.2 字号（7 级 Type Scale）

```css
--fs-display:  36px   /* T1 页面主标题 */
--fs-heading:  24px   /* T2 分区标题 */
--fs-title:    20px   /* T3 卡片/模块标题 */
--fs-body:     16px   /* T4 正文/按钮 */
--fs-label:    14px   /* T5 表单label/表头/描述 */
--fs-caption:  13px   /* T6 注释/元数据 */
--fs-overline: 11px   /* T7 Pill标签/Badge/Eyebrow */
```

使用：`font-size: var(--fs-body);`

### 5.3 圆角

```css
--radius-sm:   8px
--radius-md:   12px
--radius-lg:   18px
--radius-pill: 9999px
```

### 5.4 字体栈

```css
--font-sans:  'Outfit', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
--font-mono:  'JetBrains Mono', monospace;
```

> ⚠️ **重要**：中文渲染坑。`Outfit` 不含中文字形，所有显示中文的 class（stat-value、data-table td、tag 内的中文等）必须显式声明 `font-family: var(--font-sans)`，否则会回退到系统字体不一致。改样式时如果新加了显示文字的元素，记得带 font-family。

### 5.5 间距

没有专门 token，直接用 `padding/margin: 8/12/14/16/18/20/24px`。常用节奏：
- 卡片内边距: `16px 18px`
- 模块间堆叠: `gap: 18px`
- 列表行内 padding: `12px 4px` 或 `8px 0`
- 文本行间距: 1.4-1.55

### 5.6 动效

```css
transition: all 0.18s ease;   /* 悬停反馈 */
transition: width/height 0.4s ease;  /* 柱状/进度增长 */
```

---

## 6. 组件体系

### 6.1 基础原子组件（`client/src/components/ui.tsx`）

> **所有页面 UI 控件必须用这里提供的，不要自己写 button/input/modal。**

| 组件 | 用途 | 关键 props |
|---|---|---|
| `Btn` | 按钮 | `tone`: primary/secondary/danger/danger-fill/ghost, `type`, `onClick` |
| `Field` | 文本输入 | `label`, `value`, `onChange`, `placeholder` |
| `TextArea` | 多行输入 | 同 Field + `rows` |
| `SelectField` | 下拉选择 | 同 Field |
| `DatePickerField` | 日期选择 | `value`, `onChange` |
| `Modal` | 模态框 | `open`, `onClose`, `title`, `footer`, `width` |
| `DeleteModal` | 删除确认 | `open`, `onClose`, `onConfirm`, `title` |
| `PillTabs` | 顶部 tab 切换 | `options`, `value`, `onChange` |
| `Tag` | 标签/徽章 | `tone`: blue/green/orange/red/muted, `children` |
| `Toast` + `useToastState` | 全局轻提示 | `toast`, 自动消失 |
| `DataTable` | 通用表格 | `columns`, `data`, `rowKey` |
| `Pagination` | 分页 | `page`, `totalPages`, `onPageChange` |
| `StatGridSkeleton` | 加载占位 | `cols` |
| `TableSkeleton` | 表格占位 | `rows`, `cols` |

**统一 tag 样式**（所有 `.tag` 变体一致）:
```css
.tag, .tag-blue, .tag-green, .tag-orange, .tag-red, .tag-muted {
  font-weight: 600;
  font-size: var(--fs-body);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
}
```

**按钮 tone 配色**:
- primary: 主色填充白字
- secondary: 边框灰白底
- danger: 边框 + 危险色文字
- danger-fill: 危险色填充白字
- ghost: 无边框透明

### 6.2 页面布局组件（`client/src/components/page.tsx`）

| 组件 | 用途 |
|---|---|
| `PageHeader` | 页面顶部标题 + 副标题，固定结构 |
| `SectionCard` | 内容卡片容器，自带标题/描述/操作区 |
| `StatGrid` | N 等分指标卡网格 |
| `EmptyState` | 空态展示，统一 `title/description/icon` |

使用示例：
```tsx
<PageHeader title="成本看板" subtitle="数据概览、活动流与成本分析" />
<SectionCard
  title="关注列表"
  description="描述..."
  action={<Btn>操作</Btn>}
>
  <DataTable columns={cols} data={rows} rowKey="id" />
</SectionCard>
<StatGrid items={[
  { label: '总数', value: '8', helper: '使用中 6' },
  { label: '累计', value: '¥5530', accent: 'var(--color-primary)' },
]} />
<EmptyState title="暂无数据" description="先录入..." icon="📈" />
```

### 6.3 业务组件（`client/src/components/<domain>/`）

按域组织，每个业务模块拆成若干 `Section` 组件：
- `StorageDashboardSection.tsx` — 仪表盘
- `StorageItemsSection.tsx` — 物品列表
- `ForexTradesSection.tsx` — 外汇交易 CRUD
- `ForexCapitalSection.tsx` — 资金流
- `InvestmentTradePage.tsx` — 投资三市场共用

业务组件一般接收 `settings / showToast / onChanged` 三个 props，自己 useEffect 拉数据。

---

## 7. 页面与路由

### 7.1 路由配置（`client/src/App.tsx` + `config/navigation.tsx`）

- `navigation.tsx` 的 `menuItems` 决定左侧菜单
- 同一文件的 `routes` 数组决定面包屑（`breadcrumb: ['健康中心', '健身', '统计']`）
- 路由 key 就是 URL path，例如 `'/finance/loan?loanTab=statistics'`

### 7.2 Tab 子路由模式

很多页面用 `?tab=` 而不是子路由（保留浏览器历史但简化）：
```tsx
const params = new URLSearchParams(location.search);
const tab = (params.get('tab') || 'dashboard') as InvestmentTab;
const setTab = (next: InvestmentTab) => {
  const search = new URLSearchParams(location.search);
  search.set('tab', next);
  navigate(`${location.pathname}?${search.toString()}`);
};
```

涉及的页面：travel, loan, storage, fitness, step, medication, checkup, subscription, investment 三市场, notifications, system 等。

### 7.3 页面骨架模板

```tsx
export default function XxxPage() {
  return (
    <div className="xxx-page">
      <PageHeader title="..." subtitle="..." />
      <StatGrid items={[...]} />
      <SectionCard title="..." action={...}>
        <PillTabs ... />
      </SectionCard>
      {tab === 'a' ? <XxxA /> : null}
      {tab === 'b' ? <XxxB /> : null}
    </div>
  );
}
```

---

## 8. 状态管理 + 数据流

### 8.1 三层数据

1. **服务端数据** — 来自后端 API，存到 `useState` + `useEffect` 拉取
2. **客户端状态** — 主题、登录态用 React Context（见 `hooks/useTheme.tsx`）
3. **本地存储数据** — 投资三市场用 `localStorage`（见 `services/investmentStorage.ts`）

### 8.2 数据获取模式

```tsx
const [data, setData] = useState<Xxx[]>([]);
const [loading, setLoading] = useState(true);
const [reloadKey, setReloadKey] = useState(0);

const load = useCallback(async () => {
  setLoading(true);
  try {
    const items = await xxxApi.list();
    setData(items);
  } catch (err) {
    showToast(buildApiErrorMessage(err, '加载失败'), 'error');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { void load(); }, [load, reloadKey]);

const reload = () => setReloadKey((k) => k + 1);
```

**关键原则**：
- ✅ 一定要在 `useEffect` 里 fetch，不要在渲染时
- ✅ 所有 Hook 必须在早期 return 之前调用（React Rules of Hooks）
- ✅ 错误用 `buildApiErrorMessage` 统一包装
- ✅ CRUD 操作完成后 `reload()` 刷新列表

### 8.3 API 服务层（`client/src/services/`）

```ts
// xxxApi.ts
import { request } from './api';

export const xxxApi = {
  list: () => request<Xxx[]>('/api/xxx'),
  get: (id: string) => request<Xxx>(`/api/xxx/${id}`),
  create: (draft: XxxDraft) => request<Xxx>('/api/xxx', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: string, patch: Partial<XxxDraft>) => request<Xxx>(`/api/xxx/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  delete: (id: string) => request<void>(`/api/xxx/${id}`, { method: 'DELETE' }),
};
```

### 8.4 `request` 拦截器（`client/src/lib/api.ts`）

自动处理：
- 拼接 baseURL
- 加 `Content-Type: application/json`
- 带 `Authorization: Bearer <token>`（从 localStorage 读 `lifeos_token`）
- 非 200 抛 `ApiError` 含 message/code
- 自动格式化 `code/message/data` 响应包

后端响应统一格式：
```json
{ "code": 0, "message": "ok", "data": { ... } }
```

非 0 时前端抛错，业务错误码 4xx/5xx 都由 `errorHandler` 中间件生成。

---

## 9. 后端 API 体系

### 9.1 路由注册（`server/src/routes.ts`）

```ts
import { Router } from 'express';
import { authRouter } from './modules/system/auth.router';
import { loanRouter } from './modules/finance/loan.router';
// ...

export function createApiRouter() {
  const router = Router();
  router.use('/auth', authRouter);
  router.use('/finance/loan', loanRouter);
  // ...
  return router;
}
```

### 9.2 路由写法（`*.router.ts`）

```ts
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuth } from '../../shared/auth/require-auth';
import { sendOk } from '../../shared/http/response';

const router = Router();

const xxxDraftSchema = z.object({
  name: z.string().trim().min(1).max(64),
  amount: z.number().nonnegative(),
});

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const items = await repo.find({ where: { userId: req.auth.userId } });
  sendOk(res, items);
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const draft = xxxDraftSchema.parse(req.body);
  const item = repo.create({ ...draft, userId: req.auth.userId });
  await repo.save(item);
  sendOk(res, item);
}));

export { router as xxxRouter };
```

### 9.3 共享工具

| 工具 | 位置 | 用途 |
|---|---|---|
| `sendOk(res, data)` | `shared/http/response.ts` | 包装成 `{code:0, message:'ok', data}` |
| `sendError(res, code, msg, status)` | 同上 | 错误响应 |
| `asyncHandler` | `shared/http/async-handler.ts` | 捕获 async 错误到 errorHandler |
| `requireAuth` | `shared/auth/require-auth.ts` | 校验 token，注入 `req.auth` |
| `errorHandler` | `shared/http/error-handler.ts` | 统一错误出口 |
| `notFoundHandler` | 同上 | 404 |

### 9.4 实体（TypeORM Entity）

约定 `*.entity.ts` 后缀：
- 字段名 `snake_case`（用 `@Column({ name: 'xxx_yyy' })`）
- 主键 `id: string` (uuid v4，初始化时 `randomUUID()`)
- 必带 `userId` 列（多用户隔离）
- 软删除用 `isArchived: boolean`，不真删
- 时间用 `createdAt / updatedAt` 自动维护

### 9.5 数据库迁移

项目没配自动 migration，靠 TypeORM `synchronize: true`（开发环境）。生产前需要：
1. 关闭 synchronize
2. 用 typeorm migrations 工具

### 9.6 添加新业务模块步骤

1. `server/src/modules/<domain>/entities/` 写 Entity
2. `server/src/modules/<domain>/<name>.router.ts` 写 API
3. `server/src/routes.ts` 注册
4. `client/src/types/` 定义 TypeScript 类型
5. `client/src/services/<name>Api.ts` 写 fetch
6. `client/src/pages/<domain>/<Name>.tsx` 写页面
7. `client/src/components/<domain>/<Name>Section.tsx` 拆业务组件
8. `client/src/config/navigation.tsx` 加菜单/路由
9. `client/src/index.css` 写样式

---

## 10. 样式编写规范

### 10.1 单一全局样式文件

**所有样式都进 `client/src/index.css`**，按域分块：
1. `:root` token (1-80 行)
2. `[data-theme="dark"]` 覆盖 (80-130 行)
3. 重置 + 排版 (130-200 行)
4. 通用控件 (Btn/Field/Modal/Tag/...)
5. 布局 (sidebar/topbar/content)
6. 业务样式 (按页面分块，每块用注释分隔)

**禁止**新建 css module 或 styled-components，**禁止**在 .tsx 里写内联大段 styleObject（少量动态值用 `style={{...}}` 可）。

### 10.2 命名规范

**BEM-ish**：
- 块: `.storage-dashboard`
- 元素: `.storage-dashboard__item` (项目里实际写成 `.storage-dashboard-item`)
- 修饰: `.storage-dashboard-item.is-active` (state)
- 主题变体: `.storage-dashboard.theme-crypto`

**前缀按域**：
- 健康: `fitness-`, `medication-`, `step-`
- 财务: `loan-`, `rent-`, `travel-`, `shopping-`, `subscription-`
- 生活: `storage-`, `todo-`, `card-`
- 投资: `invest-`
- 通知: `notification-`

### 10.3 状态类

按钮/标签/卡片用 `is-` 前缀：
- `.is-active` / `.is-open` / `.is-collapsed` / `.is-visible` / `.is-mobile-open` / `.is-current`

### 10.4 响应式断点

统一两个：
```css
@media (max-width: 1024px) { /* 平板 */ }
@media (max-width: 768px)  { /* 手机 */ }
```

### 10.5 主题变量注入

在组件根元素用 `style={{ '--invest-accent': '#xxx' }}`，子元素用 `var(--invest-accent)` 引用：
```tsx
<div className="invest-dashboard" style={{ '--invest-accent': theme.accent } as React.CSSProperties}>
  <div className="invest-hero-main" style={{ background: `linear-gradient(135deg, ${accent}1A 0%, transparent 100%)` }}>
```

### 10.6 一些常用写法

**圆角胶囊状态 pill**:
```css
.tag, .status-pill {
  border-radius: var(--radius-pill);
  padding: 6px 14px;
  font-size: var(--fs-body);
  font-weight: 600;
}
```

**表头固定行**:
```css
.invest-table thead th {
  position: sticky;
  top: 0;
  background: var(--color-surface-1);
}
```

**滚动条隐藏但保留滚动**:
```css
.invest-tape {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%);
}
```

**彩色淡背景**:
```css
background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-1));
```

---

## 11. 业务模块开发模板

以「新增一个 XXX 业务页面」为例：

### 11.1 后端 (server)

```ts
// server/src/modules/<domain>/entities/<name>.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: '<name>' })
export class XxxEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text') userId!: string;
  @Column('text') name!: string;
  // ...
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
```

```ts
// server/src/modules/<domain>/<name>.router.ts
import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../../shared/db/data-source';
import { XxxEntity } from './entities/<name>.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuth } from '../../shared/auth/require-auth';
import { sendOk } from '../../shared/http/response';

const router = Router();
const repo = () => AppDataSource.getRepository(XxxEntity);

const draftSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const items = await repo().find({ where: { userId: req.auth.userId }, order: { createdAt: 'DESC' } });
  sendOk(res, items);
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const draft = draftSchema.parse(req.body);
  const item = repo().create({ ...draft, id: randomUUID(), userId: req.auth.userId });
  await repo().save(item);
  sendOk(res, item);
}));

export { router as xxxRouter };
```

### 11.2 前端 (client)

```ts
// client/src/types/<name>.ts
export interface Xxx {
  id: string;
  name: string;
  // ...
}
export type XxxDraft = Omit<Xxx, 'id' | 'createdAt' | 'updatedAt'>;
```

```ts
// client/src/services/<name>Api.ts
import { request } from './api';
import type { Xxx, XxxDraft } from '../types/<name>';

export const xxxApi = {
  list: () => request<Xxx[]>('/api/<name>'),
  create: (draft: XxxDraft) => request<Xxx>('/api/<name>', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: string, patch: Partial<XxxDraft>) => request<Xxx>(`/api/<name>}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  delete: (id: string) => request<void>(`/api/<name>}/${id}`, { method: 'DELETE' }),
};
```

```tsx
// client/src/pages/<domain>/<Name>.tsx
import { PageHeader, SectionCard } from '../../components/page';
import { XxxSection } from '../../components/<domain>/XxxSection';

export default function XxxPage() {
  return (
    <div className="xxx-page">
      <PageHeader title="..." subtitle="..." />
      <XxxSection />
    </div>
  );
}
```

```tsx
// client/src/components/<domain>/XxxSection.tsx — 业务组件
import { useEffect, useState } from 'react';
import { Btn, DataTable, Modal, useToastState, Toast, Field, DeleteModal } from '../ui';
import { xxxApi } from '../../services/<name>Api';
import { buildApiErrorMessage } from '../../lib/api';

export function XxxSection() {
  const [items, setItems] = useState<Xxx[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();

  useEffect(() => {
    void (async () => {
      try { setItems(await xxxApi.list()); }
      catch (e) { showToast(buildApiErrorMessage(e), 'error'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <SectionCard title="...">
      {/* ... */}
      <Toast toast={toast} />
    </SectionCard>
  );
}
```

### 11.3 路由注册

`client/src/App.tsx` 加路由：
```tsx
<Route path="/<domain>/<name>" element={<XxxPage />} />
```

`client/src/config/navigation.tsx` 加菜单项。

`client/src/index.css` 加样式（按 `<name>-` 前缀）。

---

## 12. 常见开发任务

### 12.1 新增一个 Sidebar 菜单项

编辑 `client/src/config/navigation.tsx`：
```ts
{ key: '/finance/<name>', icon: 'wallet', label: 'xxx' }
```

如果是有子项的，把父项的 `children` 数组加一项即可。

### 12.2 新增一个颜色 token

`client/src/index.css` 顶部：
```css
:root {
  --color-new: #abc123;
}
[data-theme="dark"] {
  --color-new: #def456;
}
```

### 12.3 新增一个页签/Tag 类型

`index.css` 里 `.tag-<tone>` 系列已经齐全（blue/green/orange/red/muted），直接用：
```tsx
<Tag tone="green">成功</Tag>
```

要新加 tone（如 purple）：
```css
.tag-purple {
  background: var(--color-purple-bg);
  color: var(--color-purple);
  font-weight: 600;
  font-size: var(--fs-body);
  padding: 6px 14px;
}
```

### 12.4 写一个内联图表（不引 Recharts）

项目里大量用了纯 SVG：
- 饼图 (Storage price distribution) — `<PieChart>` 来自 Recharts，但**新加的模块**都自己写
- 折线 (净值曲线 EquityCurve) — 自写 `<svg viewBox>`
- 柱状 (Storage trend) — Recharts 的 `<BarChart>`
- 水平堆叠条 — 纯 CSS `<div>` 用百分比 width
- 火花线 sparkline — 纯 SVG path

简单图表直接写 `<svg>` 即可，控制力更强，体积更小。

### 12.5 新增一个 Modal 弹窗

```tsx
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="标题"
  width={520}
  footer={(
    <>
      <Btn tone="secondary" onClick={() => setOpen(false)}>取消</Btn>
      <Btn tone="primary" onClick={handleSave}>保存</Btn>
    </>
  )}
>
  <Field label="..." value={x} onChange={e => setX(e.target.value)} />
</Modal>
```

### 12.6 写一个新组件的样式

按域前缀，**全部进 `index.css`**。结构：
```css
/* ============================================
   <Domain> <Name>
   ============================================ */

.<prefix>-container { ... }
.<prefix>-item { ... }
.<prefix>-item.is-active { ... }

@media (max-width: 1024px) { ... }
@media (max-width: 768px) { ... }
```

---

## 13. 调试与排错

### 13.1 常见报错 & 解决

| 报错 | 原因 | 解决 |
|---|---|---|
| `Rendered more hooks than during the previous render` | `useMemo`/`useEffect` 写在了 `if (early return)` 之后 | 把所有 hook 提到 early return 之前，加 `if (!data) return ...` 守卫 |
| `Cannot find module './api'` | Vite HMR 缓存 | 重启 vite dev |
| `401 Unauthorized` | token 过期 | 重新登录，或清 localStorage |
| `Type X is not assignable to type Y` | DTO 与 entity 字段对不上 | 检查 zod schema 和 entity @Column |
| `Failed to fetch` | 后端没起 | 启动 server (`npm run dev`) |
| 白屏无报错 | 大概率是 Hook 顺序错 | 用 React DevTools 看组件树 |

### 13.2 数据不对的排查路径

1. **Network 面板**：API 返回了什么？字段名对不对？
2. **Console**：有没有 `console.error` / React 警告？
3. **SQLite Browser**：`server/data/lifeos.db` 里数据是什么？
4. **后端日志**：终端 stdout/stderr 有没有 stack trace？
5. **后端断点**：`tsx watch` 会自动重启，IDE 加断点

### 13.3 中文显示问题

如果发现中文字体变样（变方块/变细/换字体），说明父级没有 `font-family: var(--font-sans)`。
排查：
```bash
# 看当前组件链上的所有 className 里有没有声明 font-family
```

最常见漏掉的类：`.stat-value`、`.data-table th/td`、各模块新加的 `*-name` / `*-label`。

### 13.4 样式覆盖被吃

如果新写的样式没生效：
- 检查 CSS 加载顺序（`index.css` 是唯一入口，应该都在里面）
- 检查类名拼写
- 检查是不是被更后面的规则覆盖（CSS 后面胜出）
- 检查 `!important` 是不是用得太多

### 13.5 localStorage 数据被污染

清空：
```js
// 浏览器 DevTools Console
localStorage.clear();
```

### 13.6 后端 schema 错乱

```bash
# 删库重建
rm server/data/lifeos.db
# 重启 server
```

⚠️ 会丢失所有数据，谨慎！

---

## 14. 代码质量与提交

### 14.1 提交规范

**Commit message 用中文**（项目约定），格式：
```
<类型>: <一句话描述>

- 详细改动点 1
- 详细改动点 2
```

类型参考：
- `新增`: 新功能
- `重构`: 重写/调整结构
- `样式`: 仅 UI 调整
- `修复`: bug 修复
- `文档`: 文档变更
- `清理`: 删除死代码
- `性能`: 性能优化

### 14.2 推送流程

```bash
git add <具体文件>  # 不要 git add . / -A，避免拖入敏感文件
git commit -F <msg-file>
git push origin master
```

PowerShell 下 commit message 用 `-F <file>` 而不是 heredoc。

### 14.3 推送前自检

- [ ] TypeScript 编译: `cd client && npx tsc --noEmit` 0 error
- [ ] 没把无关文件 add 进去 (`git status`)
- [ ] 没把 `node_modules` / `*.db` 提交（已配 `.gitignore`）
- [ ] 视觉上 dev server 看一眼新页面没崩

### 14.4 单测

项目**没有配单测框架**（jest/vitest）。如果是纯函数（计算/格式化），可以单文件 `*.test.ts` 临时写。

---

## 15. 附录：术语表

| 术语 | 含义 |
|---|---|
| **域 (Domain)** | 业务大分类：health/finance/life/investment/notifications/system |
| **模块 (Module)** | 域下子分类：health → fitness/medication/checkup/step |
| **Tab (页签)** | 单页内的视图切换，用 `?tab=` query |
| **Section / SectionCard** | 通用卡片容器，承载一组内容 |
| **StatGrid** | 顶部 N 列指标卡 |
| **PillTabs** | 顶部胶囊样式 tab |
| **Token** | CSS 变量，全局可复用 |
| **Hero (Hero 卡)** | 醒目的关键指标卡，通常含大数字 |
| **Sparkline** | 微缩折线图，纯 SVG |
| **Draft** | 创建时的数据草稿（缺 id/createdAt） |
| **Mock 数据** | 前端原型假数据，正式接口未接入前使用 |

---

## ✅ 维护约定

- 本文档**只增不删**，过时信息加删除线而不是删
- 任何新增的"约定"（命名/目录/样式）请同步更新本文档
- 任何新增的工具函数 / 共享组件请在本文档登记
- 每完成一项大功能，更新对应章节

最后更新: 2026-06-07
