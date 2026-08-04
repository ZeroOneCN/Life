# LifeOS 2 — 技术开发文档

> 本文档面向**后续开发者**，整理项目技术栈、代码结构、设计系统、组件模式、数据流与调试技巧。
>
> 📌 **业务概览、模块说明、环境变量、API 速查等以 [README.md](./README.md) 为准**，本文档不重复。
> 📁 项目地址: `c:\Code\LifeOS2`
> 🛠️ 开发平台: Mac (也兼容 Windows PowerShell 环境)
> 🎨 设计原则: 单一前端 (React + Tailwind) + 单一后端 (Express) + 单一数据库 (MySQL 8 + TypeORM)

---

## 📑 目录

1. [技术栈](#1-技术栈)
2. [目录结构](#2-目录结构)
3. [本地开发与调试](#3-本地开发与调试)
4. [设计系统（Design Tokens）](#4-设计系统design-tokens)
5. [组件体系](#5-组件体系)
6. [页面与路由](#6-页面与路由)
7. [状态管理 + 数据流](#7-状态管理--数据流)
8. [后端 API 体系](#8-后端-api-体系)
9. [样式编写规范](#9-样式编写规范)
10. [业务模块开发模板](#10-业务模块开发模板)
11. [常见开发任务](#11-常见开发任务)
12. [调试与排错](#12-调试与排错)
13. [代码质量与提交](#13-代码质量与提交)
14. [附录：术语表](#14-附录术语表)

---

## 1. 技术栈

### 1.1 前端 (`client/`)

| 项 | 版本/库 | 用途 |
|---|---|---|
| 框架 | React 18 + TypeScript 5.7 | 主框架 |
| 构建 | Vite 6 | 开发/构建 |
| 路由 | React Router 6.28 | 客户端路由 + 懒加载 |
| 状态 | React Context (auth/theme) + useState/useMemo | 轻量级状态 |
| 样式 | Tailwind CSS 4 + CSS 变量 | Stripe 设计体系，7 级字体 |
| 图表 | Recharts 3.8 + ECharts 6.1 | 折线/柱状/饼图 + 复杂可视化 |
| 日期 | dayjs | 日期格式化/计算 |
| HTTP | Axios 1.16 (`lib/api.ts`) | 统一封装 + token 刷新 |
| Markdown | react-markdown + remark-gfm | AI 助理消息渲染 |
| 进度条 | nprogress | 路由懒加载进度 |
| 导出 | xlsx / papaparse / jspdf / html2canvas | Excel/CSV/PDF/截图 |

### 1.2 后端 (`server/`)

| 项 | 版本/库 | 用途 |
|---|---|---|
| 运行时 | Node.js 18+ + TypeScript 5.7 | |
| 框架 | Express 4.21 | HTTP |
| ORM | TypeORM 0.3 | 数据库 |
| 数据库 | MySQL 8 + mysql2 3.22 | 主存储 |
| 鉴权 | Passport 0.7 + passport-jwt 4.0 + JWT (jsonwebtoken 9) | 无状态 Token |
| 密码 | argon2 0.44 + bcrypt 6 | 密码哈希 |
| 校验 | zod 3.24 | DTO/请求体验证 |
| 安全 | helmet 8 + cors + compression | 通用安全中间件 |
| 日志 | winston 3.19 | 结构化日志 |
| 通知 | nodemailer 8 + fetch | 邮件/机器人/Webhook |
| AI | DeepSeek (`shared/services/deepseek.client.ts`) | chat/chatJson/chatWithTools 三模式 |
| TG Bot | grammy 1.43 | Telegram 快速录入 |
| Excel | exceljs 4.4 | 后端 Excel 导入导出 |
| 上传 | multer 2.1 | 文件上传 |

### 1.3 工具链

| 项 | 工具 |
|---|---|
| 包管理 | npm |
| 类型检查 | `tsc --noEmit`（前端 `npm run typecheck`，后端 `npm run check`） |
| 开发服务器 | Vite (前端，端口 3000) + tsx watch (后端，端口 3100) |
| 数据库迁移 | TypeORM CLI (`migration:generate` / `migration:run` / `migration:revert`) |

---

## 2. 目录结构

```
LifeOS2/
├── client/                         # 前端（React + Vite + Tailwind 4）
│   ├── src/
│   │   ├── App.tsx                 # 路由入口
│   │   ├── main.tsx                # ReactDOM mount
│   │   ├── index.css              # ★ 全局样式 + Tailwind + 设计 token
│   │   ├── layout/                # 顶层 layout（MainLayout 侧边栏/顶栏）
│   │   ├── pages/                 # 路由对应的页面
│   │   │   ├── Dashboard.tsx
│   │   │   ├── health/            # overview/vital/fitness/step/checkup/medication/report
│   │   │   ├── finance/           # overview/expense/shopping/travel/loan/subscription/rent/bill/bill-mgmt/budget/goal/planning/report
│   │   │   ├── life/              # storage/card/todo/schedule
│   │   │   ├── investment/        # forex/crypto/hk-stock/us-stock
│   │   │   ├── notifications/
│   │   │   └── settings/
│   │   ├── components/            # 可复用 UI 组件 + 业务组件
│   │   │   ├── ui.tsx             # ★ 基础原子组件库（Btn/Modal/Field/...）
│   │   │   ├── page.tsx           # ★ 通用页面布局（PageHeader/SectionCard/StatGrid/EmptyState）
│   │   │   ├── shared/            # 共享业务组件（NotificationLogsSection 等）
│   │   │   ├── health/ finance/ life/ investment/ notifications/
│   │   ├── services/              # API 调用层 + 业务逻辑
│   │   ├── types/                 # 全局 TypeScript 类型
│   │   ├── hooks/                 # 自定义 hooks
│   │   ├── lib/                   # 工具库（api.ts Axios 封装）
│   │   ├── config/                # 路由/导航配置
│   │   │   └── navigation.tsx     # ★ 菜单 + 路由配置
│   │   └── utils/                 # 工具函数（lazyWithProgress 等）
│   ├── vite.config.ts
│   └── package.json
│
├── server/                         # 后端（Express + TypeORM + MySQL 8）
│   ├── src/
│   │   ├── index.ts                # 启动入口
│   │   ├── app.ts                  # Express 应用工厂
│   │   ├── config/                 # 环境变量 (env.ts)
│   │   ├── db/                     # 数据源 + 种子 + 迁移
│   │   │   ├── data-source.ts
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── routes/                 # 路由注册
│   │   │   └── index.ts
│   │   ├── shared/                 # 共享基础设施
│   │   │   ├── db/                 # BaseUserSettingService
│   │   │   ├── domain/            # notification 领域服务
│   │   │   ├── errors/            # AppError
│   │   │   ├── http/              # auth-middleware / async-handler / response / validation / error-handler
│   │   │   ├── persistence/       # TimestampedEntity / UserScopedEntity / UserSettingEntity 基类
│   │   │   ├── services/          # deepseek.client.ts / notification-sender.ts
│   │   │   ├── utils/             # date / number / text / pagination / health / medical
│   │   │   └── recurrence.ts      # 共享重复任务逻辑（todo + schedule）
│   │   └── modules/               # 业务模块（每个一目录）
│   │       ├── finance/           # loan/rent/shopping/subscription/travel/exchange-rate/budget/bill/goal/bill-mgmt/finance-report
│   │       ├── health/            # step/fitness/medication/checkup/dashboard/report/vital/sleep
│   │       ├── investment/        # forex
│   │       ├── life/              # todo/card/storage/schedule
│   │       ├── notifications/     # notification-center
│   │       ├── system/            # auth/dashboard/assistant/analysis/provision
│   │       └── telegram/          # TG Bot
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
├── DESIGN.md                       # UI 设计规范
├── DEVELOPMENT.md                  # ← 你正在读的这份
└── README.md                       # 项目说明（业务概览、API 速查、环境变量）
```

### 2.1 文件命名约定

- **页面**: `src/pages/<domain>/<Name>.tsx` (PascalCase, 默认导出)
- **业务组件**: `src/components/<domain>/<Name>Section.tsx` (PascalCase + Section 后缀)
- **共享组件**: `src/components/<Name>.tsx`
- **服务**: `src/services/<name>Api.ts` 或 `<name>.ts`
- **类型**: `src/types/<name>.ts`
- **后端实体**: `server/src/modules/<domain>/entities/<name>.entity.ts`
- **后端路由**: `server/src/modules/<domain>/<name>.router.ts`
- **后端服务**: `server/src/modules/<domain>/<name>.service.ts`（业务逻辑下沉层）

---

## 3. 本地开发与调试

### 3.1 启动顺序

```bash
# 1. 启动后端（默认端口 3100）
cd server
npm install
npm run dev          # tsx watch src/index.ts

# 2. 启动前端（默认端口 3000；代理 /api → 3100）
cd client
npm install
npm run dev          # vite
```

访问: <http://localhost:3000> (前端，Vite 代理 `/api` 到 3100)

### 3.2 数据初始化

首次启动后端会自动：
- 连接 MySQL（需先建库 `lifeos`）
- 同步 TypeORM schema（`DB_SYNCHRONIZE=true` 时）
- 调用 `provision-user-defaults.ts` 给默认用户播种演示数据

```bash
# 建库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lifeos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.3 端口代理 (Vite)

`client/vite.config.ts` 配了 `/api` 代理到 `http://localhost:3100`，前端请求写 `/api/...` 即可。

### 3.4 默认账号

首次访问时系统检测到没有用户会自动开放注册，创建第一个账号后注册入口关闭。详见 [README.md](./README.md)。

### 3.5 调试工具

| 工具 | 用途 |
|---|---|
| Vite HMR | 前端代码改动自动热更新 |
| React DevTools | 组件树/Hook 状态查看 |
| `console.log` + `debugger` | 常规断点 |
| Network 面板 | 查 API 请求/响应 |
| MySQL Workbench / DataGrip | 直接查 MySQL 数据 |
| `tsx watch` | 后端改代码自动重启 |
| Winston 日志 | 后端结构化日志输出 |

---

## 4. 设计系统（Design Tokens）

**设计 token 在 `client/src/index.css` 顶部**，Tailwind 4 通过 `@theme` 消费。改一处全站生效。

### 4.1 颜色（CSS Variables）

亮色（默认）与暗色（`[data-theme="dark"]`）两套，通过 `document.documentElement[data-theme]` 切换，由 `client/src/hooks/useTheme.tsx` 控制，存 `localStorage:lifeos_theme`。

核心 token（完整列表见 `index.css`）：
```css
--color-primary:        #533afd    /* 主色：靛蓝 */
--color-ink:            #0d253d    /* 主文字 */
--color-canvas:         #ffffff    /* 页面底色 */
--color-surface-1:      #ffffff    /* 卡片底 */
--color-hairline:       #e3e8ee    /* 1px 边线 */
--color-success:        #28ca42
--color-danger:         #ea2261
--color-warning:        #ffbd2e
```

### 4.2 字号（7 级 Type Scale）

```css
--fs-display:  36px   /* T1 页面主标题 */
--fs-heading:  24px   /* T2 分区标题 */
--fs-title:    20px   /* T3 卡片/模块标题 */
--fs-body:     16px   /* T4 正文/按钮 */
--fs-label:    14px   /* T5 表单label/表头/描述 */
--fs-caption:  13px   /* T6 注释/元数据 */
--fs-overline: 11px   /* T7 Pill标签/Badge/Eyebrow */
```

### 4.3 圆角

```css
--radius-sm:   8px
--radius-md:   12px
--radius-lg:   18px
--radius-pill: 9999px
```

### 4.4 字体栈

```css
--font-sans:  'Outfit', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
--font-mono:  'JetBrains Mono', monospace;
```

> ⚠️ **重要**：`Outfit` 不含中文字形，所有显示中文的元素必须显式声明 `font-family: var(--font-sans)`，否则会回退到系统字体不一致。

### 4.5 间距

没有专门 token，直接用 `padding/margin: 8/12/14/16/18/20/24px`。常用节奏：
- 卡片内边距: `16px 18px`
- 模块间堆叠: `gap: 18px`
- SectionCard 间距: `16px`，内边距 `20px`

### 4.6 数字等宽

所有金额数字使用 `font-variant-numeric: tabular-nums`（Tailwind class `tabular-nums`），避免数字跳动。

---

## 5. 组件体系

### 5.1 基础原子组件（`client/src/components/ui.tsx`）

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

### 5.2 页面布局组件（`client/src/components/page.tsx`）

| 组件 | 用途 |
|---|---|
| `PageHeader` | 页面顶部标题 + 副标题，固定结构 |
| `SectionCard` | 内容卡片容器，自带标题/描述/操作区，间距 16px，内边距 20px |
| `StatGrid` | N 等分指标卡网格（建议 4-6 项，超过则拆分） |
| `EmptyState` | 空态展示，统一 `title/description/icon`（全站仅此一个 EmptyState） |

使用示例：
```tsx
<PageHeader title="成本看板" subtitle="数据概览、活动流与成本分析" />
<SectionCard title="关注列表" description="..." action={<Btn>操作</Btn>}>
  <DataTable columns={cols} data={rows} rowKey="id" />
</SectionCard>
<StatGrid items={[
  { label: '总数', value: '8', helper: '使用中 6' },
  { label: '累计', value: '¥5530', accent: 'var(--color-primary)' },
]} />
<EmptyState title="暂无数据" description="先录入..." icon="📈" />
```

### 5.3 业务组件（`client/src/components/<domain>/`）

按域组织，每个业务模块拆成若干 `Section` 组件。业务组件一般接收 `settings / showToast / onChanged` 三个 props，自己 `useEffect` 拉数据。

---

## 6. 页面与路由

### 6.1 路由配置（`client/src/App.tsx` + `config/navigation.tsx`）

- `navigation.tsx` 的 `menuItems` 决定左侧菜单
- 同一文件的 `routes` 数组决定路由注册与面包屑（`breadcrumb: ['健康中心', '健身']`）
- 路由 key 就是 URL path

### 6.2 Tab 子路由模式

很多页面用 `?tab=` query 而不是子路由：
```tsx
const params = new URLSearchParams(location.search);
const tab = (params.get('tab') || 'dashboard') as InvestmentTab;
const setTab = (next: InvestmentTab) => {
  const search = new URLSearchParams(location.search);
  search.set('tab', next);
  navigate(`${location.pathname}?${search.toString()}`);
};
```

### 6.3 懒加载 + 进度条

所有页面通过 `lazyWithProgress` 加载，顶部显示 nprogress 进度条。

### 6.4 页面骨架模板

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
    </div>
  );
}
```

---

## 7. 状态管理 + 数据流

### 7.1 三层数据

1. **服务端数据** — 来自后端 API，存到 `useState` + `useEffect` 拉取
2. **客户端状态** — 主题、登录态用 React Context（见 `hooks/useTheme.tsx`、`services/auth.ts`）
3. **本地存储数据** — 投资 crypto/hk-stock/us-stock 用 `localStorage`（前端独立版本）

### 7.2 数据获取模式

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

### 7.3 API 服务层（`client/src/services/`）

```ts
// xxxApi.ts
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';

export const xxxApi = {
  list: () => apiGet<Xxx[]>('/xxx'),
  get: (id: string) => apiGet<Xxx>(`/xxx/${id}`),
  create: (draft: XxxDraft) => apiPost<Xxx>('/xxx', draft),
  update: (id: string, patch: Partial<XxxDraft>) => apiPatch<Xxx>(`/xxx/${id}`, patch),
  delete: (id: string) => apiDelete<void>(`/xxx/${id}`),
};
```

### 7.4 Axios 拦截器（`client/src/lib/api.ts`）

`apiClient` 自动处理：
- 拼接 baseURL（`/api`）
- 加 `Content-Type: application/json`
- 带 `Authorization: Bearer <accessToken>`（从 `getAuthSession()` 读）
- 401 时自动尝试 `refreshAccessToken`，失败则清空登录态
- 非 200 抛 `ApiError` 含 message/code

后端响应统一格式：
```json
{ "code": 0, "message": "ok", "data": { ... } }
```

非 0 时前端抛错，业务错误码 4xx/5xx 都由 `errorHandler` 中间件生成。

---

## 8. 后端 API 体系

### 8.1 路由注册（`server/src/routes/index.ts`）

```ts
import { Router } from 'express';
import { requireJwtAuth } from '../shared/http/auth-middleware';

export function createApiRouter() {
  const router = Router();
  router.use('/auth', createAuthRouter());
  router.get('/system/health', ...);  // 无需鉴权
  router.use(requireJwtAuth);          // 以下全部需要 JWT
  router.use('/finance/loan', createLoanRouter());
  router.use('/life/todo', createTodoRouter());
  // ...
  return router;
}
```

### 8.2 路由写法（`*.router.ts`）

```ts
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuthUser } from '../../shared/http/request';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { AppError } from '../../shared/errors/app-error';
import { parsePagination } from '../../shared/utils/pagination';

const router = Router();

const xxxSchema = z.object({
  name: z.string().trim().min(1).max(64),
  amount: z.number().nonnegative(),
});

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = requireAuthUser(req);
  const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);
  const items = await repo.find({ where: { user_id: userId } });
  res.json(successResponse(buildListData(items.slice(skip, skip + pageSize), page, pageSize, items.length)));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = requireAuthUser(req);
  const payload = validateBody(xxxSchema, req.body);
  const item = await repo.save(repo.create({ ...payload, user_id: userId }));
  res.json(successResponse(item, 'create_xxx_success'));
}));

export function createXxxRouter() {
  startXxxScheduler();  // 如有 scheduler，在 router 工厂里启动
  return router;
}
```

### 8.3 共享工具

| 工具 | 位置 | 用途 |
|---|---|---|
| `successResponse(data, message)` | `shared/http/response.ts` | 包装成 `{code:0, message, data}` |
| `buildListData(items, page, pageSize, total)` | 同上 | 分页列表包装 |
| `asyncHandler` | `shared/http/async-handler.ts` | 捕获 async 错误到 errorHandler |
| `requireJwtAuth` | `shared/http/auth-middleware.ts` | JWT 校验中间件，注入 `req.auth` |
| `requireAuthUser(req)` | `shared/http/request.ts` | 从 req.auth 取 userId，无则抛 401 |
| `validateBody(schema, body)` | `shared/http/validation.ts` | Zod 校验请求体 |
| `AppError` | `shared/errors/app-error.ts` | 业务错误类 |
| `parsePagination(query)` | `shared/utils/pagination.ts` | 解析分页参数 |
| `BaseUserSettingService` | `shared/db/base-user-setting.service.ts` | 用户设置 CRUD 基类 |

### 8.4 实体基类（`shared/persistence/`）

| 基类 | 说明 |
|---|---|
| `TimestampedEntity` | `id` (uuid v4) + `created_at` + `updated_at` + `deleted_at` (软删除) |
| `UserScopedEntity` extends TimestampedEntity | 额外 `user_id` 列（多用户隔离） |
| `UserSettingEntity` | 用户设置表基类 |

约定：
- 字段名 `snake_case`（TypeORM `@Column` 直接用 snake_case 名）
- 主键 `id: string` (uuid v4，由 `TimestampedEntity` 自动生成)
- 软删除用 `@DeleteDateColumn` 的 `deleted_at`，TypeORM 自动过滤
- 时间用 `created_at / updated_at` 自动维护

### 8.5 Service 层下沉（P4 重构后）

核心业务逻辑已从 router 抽离到 `*.service.ts`，确保 API 和 AI 工具调用一致口径：

| 模块 | service 文件 | 主要函数 |
|---|---|---|
| finance/shopping | `shopping.service.ts` | `sumShoppingAmount` / `createShoppingRecord` |
| finance/travel | `travel.service.ts` | `computeTravelNetAmount` / `sumTravelNetAmount` |
| finance/loan | `loan.service.ts` | `sumLoanRepaymentAmount` / `buildLoanBillOverview` |
| health/step | `step.service.ts` | `getDailyMaxSteps` / `createStepRecord` |
| health/fitness | `fitness.service.ts` | `createWeightRecord`（支持 18 项体成分字段） |
| life/todo | `todo.service.ts` | `buildTodoOverview` / `createTodoTask` |
| life/schedule | `schedule.service.ts` | `buildScheduleOverview` |

### 8.6 定时任务（Scheduler）

已实装的 scheduler（均在对应 router 工厂函数中启动）：

| Scheduler | 文件 | 功能 | 启动延迟 |
|---|---|---|---|
| bill-reminder | `finance/bill-reminder.scheduler.ts` | 账单到期提醒 | 90s |
| schedule-reminder | `life/schedule-reminder.scheduler.ts` | 日程提前提醒 | 120s |
| todo-reminder | `life/todo-reminder.scheduler.ts` | 待办任务提醒 | 150s |
| finance-report | `finance/finance-report.scheduler.ts` | 每月 1 号推送月报 | - |

所有 scheduler 共同模式：每小时扫描、`last_auto_reminder_date` 每日幂等、通过 `sendNotificationSceneLogs` 推送。

### 8.7 添加新业务模块步骤

1. `server/src/modules/<domain>/entities/` 写 Entity（继承 `UserScopedEntity`）
2. `server/src/modules/<domain>/<name>.service.ts` 写业务逻辑（可选，推荐）
3. `server/src/modules/<domain>/<name>.router.ts` 写 API
4. `server/src/routes/index.ts` 注册
5. `client/src/types/` 定义 TypeScript 类型
6. `client/src/services/<name>Api.ts` 写 API 调用
7. `client/src/pages/<domain>/<Name>.tsx` 写页面
8. `client/src/components/<domain>/<Name>Section.tsx` 拆业务组件
9. `client/src/config/navigation.tsx` 加菜单/路由
10. `client/src/index.css` 写样式

---

## 9. 样式编写规范

### 9.1 Tailwind 4 + 全局样式文件

样式体系为 **Tailwind 4 + CSS 变量**，全局样式在 `client/src/index.css`，按域分块：
1. `@theme` + `:root` token
2. `[data-theme="dark"]` 覆盖
3. Tailwind base / components / utilities
4. 通用控件 (Btn/Field/Modal/Tag/...)
5. 布局 (sidebar/topbar/content)
6. 业务样式 (按页面分块，每块用注释分隔)

**禁止**新建 css module 或 styled-components，**禁止**在 .tsx 里写内联大段 styleObject（少量动态值用 `style={{...}}` 可）。

### 9.2 命名规范

**BEM-ish**：
- 块: `.storage-dashboard`
- 元素: `.storage-dashboard__item` (项目里实际写成 `.storage-dashboard-item`)
- 修饰: `.storage-dashboard-item.is-active` (state)

**前缀按域**：
- 健康: `fitness-`, `medication-`, `step-`, `vital-`, `sleep-`
- 财务: `loan-`, `rent-`, `travel-`, `shopping-`, `subscription-`, `bill-`, `budget-`
- 生活: `storage-`, `todo-`, `card-`, `schedule-`
- 投资: `invest-`
- 通知: `notification-`

### 9.3 状态类

用 `is-` 前缀：`.is-active` / `.is-open` / `.is-collapsed` / `.is-visible` / `.is-mobile-open` / `.is-current`

### 9.4 响应式断点

```css
@media (max-width: 1024px) { /* 平板 */ }
@media (max-width: 768px)  { /* 手机 */ }
```

---

## 10. 业务模块开发模板

### 10.1 后端 Entity

```ts
// server/src/modules/<domain>/entities/<name>.entity.ts
import { Column, Entity } from 'typeorm';
import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('<name>')
export class XxxEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;
}
```

### 10.2 后端 Router

```ts
// server/src/modules/<domain>/<name>.router.ts
import { Router } from 'express';
import { z } from 'zod';
import { appDataSource } from '../../db/data-source';
import { XxxEntity } from './entities/<name>.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuthUser } from '../../shared/http/request';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';

const xxxSchema = z.object({ name: z.string().trim().min(1).max(64) });

export function createXxxRouter() {
  const router = Router();
  const repo = () => appDataSource.getRepository(XxxEntity);

  router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const items = await repo().find({ where: { user_id: userId } });
    res.json(successResponse(items));
  }));

  router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const payload = validateBody(xxxSchema, req.body);
    const item = await repo().save(repo().create({ ...payload, user_id: userId }));
    res.json(successResponse(item, 'create_success'));
  }));

  return router;
}
```

### 10.3 前端页面

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

### 10.4 路由注册

`client/src/config/navigation.tsx` 加菜单项和路由配置。

---

## 11. 常见开发任务

### 11.1 新增一个 Sidebar 菜单项

编辑 `client/src/config/navigation.tsx` 的 `menuItems` 和 `routes` 数组。

### 11.2 新增一个颜色 token

`client/src/index.css` 顶部：
```css
:root {
  --color-new: #abc123;
}
[data-theme="dark"] {
  --color-new: #def456;
}
```

### 11.3 新增一个 Modal 弹窗

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

> ⚠️ 模态框只能通过显式关闭按钮关闭，不支持点击外部或 ESC 关闭（项目约定）。

---

## 12. 调试与排错

### 12.1 常见报错 & 解决

| 报错 | 原因 | 解决 |
|---|---|---|
| `Rendered more hooks than during the previous render` | hook 写在了 `if (early return)` 之后 | 把所有 hook 提到 early return 之前 |
| `401 Unauthorized` | token 过期 | Axios 拦截器会自动刷新；刷新失败则重新登录 |
| `Type X is not assignable to type Y` | DTO 与 entity 字段对不上 | 检查 zod schema 和 entity @Column |
| `Failed to fetch` / `Network Error` | 后端没起 / 端口不对 | 确认 3100 端口在跑；检查 vite 代理 |
| 数据库连不上 | 端口/凭据错误 | 默认端口 3307（不是 3306）；检查 `.env` |

### 12.2 数据不对的排查路径

1. **Network 面板**：API 返回了什么？字段名对不对？
2. **Console**：有没有 `console.error` / React 警告？
3. **MySQL Workbench**：直接查表数据
4. **后端日志**：Winston 输出的 stdout/stderr
5. **后端断点**：`tsx watch` 会自动重启

### 12.3 中文显示问题

如果中文字体变样，说明父级没有 `font-family: var(--font-sans)`。最常见漏掉的类：`.stat-value`、`.data-table th/td`。

### 12.4 后端 schema 错乱

```bash
# 开发环境可开 DB_SYNCHRONIZE=true 自动同步
# 生产环境用 migration
cd server && npm run migration:run
```

---

## 13. 代码质量与提交

### 13.1 提交规范

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
- `feat` / `refactor` / `fix` 等英文前缀亦可

### 13.2 推送流程

```bash
git add <具体文件>  # 不要 git add . / -A，避免拖入敏感文件
git commit -F <msg-file>   # PowerShell 下用 -F 而不是 heredoc
git push origin master
```

> ⚠️ 每次优化修改后**必须立即推送 Git**（用户约定）。

### 13.3 推送前自检

- [ ] TypeScript 编译: `cd client && npm run typecheck` + `cd server && npm run check` 0 error
- [ ] 没把无关文件 add 进去 (`git status`)
- [ ] 没把 `node_modules` / `*.db` / `.env` 提交（已配 `.gitignore`）
- [ ] 视觉上 dev server 看一眼新页面没崩

### 13.4 代码规范

- 函数必须写 JSDoc 注释（功能 + 参数 + 返回值）
- API 参数用 Zod 校验，返回用 `successResponse()`
- 错误用 `AppError` 类
- 前端用 `apiGet/apiPost/apiPatch/apiDelete` 统一封装
- 分页用 `parsePagination()`
- 表单标签 14px（`var(--fs-label)`）
- Commit message 用中文
- 提交前 `npm run build` / `npm run check` 验证编译

### 13.5 数据契约

- **金额**：后端 `decimal(10,2)`，返回前 `Number()` 转换，前端 `toFixed(2)` 显示
- **体重**：同上
- **百分比**：`toFixed(1)` 显示
- **可选 number**：`null` 时显示 `-`
- **盈亏判定**：基于后端原始数值（`netPnlRaw >= 0`），不用格式化字符串

---

## 14. 附录：术语表

| 术语 | 含义 |
|---|---|
| **域 (Domain)** | 业务大分类：health/finance/life/investment/notifications/system |
| **模块 (Module)** | 域下子分类：health → fitness/medication/checkup/step/vital/sleep/report |
| **Tab (页签)** | 单页内的视图切换，用 `?tab=` query |
| **Section / SectionCard** | 通用卡片容器，承载一组内容 |
| **StatGrid** | 顶部 N 列指标卡（建议 4-6 项） |
| **PillTabs** | 顶部胶囊样式 tab |
| **Token** | CSS 变量，全局可复用 |
| **Service 层** | `*.service.ts`，从 router 抽离的业务逻辑，供 API 和 AI 工具共用 |
| **Scheduler** | 定时任务，每小时扫描，每日幂等 |
| **Draft** | 创建时的数据草稿（缺 id/createdAt） |

---

## ✅ 维护约定

- 本文档**只增不删**，过时信息加删除线而不是删
- 任何新增的"约定"（命名/目录/样式）请同步更新本文档
- 任何新增的工具函数 / 共享组件请在本文档登记
- 每完成一项大功能，更新对应章节
- **业务/架构/API 详情以 [README.md](./README.md) 为准**

最后更新: 2026-08-04
