# LifeOS — 你的数字生活管家

> 把健康、财务、生活、投资的数据都收进一个地方，用起来简单，看起来舒服，还能让 AI 帮你管。

LifeOS 是一个前后端分离的全栈 Web 应用。前端用 **React 18 + TypeScript + Vite**，后端用 **Express + TypeScript + TypeORM**，数据库是 **MySQL 8**。整套系统围绕「全生命周期」的理念，把你生活里散落的数据归拢到一起，统一管理和分析。

## 它能做什么

- **四大业务中心**：健康（步数 / 健身 / 体检 / 用药）、财务（购物 / 旅行 / 贷款 / 订阅 / 房租 / 汇率 / 月报）、生活（物品 / 号卡 / 待办 / 重复任务）、投资（外汇）
- **统一通知中心**：邮件、企业微信、钉钉、飞书、Telegram、Webhook 都能接，每个场景可以单独配 HTML 模板，发送记录都能查
- **AI 智能助理**：右下角浮动按钮一键唤起，支持自然语言提问（比如「这个月购物花了多少」），背后是 DeepSeek 的 function calling
- **DeepSeek Token 看板**：个人中心里实时显示官方账户余额和本站消耗，每 30 秒自动刷新
- **Telegram 快速录入**：在 Telegram 里发个「步 8234」「重 72.4」就能录数据，不用开浏览器；绑定码 10 分钟内有效
- **Stripe 风格设计**：Indigo 主色调 + Outfit 字体，支持亮色 / 暗色切换
- **响应式布局**：桌面端有侧边栏，手机端自动切单列
- **懒加载 + 进度条**：页面按需加载，顶部有进度条提示
- **Excel / CSV 导入导出**：购物、旅行、健身、卡片账单等场景都支持

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React + TypeScript | 18 / 5.7 | 函数组件 + Hooks |
| 构建工具 | Vite | 6 | 热更新 + 生产构建 |
| 样式 | Tailwind CSS 4 + CSS 变量 | 4.3 | Stripe 设计体系，7 级字体 |
| 图表 | Recharts + ECharts | 3.8 / 6.1 | 折线 / 柱状 / 饼图 + 复杂可视化 |
| 路由 | React Router | 6.28 | 懒加载 + 路由守卫 |
| HTTP | Axios | 1.16 | 统一封装 |
| 工具库 | dayjs / lodash / papaparse / xlsx / jspdf / html2canvas | - | 日期 / 数据 / 导出 / 截图 |
| 后端 | Express + TypeScript | 4.21 / 5.7 | RESTful API |
| ORM | TypeORM | 0.3 | 自动建表 + 迁移 |
| 数据库 | MySQL + mysql2 | 8 / 3.22 | 主存储 |
| 认证 | Passport + JWT | 0.7 / 9 | 无状态 Token 鉴权 |
| 参数校验 | Zod | 3.24 | 请求体验证 + 类型推断 |
| 通知 | Nodemailer / Fetch | 8 / - | 邮件 / 机器人 / Webhook |
| 日志 | Winston | 3.19 | 结构化日志 |
| 加密 | bcrypt | 6 | 密码哈希 |
| 安全 | Helmet / CORS / Compression | - | HTTP 头 / CORS / 压缩 |
| AI | DeepSeek | - | `chat/completions` + `user/balance` |
| TG Bot | Grammy | - | Telegram 快速录入（长轮询） |

## 业务模块一览

### 健康中心

- **运动步数** (`/health/step`)：按时段（08/12/16/20/23 点）或全天录入；支持按日 / 月 / 年 / 时段看趋势
- **健身减脂** (`/health/fitness`)：饮食、运动、体重、购物四个维度一起记；体重体脂精确到 2 位小数；支持 Excel 导入导出
- **体检指标** (`/health/checkup`)：自定义模板（指标 + 阈值），批量录入，异常项自动分析
- **日常用药** (`/health/medication`)：用药记录 + 购药记录 + 库存估算；双指针库存算法；盒 / 瓶单位智能识别；支持服药提醒

### 财务中心

- **网上购物** (`/finance/shopping`)：商品记录 + 平台管理 + 分类账本；Excel 导入导出
- **旅行游玩** (`/finance/travel`)：行程 + 费用 + 排行榜 + 报表；多币种 + 状态机（计划 / 进行 / 完成 / 归档）+ 30 天后自动提醒归档 + 汇率换算
- **贷款还款** (`/finance/loan`)：平台 + 还款计划 + 账单追踪 + 统计
- **服务订阅** (`/finance/subscription`)：分类 + 记录 + 周期管理；提前 3 天 / 当天 / 逾期三档自动提醒
- **房租水电** (`/finance/rent`)：渠道 + 缴费记录 + 月度 / 年度统计；水电煤气按月单独记录金额
- **财务报告** (`/finance/report`)：跨 5 模块聚合（购物 / 旅行 / 贷款 / 订阅 / 房租），自动算收入支出、分类占比、同比环比；每月 1 号自动推送到通知中心
- **汇率换算** (`/finance/exchange-rate`)：Exchange Rate API v6 实时拉取，1 小时缓存，USD 桥梁折算，离线兜底

### 生活中心

- **物品追踪** (`/life/storage`)：物品归档 + 存放位置；支持从购物账单一键导入；删除物品时联动删除关联购物记录
- **号卡中心** (`/life/card`)：号卡管理 + 充值 + 账单导入；运营商分类
- **待办事项** (`/life/todo`)：任务 + 日志 + 回收站；软删除可恢复；支持每日 / 每周 / 每月重复任务

### 投资中心

- **外汇市场** (`/investment/forex`)：交易记录 + 资金流水 + 汇率计算器；多仓位爆仓计算（账户级 + 仓位级）；隔夜费计入净收益
- **加密 / 港股 / 美股** (`/investment/{crypto,hk-stock,us-stock}`)：占位页，开发中

仪表盘首页的投资卡片用绿色（盈利）/ 红色（亏损）区分；财务卡片的金额统一 2 位小数显示。

### 通知中心

路由 `/notifications`，统一管理所有提醒：

- **多渠道**：邮件、企业微信、钉钉、飞书、Telegram、自定义 Webhook
- **场景绑定**：每个业务场景可以单独选要发哪些渠道
- **HTML 模板**：每个场景可以配纯文本或 HTML 模板，支持 `{{title}}` `{{message}}` `{{date}}` `{{userId}}` `{{meta.xxx}}` 占位符
- **自动补齐**：升级后新加的场景和模板会自动补到存量用户数据里，不用重置数据库
- **发送日志**：所有记录都能查，跳过的会写明原因（场景没开 / 渠道没配 / 渠道停用）

### AI 智能助理

基于 DeepSeek 的自然语言助理：

- **入口**：右下角浮动按钮，任何页面一键唤起
- **能力**：4 个 function calling tool — 查财务、查健康、查投资、查生活
- **调用链路**：`POST /assistant/chat` → DeepSeek 自动判断是否调 tool → 最多 4 轮 → 返回自然语言回复
- **典型问题**：「这个月购物花了多少？」「最近 7 天步数趋势如何？」「盈亏比最高的交易是什么？」
- **Token 记录**：每次调用都记到 `system_assistant_usage_logs` 表，支持回退到原生 SQL 写入
- **官方余额**：`GET /assistant/usage` 同时返回 DeepSeek 官方余额 + 本站累计 / 今日消耗

### Telegram 快速录入

用 Telegram Bot 随时随地录数据：

- **绑定**：网页端生成 6 位码（10 分钟有效）→ Telegram 里发 `/bind <码>` 完成关联
- **快捷指令**：
  - `步 8234` — 记步数；`步 12000 全天` — 全天步数
  - `重 72.4` — 记体重
  - `早 燕麦杯` / `午 牛肉饭 450g` / `晚 沙拉` — 饮食
  - `跑 30min 高强度` — 运动
  - `药 维C 每日1粒` — 用药
  - `买 牛奶 28元` / `花 299 显示器支架` — 购物
  - `+ 提交报告 明天` / `- 买菜` — 待办增删
- **AI 兜底**：快捷指令没命中时自动调 DeepSeek 解析自然语言（如「今天跑了5公里大概35分钟」）
- **安全**：只响应私聊、只做新增 / 更新、没配 Token 时优雅跳过

### 仪表盘首页 (`/dashboard`)

跨模块的全局概览：

- 顶部 PageHeader + 待办速览
- 健康卡片：体重、累计步数、活跃药品、待办体检
- 财务卡片：待还贷款、订阅数、累计购物、活跃旅行
- 即将到期订阅：7 天内按剩余天数排序
- 投资卡片：净资金、净收益（绿盈红亏）、胜率、持仓
- 生活卡片：储物数、待办数、号卡数
- 通知卡片：已启用渠道、最近日志数
- 趋势图：步数 / 体重 + 投资资金流水
- 30 秒内存缓存，降低数据库压力

## DeepSeek Token 看板

在 `/settings/profile?tab=profile` 的「DeepSeek Token 消耗」卡片：

**官方账户余额**（来自 DeepSeek `/user/balance`）
- 大额余额数字 + 币种 / 刷新时间
- 赠送余额、充值余额、可调用次数（按 2k token / 次估算）

**本站 AI 助理消耗**（按当前登录用户累计）
- 累计 Token + 累计请求 / 最后调用
- 今日 Token、估算花费（约 0.001 元 / 1k tokens）、平均每次

**容错**：`recordAssistantUsage` 三层兜底（Repository → 原生 SQL → 自动建表），`getAssistantUsageStats` 出错返回空统计，不会因为缺表导致 500。

## 项目结构

```
LifeOS/
├── client/                         # 前端（React + Vite）
│   ├── src/
│   │   ├── components/             # UI 组件
│   │   │   ├── ui.tsx             # 基础组件（Btn / Field / Tag / Modal 等）
│   │   │   ├── page.tsx           # 页面容器（PageHeader / SectionCard）
│   │   │   ├── shared/            # AI 助理浮动按钮等
│   │   │   ├── finance/           # 财务子组件
│   │   │   ├── health/            # 健康子组件
│   │   │   ├── investment/        # 投资子组件
│   │   │   ├── life/              # 生活子组件
│   │   │   └── notifications/     # 通知模板编辑器等
│   │   ├── config/                # 导航 + 路由
│   │   ├── hooks/                 # 自定义 Hooks
│   │   ├── layout/                # 主布局
│   │   ├── lib/                   # Axios 封装
│   │   ├── pages/                 # 页面主组件
│   │   ├── services/              # API 调用 + 业务逻辑
│   │   ├── types/                 # TypeScript 类型
│   │   └── index.css              # 全局样式
│   ├── vite.config.ts
│   └── package.json
│
├── server/                         # 后端（Express + TypeORM）
│   ├── src/
│   │   ├── config/                # 环境变量
│   │   ├── db/                    # 数据源 + 种子 + 迁移
│   │   ├── modules/               # 业务模块
│   │   │   ├── health/            # 步数 / 健身 / 用药 / 体检
│   │   │   ├── finance/           # 贷款 / 房租 / 购物 / 订阅 / 旅行 / 汇率 / 报告
│   │   │   ├── investment/        # 外汇
│   │   │   ├── life/              # 号卡 / 储物 / 待办
│   │   │   ├── notifications/     # 通知中心
│   │   │   ├── system/            # 认证 / 仪表盘 / AI 助理
│   │   │   └── telegram/          # TG Bot
│   │   ├── routes/                # 路由注册
│   │   └── shared/                # 共享基础设施
│   ├── .env.example
│   └── package.json
│
├── DESIGN.md                       # UI 设计规范
├── DEVELOPMENT.md                  # 开发规范
└── README.md                       # 本文件
```

## 快速开始

### 环境要求

- **Node.js** >= 18（推荐 20 LTS）
- **MySQL** >= 8.0
- **npm** 或 **pnpm**

### 安装与启动

```bash
# 1. 克隆
git clone https://github.com/ZeroOneCN/Life.git
cd Life

# 2. 装依赖
cd client && npm install
cd ../server && npm install

# 3. 配环境变量
cp server/.env.example server/.env
# 编辑 server/.env，至少配 JWT_SECRET 和 DB_* 字段

# 4. 建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lifeos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. 启动
# 终端 A：后端（端口 3100）
cd server && npm run dev

# 终端 B：前端（端口 3000，代理 /api → 3100）
cd client && npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。**首次访问**：系统检测到没有用户时自动开放注册，创建第一个账号后注册入口关闭。

### 环境变量

`server/.env` 配置（参考 `server/.env.example`）：

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `PORT` | 否 | 3100 | 后端端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `JWT_SECRET` | **是** | - | JWT 签名密钥（生产环境务必换成随机字符串） |
| `JWT_EXPIRES_IN` | 否 | 7d | Access Token 过期 |
| `REFRESH_TOKEN_EXPIRES_IN` | 否 | 30d | Refresh Token 过期 |
| `DB_HOST` | **是** | 127.0.0.1 | 数据库地址 |
| `DB_PORT` | 否 | 3307 | 数据库端口 |
| `DB_USERNAME` | **是** | - | 数据库用户 |
| `DB_PASSWORD` | **是** | - | 数据库密码 |
| `DB_DATABASE` | **是** | lifeos | 数据库名 |
| `DB_SYNCHRONIZE` | 否 | false | 自动同步表结构（生产环境设 false，用 migration） |
| `SMTP_HOST` | 否 | - | 邮件 SMTP |
| `SMTP_PORT` | 否 | 465 | SMTP 端口 |
| `SMTP_USER` | 否 | - | SMTP 用户名 |
| `SMTP_PASS` | 否 | - | SMTP 密码 |
| `SMTP_FROM` | 否 | - | 发件人 |
| `DEEPSEEK_API_KEY` | 否 | - | DeepSeek 密钥（AI 助理 + Token 看板） |
| `DEEPSEEK_BASE_URL` | 否 | https://api.deepseek.com | DeepSeek 基础 URL |
| `EXCHANGE_RATE_API_KEY` | 否 | - | 汇率 API 密钥，没配时用离线兜底 |
| `TELEGRAM_BOT_TOKEN` | 否 | - | TG Bot Token，没配则跳过 Bot 启动 |

### 生产构建

```bash
# 前端
cd client && npm run build    # 产物在 client/dist

# 后端
cd server && npm run build    # 产物在 server/dist

# 迁移
cd server && npm run migration:run

# 启动
cd server && npm start
```

部署建议：
- 前端 `client/dist` 交给 Nginx 托管，`/api` 反代到 Node 服务
- 后端用 PM2 或 systemd 守护
- MySQL 单独部署，定期备份
- 生产环境关闭 `DB_SYNCHRONIZE`，用 migration 管理表结构

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│              浏览器（Vite dev / Nginx prod）              │
│   React 18 + TypeScript + React Router + Tailwind 4     │
└─────────────────────────────────────────────────────────┘
                          │  HTTP / Axios
                          │  Authorization: Bearer <JWT>
                          ▼
┌─────────────────────────────────────────────────────────┐
│         Express 4 + TypeScript + Zod + Passport-JWT     │
│   auth-mw → router → service → entity → 统一返回         │
└─────────────────────────────────────────────────────────┘
                          │  TypeORM / mysql2
                          ▼
                      MySQL 8
```

**前端数据流**：页面 → 子组件 → `services/xxxApi.ts` → `lib/api.ts`（Axios）→ `/api/*`

**后端数据流**：请求 → JWT 鉴权 → Zod 校验 → router → service → entity → `successResponse()` 统一返回

## API 速查

> 所有鉴权接口需要 `Authorization: Bearer <accessToken>`。返回统一格式：`{ code: 0, data, message }`（成功）或 `{ code: 非0, data: null, message }`（失败）。

**认证**（无需鉴权）
- `POST /api/auth/login` — 登录
- `POST /api/auth/register` — 注册（仅无用户时开放）
- `POST /api/auth/refresh` — 刷新 Token
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 当前用户

**仪表盘**
- `GET /api/dashboard/summary` — 跨模块聚合摘要

**AI 助理**
- `POST /api/assistant/chat` — DeepSeek 多轮 tool 调用
- `GET /api/assistant/usage` — 官方余额 + 本站消耗

**财务**
- 贷款 / 房租 / 购物 / 订阅 / 旅行：各有 CRUD + 设置
- 购物、旅行支持 Excel 导入导出
- 旅行状态机：`POST .../books/:id/complete` / `archive` / `GET .../archive/suggestions`
- 汇率：`GET /api/finance/exchange-rate/latest` / `convert`
- 报告：`GET /api/finance/report/monthly` / `yearly` / `POST notify`

**投资**
- `GET/POST/PATCH/DELETE /api/investment/forex/trades`
- `GET/POST /api/investment/forex/capital-flows`
- `GET/PUT /api/investment/forex/settings`

**通知中心**
- 渠道：`GET/POST/PATCH/DELETE /api/notifications/channels` + `POST .../test`
- 场景：`GET/POST/PATCH/DELETE /api/notifications/scenes`（GET 自动补齐 seed）
- 模板：`GET/POST/PATCH/DELETE /api/notifications/templates`（GET 自动补齐 seed）
- 日志：`GET /api/notifications/logs` + `DELETE` 清空

**系统**
- `GET /api/system/health` — 健康探针（无需鉴权）
- `POST /api/analysis/*` — AI 智能分析

**Telegram**
- `POST /api/telegram/bind-code` — 生成绑定码
- `GET /api/telegram/status` — 查询绑定状态

## Telegram Bot 配置

### 1. 创建 Bot

1. Telegram 里找 **@BotFather**，发 `/newbot`
2. 按提示输入名称和用户名
3. 拿到 **Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

> Token 等同于 Bot 的密码，别泄露。

### 2. 配置环境变量

```bash
# server/.env
TELEGRAM_BOT_TOKEN=你的Token
```

不配的话后端正常启动，只是跳过 Bot。

### 3. 重启后端

```bash
cd server && npm run dev
```

看到 `[Telegram] Bot started successfully.` 就 OK。

### 4. 绑定账号

1. 网页端 → 设置 → 个人中心 → 个人资料 Tab
2. 底部找「Telegram 快速录入」卡片
3. 点「生成绑定码」，拿到 6 位数字（10 分钟有效）
4. Telegram 里找你的 Bot，发 `/bind <绑定码>`
5. Bot 回复 `✅ 绑定成功`，网页端点「刷新状态」确认

### 5. 开始用

| 指令 | 示例 | 说明 |
|------|------|------|
| 步数 | `步 8234` | 记当前小时步数 |
| 全天步数 | `步 12000 全天` | 记全天步数 |
| 体重 | `重 72.4` | 记体重 |
| 早餐 | `早 燕麦酸奶杯 320g` | 记早餐 |
| 午餐 | `午 牛肉饭 450g` | 记午餐 |
| 晚餐 | `晚 三文鱼` | 记晚餐 |
| 运动 | `跑 35min 高强度` | 记运动 |
| 用药 | `药 维C 早1晚1` | 记用药 |
| 购物 | `买 牛奶 28元` | 记购物 |
| 支出 | `花 299 显示器支架` | 记消费 |
| 新增待办 | `+ 提交报告 明天` | 新建待办 |
| 完成待办 | `- 买菜` | 完成待办 |
| 自然语言 | `今天跑了5公里大概35分钟` | AI 自动解析 |

其他命令：`/start`（欢迎）、`/help`（帮助）、`/status`（绑定状态）、`/bind <码>`（绑定）。

## 开发指南

### 常用命令

| 命令 | 说明 |
|------|------|
| `cd client && npm run dev` | 前端开发（端口 3000） |
| `cd client && npm run typecheck` | 前端类型检查 |
| `cd client && npm run build` | 前端构建 |
| `cd server && npm run dev` | 后端开发（端口 3100） |
| `cd server && npm run check` | 后端类型检查 |
| `cd server && npm run build` | 后端编译 |
| `cd server && npm run seed` | 种子数据 |
| `cd server && npm start` | 生产启动 |
| `cd server && npm run migration:run` | 执行迁移 |

### 新增业务模块

**后端**：
1. `server/src/modules/<领域>/` 下建目录
2. 创建实体（`.entity.ts`）继承 `TimestampedEntity` / `UserScopedEntity` 等基类
3. 创建路由（`.router.ts`），用 `asyncHandler` + `validateBody(Zod)` + `successResponse()` 模式
4. 在 `server/src/routes/index.ts` 注册路由

**前端**：
1. `client/src/types/` 加类型
2. `client/src/services/` 加 API 调用
3. `client/src/components/<领域>/` 加子组件
4. `client/src/pages/<领域>/` 加页面主组件
5. `client/src/config/navigation.tsx` 注册菜单和路由

### 代码规范

- 函数必须写 JSDoc 注释（功能 + 参数 + 返回值）
- API 参数用 Zod 校验，返回用 `successResponse()`
- 错误用 `AppError` 类
- 前端用 `apiGet/apiPost/apiPatch/apiDelete` 统一封装
- 分页用 `parsePagination()`
- 表单标签 14px（`var(--fs-label)`）
- Commit message 用中文
- 提交前 `npm run build` 验证编译

### 数据契约

- **金额**：后端 `decimal(10,2)`，返回前 `Number()` 转换，前端 `toFixed(2)` 显示
- **体重**：同上
- **百分比**：`toFixed(1)` 显示
- **可选 number**：`null` 时显示 `-`
- **盈亏判定**：基于后端原始数值（`netPnlRaw >= 0`），不用格式化字符串

## 数据库表

共约 41 张表，按模块分组：

| 模块 | 主要表 |
|------|--------|
| 系统 | `system_user_account` / `system_user_profile` / `system_auth_session` / `system_assistant_usage_logs` |
| 健康步数 | `health_step_record` / `health_step_setting` |
| 健康健身 | `health_fitness_weight_record` / `health_fitness_diet_record` / `health_fitness_exercise_record` / `health_fitness_shopping_record` / `health_fitness_setting` |
| 健康用药 | `health_medication_record` / `health_medication_purchase` / `health_medication_threshold` / `health_medication_summary` / `health_medication_setting` |
| 健康体检 | `health_checkup_template` / `health_checkup_template_item` / `health_checkup_record` / `health_checkup_setting` |
| 财务贷款 | `finance_loan_platform` / `finance_loan_repayment` / `finance_loan_bill` / `finance_loan_setting` |
| 财务房租 | `finance_rent_channel` / `finance_rent_record` / `finance_rent_setting` |
| 财务购物 | `finance_shopping_platform` / `finance_shopping_ledger` / `finance_shopping_record` / `finance_shopping_import_batch` / `finance_shopping_setting` |
| 财务订阅 | `finance_subscription_category` / `finance_subscription_record` / `finance_subscription_setting` |
| 财务旅行 | `finance_travel_book` / `finance_travel_expense_record` / `finance_travel_pay_channel` / `finance_travel_import_batch` / `finance_travel_setting` |
| 投资外汇 | `investment_forex_trade_record` / `investment_forex_capital_flow` / `investment_forex_import_batch` / `investment_forex_setting` |
| 生活待办 | `life_todo_task` / `life_todo_setting` |
| 生活储物 | `life_storage_item` / `life_storage_setting` |
| 生活号卡 | `life_card_record` / `life_card_carrier` / `life_card_recharge_record` / `life_card_bill_record` / `life_card_bill_import_batch` / `life_card_setting` |
| 通知 | `notification_center_channel` / `notification_center_scene` / `notification_center_scene_channel` / `notification_center_template` / `notification_center_log` |
| Telegram | `telegram_binding` |

## 已知限制与 Roadmap

- **投资中心**：外汇已做完，加密 / 港股 / 美股还是占位页
- **DeepSeek Key**：目前所有用户共享一个 key，未来要支持用户级配置
- **Token 估算**：按 1 字符 ≈ 0.6 token 粗估，没用分词器
- **测试**：还没配测试框架（计划用 Vitest / Jest + Supertest）
- **国际化**：界面是中文，没接 i18n
- **CI/CD**：没自动化流水线（计划加 GitHub Actions）
- **汇率源**：只接了 Exchange Rate API v6，没配时用离线兜底表

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 前端 `Network Error` | 后端没启动 / 端口不对 | 确认 3100 端口在跑；检查 vite 代理配置 |
| 登录 401 | JWT 过期 / 密钥变了 | 重新登录；确认 `JWT_SECRET` 稳定 |
| 注册入口没了 | 已经有用户了 | 用现有账号登录；要重置就清空 `system_user_account` 表 |
| `.toFixed is not a function` | 后端返回了 string | 后端 `Number()` 转换；前端 `Number(x).toFixed(n)` 兜底 |
| 构建报类型错误 | 前后端类型不同步 | `npm run typecheck` 定位 → 同步类型 |
| 数据库连不上 | 端口 / 凭据错误 | 默认端口 3307（不是 3306）；检查 `.env` |
| DeepSeek Token 组件不显示 | 后端没重启 / Key 没配 | 重启后端让 TypeORM 建表；配置 `DEEPSEEK_API_KEY` |
| 投资净收益颜色错 | 老版本用字符串前缀判定 | 已修复，基于 `netPnlRaw` 数值 |
| TG Bot 启动失败 | Token 无效 / 网络不通 | 检查 Token；确认能访问 `api.telegram.org` |
| 绑定码无效 | 过期或已用 | 重新生成 |
| TG 发指令没反应 | 没绑定账号 | 先发 `/bind <码>` |

## 相关文档

- [DESIGN.md](./DESIGN.md) — UI 设计规范（Stripe 体系、配色、字体、组件样式）
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发规范与约定

---

**License**：Private
**Repo**：<https://github.com/ZeroOneCN/Life>
