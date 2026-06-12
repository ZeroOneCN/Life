# LifeOS — 全生命周期数字化管理平台

> 一站式个人生活数据管理系统，覆盖 **健康、财务、生活、投资** 四大领域，提供统一的数据采集、分析、提醒与可视化能力，集成 DeepSeek AI 助理作为自然语言入口。

LifeOS 是一个前后端分离的全栈 Web 应用：**React 18 + TypeScript + Vite** 构建前端界面，**Express + TypeScript + TypeORM** 搭建后端服务，**MySQL 8** 作为持久化存储。系统以「全生命周期」为设计理念，将个人生活的各个维度纳入统一的数据管理体系。

## 核心特性

- **多模块业务覆盖**：健康中心（步数/健身/体检/用药）、财务中心（购物/旅行/贷款/订阅/房租/汇率换算/月度报告）、生活中心（物品/号卡/待办/重复任务）、投资中心（外汇）
- **统一通知中心**：支持邮件、企业微信、钉钉、飞书、Telegram、Webhook 等通知渠道，按业务场景灵活绑定，每个场景支持独立的 HTML 富文本模板（`{{title}}` / `{{message}}` / `{{date}}` / `{{userId}}` / `{{meta.xxx}}` 插值），含发送日志管理
- **AI 智能助理**：全局浮动聊天按钮 + DeepSeek function calling（4 个 tool：query_finance / query_health / query_investment / query_life），单次会话最多 4 轮 tool_calls
- **DeepSeek Token 消耗组件**：在 `settings/profile?tab=profile` 中实时显示官方账户余额 + 本站 AI 助理累计 / 今日 Token 消耗 + 估算花费 + 可调用次数，每 30 秒自动轮询
- **Telegram 快速录入**：通过 Telegram Bot 用快捷指令（`步 8234` / `重 72.4` / `早 燕麦杯` 等）或自然语言快速录入步数、体重、饮食、运动、用药、购物、待办数据，无需打开浏览器；6 位绑定码关联账号；DeepSeek AI 自然语言解析 fallback
- **Stripe 设计体系**：Indigo 主色调，Outfit 字体，亮色/暗色主题切换；表单标签统一 14px
- **响应式布局**：桌面端侧边栏 + 移动端自适应，720px 以下自动回退单列
- **原生日期控件**：统一使用浏览器原生日期/月份/时间选择器，无第三方日历依赖
- **懒加载 + 进度条**：所有页面通过 `lazyWithProgress` 包裹，配合 NProgress 顶部进度条
- **数据导入导出**：支持 Excel（xlsx）+ CSV 双向导入导出（购物、旅行、健身、卡片账单等场景）
- **代码分层清晰**：前端 service / 后端 router + entity + DTO 严格分层；前后端均要求 JSDoc 注释

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | React + TypeScript | 18 / 5.7 | 函数组件 + Hooks |
| 构建工具 | Vite | 6 | HMR、生产构建优化 |
| 样式方案 | Tailwind CSS 4 + 原生 CSS 变量 | 4.3 | Stripe 设计体系，7 级字体层级 |
| 图表库 | Recharts + ECharts | 3.8 / 6.1 | 折线/柱状/饼图 + 复杂可视化 |
| 路由 | React Router | 6.28 | 懒加载 + 路由守卫 |
| HTTP 客户端 | Axios | 1.16 | 统一 `apiGet/apiPost/...` 封装 |
| 工具库 | dayjs / lodash / papaparse / xlsx / jspdf / html2canvas | - | 日期/数据处理/导出/截图 |
| 后端框架 | Express + TypeScript | 4.21 / 5.7 | RESTful API |
| ORM | TypeORM | 0.3 | 自动建表、实体映射、迁移支持 |
| 数据库 | MySQL + mysql2 | 8 / 3.22 | 主数据存储 |
| 认证 | Passport + JWT | 0.7 / 9 | 无状态 Token 鉴权 |
| 参数校验 | Zod | 3.24 | 请求体验证、类型推断 |
| 通知发送 | Nodemailer / Fetch | 8 / - | 邮件 / 企业微信机器人 / Webhook |
| 日志 | Winston | 3.19 | 结构化日志输出 |
| 加密 | bcrypt | 6 | 密码哈希 |
| 安全 | Helmet / CORS / Compression | - | HTTP 头、CORS、响应压缩 |
| AI 服务 | DeepSeek | - | `chat/completions` + `user/balance` 双端点 |
| TG Bot | Grammy | - | Telegram Bot 快速录入（长轮询模式） |

## 业务模块

### 健康中心

- **运动步数** (`/health/step`)：08/12/16/20/23 时段 + 全天模式录入；趋势图表（按日/按月/按年/按时段筛选）；一键式表单（用户+步数+时间+保存）
- **健身减脂** (`/health/fitness`)：饮食 / 运动 / 体重 / 购物 四维记录；体重 / 体脂 2 位小数精度；趋势图 Tooltip；Excel 导入导出
- **体检指标** (`/health/checkup`)：自定义模板（指标 + 阈值）+ 批量录入；异常洞察分析
- **日常用药** (`/health/medication`)：用药记录 + 购药记录 + 库存估算；双指针库存算法；容器型单位（盒/瓶）智能识别；服药提醒场景

### 财务中心

- **网上购物** (`/finance/shopping`)：商品记录 + 平台管理 + 分类账本；Excel 导入导出；账本切换上下文
- **旅行游玩** (`/finance/travel`)：行程预订 + 费用记录 + 排行榜 + 支出报表；多币种结算 + 账本状态机（planning/ongoing/completed/archived）+ 30 天后归档建议 + 汇率换算工具
- **贷款还款** (`/finance/loan`)：平台管理 + 还款计划 + 账单追踪 + 统计面板
- **服务订阅** (`/finance/subscription`)：分类管理 + 记录跟踪 + 设置 + 周期管理；提前 3 天 / 当天 / 已逾期 三档提醒（scheduler 自动）
- **房租水电** (`/finance/rent`)：渠道管理 + 缴费记录 + 月度/年度成本统计；录入页拆分为「基础信息 / 费用明细 / 备注 / 实时计算」四个模块，每模块带虚线分隔 header
- **财务月报/年报** (`/finance/report`)：跨 5 模块聚合（购物/旅行/贷款/订阅/房租）→ 收入/支出/分类占比/Top 3 支出/同比环比；每月 1 号 9 点后由 scheduler 推送月报到通知中心
- **汇率换算** (`/finance/exchange-rate`)：Exchange Rate API v6 实时拉取 + 1h 进程内缓存 + USD 桥梁折算 + FALLBACK_RATES 离线表

### 生活中心

- **物品追踪** (`/life/storage`)：物品归档 + 存放位置 + 设置；归档/恢复机制；支持从购物账单一键导入
- **号卡中心** (`/life/card`)：号卡管理 + 充值记录 + 账单导入；运营商分类
- **待办事项** (`/life/todo`)：任务 CRUD + 日志 + 回收站；软删除 + 恢复；**重复任务（daily/weekly/monthly）**，待办完成后自动按规则生成下一次（`computeNextRecurrenceDate` 工具）

### 投资中心

- **外汇市场** (`/investment/forex`)：交易记录 + 资金流水 + 汇率计算器；多仓位爆仓计算（账户级 + 仓位级）；localStorage 状态持久化；commission 字段后端默认为 `calculateCommission()` 兜底
- **加密 / 港股 / 美股** (`/investment/{crypto,hk-stock,us-stock}`)：占位（开发中）

仪表盘首页的投资中心卡片使用 `is-positive` / `is-negative` 样式区分绿色（盈利）/ 红色（亏损）；财务中心卡片金钱字段统一 `toFixed(2)` 显示。

### 通知中心

统一的告警与提醒基础设施，路由 `/notifications`：

- **多种渠道**：邮件（SMTP）、企业微信（Webhook）、钉钉、飞书、Telegram、自定义 Webhook
- **场景绑定**：每个业务场景可独立绑定多个通知渠道
- **测试发送**：渠道配置后可立即测试连通性
- **按场景 HTML 模板**：每个通知场景可独立设置纯文本 / HTML 两种格式的标题与正文模板，支持 `{{title}}` / `{{message}}` / `{{date}}` / `{{userId}}` / `{{meta.xxx}}` 插值；HTML 模板会同时下发到邮件正文、企业微信/钉钉/飞书的 Markdown 模式、Telegram（HTML 模式）和 Webhook（`payload.html` 字段）
- **自动补齐 seed**：升级后无需重置数据库，新加的 scene / template 会在首次 GET 时自动补齐
- **日志管理**：所有发送记录统一存储，skipped 日志带具体原因（场景未启用 / 渠道未配置 / 渠道已停用），支持清空
- **接入的业务场景**：服药提醒（`medication.reminder`）、低库存提醒（`medication.low_stock`）、旅行归档跟进（`travel.followup`，end_date 距今 ≥ 30 天自动推送）、订阅续费提醒（`subscription.renewal_upcoming` / `subscription.expired`）、月度财务报告（`finance.report.monthly`）、待办提醒（`todo.reminder`）、体检提醒（`checkup.reminder`）、购物提醒（`shopping.reminder`）、贷款提醒（`loan.reminder`）、卡片提醒（`card.reminder`）

### 智能助理

基于 DeepSeek 的全栈自然语言助理：

- **接入方式**：方案 A — 全局浮动聊天按钮（`AssistantLauncher`），任何页面右下角一键唤起；清空对话使用项目主题 `Modal` 组件
- **数据来源**：4 个 function calling tool — `query_finance`（5 模块）/ `query_health`（步数/体重/运动/用药）/ `query_investment`（外汇交易/资金流水）/ `query_life`（待办/物品/卡片）
- **调用链路**：`POST /assistant/chat` → DeepSeek `tool_choice=auto` → 循环 `tool_calls`（最多 4 轮） → 工具结果回传 → 最终自然语言回复
- **典型问题**：「我这个月购物花了多少？」「最近 7 天步数趋势如何？」「盈亏比最高的交易是什么？」
- **Token 消耗记录**：每次 chat 调用按 1 字符 ≈ 0.6 token 估算 prompt/completion，落库 `system_assistant_usage_logs` 表（含 request_count、prompt_tokens、completion_tokens、estimated_cost、status 字段），同时支持 Repository.insert 失败时回退到原生 SQL 写入
- **官方余额查询**：`GET /assistant/usage` 同时返回 DeepSeek `/user/balance` 数据（total_balance / granted_balance / topped_up_balance / currency）+ 本站累计 / 今日统计，供个人中心组件展示

### Telegram 快速录入

基于 Grammy 框架的 Telegram Bot，支持通过手机快速录入数据：

- **绑定流程**：Web 端设置页生成 6 位临时绑定码（10 分钟有效）→ 在 Telegram 中发送 `/bind <码>` 完成账号关联
- **快捷指令**：正则匹配的简短命令格式，覆盖 7 大模块：
  - `步 8234` — 记录步数；`步 12000 全天` — 全天步数
  - `重 72.4` — 记录体重
  - `早 燕麦杯` / `午 牛肉饭 450g` / `晚 沙拉` — 饮食记录
  - `跑 30min 高强度` — 运动记录
  - `药 维C 每日1粒` — 用药记录
  - `买 牛奶 28元` / `花 299 显示器支架` — 购物记录
  - `+ 提交报告 明天` / `- 买菜` — 待办增删
- **AI 自然语言 Fallback**：快捷指令未命中时自动调用 DeepSeek 解析自然语言输入（如"今天跑了5公里，大概35分钟"）
- **前端入口**：个人中心页面 → 个人资料 Tab 底部「Telegram 快速录入」卡片
- **安全设计**：仅响应私聊文本消息、只做新增/更新操作、未配置 Token 时优雅跳过启动

### 仪表盘首页 (`/dashboard`)

跨模块的全局概览：

- 顶部 PageHeader + 待办速览（最近动态聚合）
- 健康中心卡片：体重、累计步数、活跃药品、待办体检
- 财务中心卡片：待还贷款、订阅数、累计购物、活跃旅行；金钱字段 2 位小数
- **即将到期订阅卡片**：7 天内按 daysLeft 排序，过期/即将到期高亮
- 投资中心卡片：净资金、净收益（绿色=盈利 / 红色=亏损）、胜率、当前持仓
- 生活中心卡片：储物数、待办数、号卡数
- 通知中心卡片：已启用渠道、最近日志数、渠道静默状态
- 趋势图表：步数/体重 + 投资资金流水
- 30 秒内存缓存降低数据库压力

## DeepSeek Token 消耗组件

`/settings/profile?tab=profile` 中新增的「DeepSeek Token 消耗」卡片，包含两个独立分区：

**官方账户余额**（来自 DeepSeek `/user/balance`）
- 横向 hero 卡片：大额余额数字 + 币种 / 刷新时间 pill
- 3 列固定网格：赠送余额、充值余额、可调用次数（按 2k token / 次估算）

**本站 AI 助理请求**（按当前登录用户从 `/assistant/chat` 累计）
- 横向 hero 卡片：累计 Token 大数字 + 累计请求 / 最后调用 pill
- 3 列固定网格：今日 Token、估算花费（按 0.001 元 / 1k tokens 粗算）、平均每次

**重试与回退机制**：
- `recordAssistantUsage` 三层兜底：①Repository.insert ②原生 SQL INSERT（entity 未注册时）③CREATE TABLE IF NOT EXISTS 幂等建表
- `getAssistantUsageStats` 任何阶段抛错都返回空统计，避免组件因缺表而 500
- 30 秒自动轮询，无需手动刷新

## 项目结构

```
LifeOS/
├── client/                                # 前端应用（React + Vite）
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui.tsx                     # 基础 UI（Btn/Field/Tag/Table/Modal/Tabs/StatGrid）
│   │   │   ├── page.tsx                   # 页面级容器（PageHeader/SectionCard/StatGrid）
│   │   │   ├── ErrorBoundary.tsx          # 错误边界
│   │   │   ├── ProtectedRoute.tsx         # 路由守卫
│   │   │   ├── RouteLoadingFallback.tsx
│   │   │   ├── Notification*.tsx          # 通知相关组件
│   │   │   ├── shared/
│   │   │   │   └── AssistantLauncher.tsx  # 浮动 AI 智能助理按钮 + 聊天面板
│   │   │   ├── date/                      # 原生日期选择器
│   │   │   ├── finance/                   # 财务模块子组件（~20 个，含 CurrencyConverter）
│   │   │   ├── health/                    # 健康模块子组件（~15 个）
│   │   │   ├── investment/                # 投资模块子组件
│   │   │   ├── life/                      # 生活模块子组件（~13 个）
│   │   │   ├── notifications/
│   │   │   │   └── NotificationTemplateEditor.tsx
│   │   │   └── settings/
│   │   │       └── DeepseekUsageWidget.tsx
│   │   ├── config/
│   │   │   └── navigation.tsx             # 导航菜单 + 路由表
│   │   ├── hooks/                         # useLocalStorageState / usePageTab / useTheme
│   │   ├── layout/
│   │   │   └── MainLayout.tsx             # 主布局（侧边栏 + 顶栏 + 内容区）
│   │   ├── lib/
│   │   │   ├── api.ts                     # Axios 封装（拦截器 / 错误处理）
│   │   │   └── chartPalette.ts            # 图表配色
│   │   ├── pages/                         # 页面主组件
│   │   │   ├── auth/Login.tsx
│   │   │   ├── Dashboard.tsx              # 首页
│   │   │   ├── health/                    # 4 个
│   │   │   ├── finance/                   # 6 个（含 FinanceReport）
│   │   │   ├── life/                      # 3 个
│   │   │   ├── investment/                # 4 个
│   │   │   ├── notifications/
│   │   │   ├── settings/
│   │   │   └── shared/                    # 占位页等
│   │   ├── services/                      # API 调用 + 本地业务逻辑（~25 个，含 assistantApi、deepseekUsageApi、financeReportApi、exchangeRateApi）
│   │   ├── types/                         # TypeScript 类型定义（~24 个）
│   │   ├── utils/                         # lazyWithProgress / storage
│   │   ├── App.tsx                        # 路由 + Provider
│   │   ├── main.tsx                       # DOM 挂载
│   │   └── index.css                      # 全局样式（CSS 变量 + 组件样式）
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                                # 后端服务（Express + TypeORM）
│   ├── src/
│   │   ├── app.ts                         # Express 应用配置
│   │   ├── index.ts                       # 服务启动入口
│   │   ├── config/
│   │   │   └── env.ts                     # 环境变量加载与类型化
│   │   ├── db/
│   │   │   ├── data-source.ts             # TypeORM 数据源（entities 走 glob 自动加载）
│   │   │   ├── bootstrap.ts               # 自动初始化
│   │   │   ├── seed.ts                    # 种子数据
│   │   │   └── migrations/                # 迁移文件
│   │   ├── modules/                       # 业务模块
│   │   │   ├── health/                    # 步数 / 健身 / 用药 / 体检
│   │   │   ├── finance/                   # 贷款 / 房租 / 购物 / 订阅 / 旅行 / 汇率 / 月度报告 / 跟进调度器
│   │   │   ├── investment/                # 外汇
│   │   │   ├── life/                      # 号卡 / 储物 / 待办（recurrence 规则）
│   │   │   ├── notifications/             # 通知中心（scenes/templates 自动补齐）
│   │   │   ├── system/                    # 认证 / 仪表盘 / 健康探针 / 智能分析 / **智能助理（assistant.router + assistant.tools + assistant-usage.service）**
│   │   │   └── telegram/                  # Telegram Bot 快速录入（entity / bot / router / services / commands）
│   │   ├── routes/
│   │   │   └── index.ts                   # 路由注册中心
│   │   └── shared/                        # 共享基础设施
│   │       ├── db/                        # BaseUserSettingService
│   │       ├── domain/                    # 领域服务（通知发送）
│   │       ├── errors/                    # AppError 类
│   │       ├── http/                      # 中间件 + 工具（auth/zod/response/async）
│   │       ├── persistence/              # 基础实体（timestamped/user-scoped/setting）
│   │       ├── services/                  # 通知发送实现
│   │       └── utils/                     # 日期/分页/数字/文本
│   ├── .env.example                       # 环境变量模板
│   ├── package.json
│   └── tsconfig.json
│
├── DESIGN.md                              # UI 设计规范（Stripe 设计体系）
├── DEVELOPMENT.md                         # 开发规范与约定
└── README.md                              # 本文件
```

## 路由清单

### 前端路由（`client/src/config/navigation.tsx`）

| 路径 | 名称 | 所属中心 | 状态 |
|------|------|----------|------|
| `/dashboard` | 首页 | - | ✓ |
| `/health/step` | 运动步数 | 健康中心 | ✓ |
| `/health/fitness` | 健身减脂 | 健康中心 | ✓ |
| `/health/checkup` | 体检指标 | 健康中心 | ✓ |
| `/health/medication` | 日常用药 | 健康中心 | ✓ |
| `/finance/shopping` | 网上购物 | 财务中心 | ✓ |
| `/finance/travel` | 旅行游玩 | 财务中心 | ✓ |
| `/finance/loan` | 贷款还款 | 财务中心 | ✓ |
| `/finance/subscription` | 服务订阅 | 财务中心 | ✓ |
| `/finance/rent` | 房租水电 | 财务中心 | ✓ |
| `/finance/report` | 财务月报/年报 | 财务中心 | ✓ |
| `/life/storage` | 物品追踪 | 生活中心 | ✓ |
| `/life/card` | 号卡中心 | 生活中心 | ✓ |
| `/life/todo` | 待办事项 | 生活中心 | ✓ |
| `/investment/forex` | 外汇市场 | 投资中心 | ✓ |
| `/investment/crypto` | 加密市场 | 投资中心 | 占位 |
| `/investment/hk-stock` | 港股市场 | 投资中心 | 占位 |
| `/investment/us-stock` | 美股市场 | 投资中心 | 占位 |
| `/notifications` | 通知中心 | - | ✓ |
| `/settings/profile` | 个人中心（含 DeepSeek Token 组件 + **Telegram 绑定卡片**） | - | ✓ |
| `/login` | 登录/注册 | - | ✓ |

### 后端 API（前缀 `/api`）

| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/auth` | 登录 / 注册 / 刷新 / 登出 / 当前用户 |
| 系统 | `/system/health` | 健康探针（无需鉴权） |
| 仪表盘 | `/dashboard` | 跨模块聚合摘要（含 `upcomingSubscriptions` 7 天内到期订阅） |
| 智能助理 | `/assistant` | DeepSeek function calling 多轮 tool 循环 + `GET /usage`（官方余额 + 本站消耗） |
| 智能分析 | `/analysis` | AI 分析接口（DeepSeek） |
| 通知中心 | `/notifications` | 渠道 / 场景 / 模板 / 日志（自动补齐缺失 seed） |
| 健康-步数 | `/health/step` | 步数记录 / 设置 |
| 健康-健身 | `/health/fitness` | 体重 / 饮食 / 运动 / 购物 |
| 健康-用药 | `/health/medication` | 用药 / 购药 / 库存 |
| 健康-体检 | `/health/checkup` | 模板 / 记录 / 设置 |
| 财务-贷款 | `/finance/loan` | 平台 / 还款 / 账单 / 设置 |
| 财务-房租 | `/finance/rent` | 渠道 / 记录 / 设置 |
| 财务-购物 | `/finance/shopping` | 平台 / 账本 / 记录 / 导入 |
| 财务-订阅 | `/finance/subscription` | 分类 / 记录 / 设置 |
| 财务-旅行 | `/finance/travel` | 书（含 complete/archive 状态机 + archive-suggestions）/ 详情 / 排行榜 / 报表 |
| 财务-汇率 | `/finance/exchange-rate` | latest / convert（1h 缓存 + USD 桥梁 + 离线表） |
| 财务-报告 | `/finance/report` | monthly / yearly / notify（跨 5 模块聚合，真正下发到通知中心） |
| 投资-外汇 | `/investment/forex` | 交易 / 资金流水 / 设置 |
| 生活-待办 | `/life/todo` | 任务（含 `recurrence_type` + `recurrence_config` 重复规则）/ 日志 / 回收站 |
| 生活-储物 | `/life/storage` | 物品 / 归档 / 设置 |
| 生活-号卡 | `/life/card` | 号卡 / 充值 / 账单 |
| **TG 快速录入** | `/telegram` | 绑定码生成 / 绑定状态查询（Bot 通过长轮询独立运行） |

## 数据库表

按业务模块分组（共 ~41 张表）：

| 模块 | 实体 | 说明 |
|------|------|------|
| 系统 | `system_user_account` / `system_user_profile` / `system_auth_session` / **`system_assistant_usage_logs`** | 用户、档案、会话、**AI 助理请求消耗记录** |
| 健康-步数 | `health_step_record` / `health_step_setting` | 步数记录 + 用户设置 |
| 健康-健身 | `health_fitness_weight_record` / `health_fitness_diet_record` / `health_fitness_exercise_record` / `health_fitness_shopping_record` / `health_fitness_setting` | 体重(decimal 10,2) / 饮食 / 运动 / 购物 |
| 健康-用药 | `health_medication_record` / `health_medication_purchase` / `health_medication_threshold` / `health_medication_summary` / `health_medication_setting` | 用药 / 购药 / 阈值 / 汇总 |
| 健康-体检 | `health_checkup_template` / `health_checkup_template_item` / `health_checkup_record` / `health_checkup_setting` | 模板 / 模板项 / 记录 |
| 财务-贷款 | `finance_loan_platform` / `finance_loan_repayment` / `finance_loan_bill` / `finance_loan_setting` | 平台 / 还款 / 账单 |
| 财务-房租 | `finance_rent_channel` / `finance_rent_record` / `finance_rent_setting` | 渠道 / 记录 |
| 财务-购物 | `finance_shopping_platform` / `finance_shopping_ledger` / `finance_shopping_record` / `finance_shopping_import_batch` / `finance_shopping_setting` | 平台 / 账本 / 记录 / 导入批次 |
| 财务-订阅 | `finance_subscription_category` / `finance_subscription_record` / `finance_subscription_setting` | 分类 / 记录 |
| 财务-旅行 | `finance_travel_book` / `finance_travel_expense_record` / `finance_travel_pay_channel` / `finance_travel_import_batch` / `finance_travel_setting` | 书（含 status/currency/budget/archived_at）/ 费用 / 支付渠道 |
| 投资-外汇 | `investment_forex_trade_record` / `investment_forex_capital_flow` / `investment_forex_import_batch` / `investment_forex_setting` | 交易 / 资金流水 |
| 生活-待办 | `life_todo_task` / `life_todo_setting` | 任务（软删除；`recurrence_type` + `recurrence_config` 控制重复规则） |
| 生活-储物 | `life_storage_item` / `life_storage_setting` | 物品 |
| 生活-号卡 | `life_card_record` / `life_card_carrier` / `life_card_recharge_record` / `life_card_bill_record` / `life_card_bill_import_batch` / `life_card_setting` | 号卡 / 运营商 / 充值 / 账单 |
| 通知 | `notification_center_channel` / `notification_center_scene` / `notification_center_scene_channel` / `notification_center_template` / `notification_center_log` | 渠道 / 场景 / 绑定 / 模板 / 日志 |
| **TG 快速录入** | **`telegram_binding`** | Telegram 用户与 LifeOS 用户的绑定关系（user_id / telegram_user_id / chat_id / bind_code） |

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

# 2. 安装依赖
cd client && npm install
cd ../server && npm install

# 3. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，至少配置 JWT_SECRET、DB_* 字段

# 4. 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lifeos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. 启动开发服务
# 终端 A：后端（端口 3100）
cd server && npm run dev

# 终端 B：前端（端口 3000，Vite 代理 /api → 3100）
cd client && npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。**首次访问**：系统检测无用户，自动开放注册入口；创建首个管理员后注册通道关闭。

### 环境变量

`server/.env` 完整配置（参考 `server/.env.example`）：

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `PORT` | 否 | 3100 | 后端服务端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `JWT_SECRET` | **是** | - | JWT 签名密钥（生产必须替换为随机字符串） |
| `JWT_EXPIRES_IN` | 否 | 7d | Access Token 过期时间 |
| `REFRESH_TOKEN_EXPIRES_IN` | 否 | 30d | Refresh Token 过期时间 |
| `DB_HOST` | **是** | 127.0.0.1 | 数据库地址 |
| `DB_PORT` | 否 | 3307 | 数据库端口 |
| `DB_USERNAME` | **是** | - | 数据库用户 |
| `DB_PASSWORD` | **是** | - | 数据库密码 |
| `DB_DATABASE` | **是** | lifeos | 数据库名 |
| `DB_SYNCHRONIZE` | 否 | false | 自动同步表结构（**生产请设为 false**，用 migration） |
| `SMTP_HOST` | 否 | - | 邮件 SMTP 服务器 |
| `SMTP_PORT` | 否 | 465 | SMTP 端口 |
| `SMTP_USER` | 否 | - | SMTP 用户名 |
| `SMTP_PASS` | 否 | - | SMTP 密码 |
| `SMTP_FROM` | 否 | - | 发件人邮箱 |
| `DEEPSEEK_API_KEY` | 否 | - | DeepSeek AI 接口密钥（智能分析 + 智能助理 + 个人中心 Token 组件） |
| `DEEPSEEK_BASE_URL` | 否 | https://api.deepseek.com | DeepSeek API 基础 URL |
| `EXCHANGE_RATE_API_KEY` | 否 | - | Exchange Rate API v6 密钥（`/finance/exchange-rate`）；未配置时自动回退到离线 FALLBACK_RATES |
| `EXCHANGE_RATE_API_BASE_URL` | 否 | https://v6.exchangerate-api.com | Exchange Rate API 基础 URL |
| `TELEGRAM_BOT_TOKEN` | 否 | - | Telegram Bot Token（从 @BotFather 获取）；不配置则跳过 Bot 启动 |

### 生产构建与部署

```bash
# 前端构建（产物在 client/dist）
cd client && npm run build

# 后端构建（产物在 server/dist）
cd server && npm run build

# 运行迁移（如有）
cd server && npm run migration:run

# 启动生产服务
cd server && npm start
```

部署时建议：
- 前端 `client/dist` 由 Nginx 托管，配置 `/api` 反代到 Node 服务
- 后端用 PM2 / systemd 守护进程
- MySQL 单独部署，定期备份
- 关闭 `DB_SYNCHRONIZE`，使用 migration 管理表结构

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          浏览器（Vite dev / Nginx prod）              │
│   React 18 + TypeScript  │  React Router  │  Tailwind 4  │  ECharts │
└─────────────────────────────────────────────────────────────────────┘
                                │  HTTP / Axios
                                │  Authorization: Bearer <JWT>
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Express 4  +  TypeScript  +  Zod  +  Passport-JWT                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ auth-mw      │→ │ router 层    │→ │ service 层   │→ │ entity 层│ │
│  │ (JWT 鉴权)   │  │ (REST + Zod) │  │ (业务逻辑)   │  │ (ORM)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │  TypeORM / mysql2
                                ▼
                            MySQL 8
```

**前端数据流**：
```
page (页面主组件)
  └─ sections (业务子组件) ←→ 共享 state via props / useState
       └─ services/xxxApi.ts (API 调用层)
            └─ lib/api.ts (Axios 实例 + 拦截器)
                 └─ /api/* (后端 REST)
```

**后端数据流**：
```
请求 → asyncHandler 包装
     → requireJwtAuth 中间件
     → Zod schema 校验 body / query / params
     → router 处理器（薄）
     → service 业务逻辑（多数在 router 中实现，简单模块可省略 service）
     → entity (TypeORM 实体) 操作 MySQL
     → successResponse() / AppError 统一返回
```

## API 端点速查

> 所有需鉴权接口都需要 `Authorization: Bearer <accessToken>`。返回结构统一为 `{ code: 0, data: ..., message: '' }`（成功）或 `{ code: 非 0, data: null, message: '...' }`（失败）。

**认证**（无需鉴权）
- `POST /api/auth/login` — 登录
- `POST /api/auth/register` — 注册（仅在无用户时开放）
- `POST /api/auth/refresh` — 刷新 Token
- `POST /api/auth/logout` — 登出（需鉴权）
- `GET  /api/auth/me` — 当前用户信息

**仪表盘**
- `GET /api/dashboard/summary` — 跨模块聚合摘要（首页用；含 7 天内到期订阅 `upcomingSubscriptions`）

**智能助理**
- `POST /api/assistant/chat` — DeepSeek function calling 多轮 tool 循环
- `GET  /api/assistant/usage` — DeepSeek 官方余额 + 本站 AI 助理消耗（个人中心组件用）

**财务**
- 贷款 / 房租 / 购物 / 订阅 / 旅行：各模块均有 CRUD + 设置端点
- 购物、旅行支持 Excel 导入导出（multipart/form-data）
- 旅行新增状态机端点：
  - `POST /api/finance/travel/books/:id/complete` — 标记完成
  - `POST /api/finance/travel/books/:id/archive` — 归档
  - `GET  /api/finance/travel/archive/suggestions` — 结束 30 天以上未归档的行程
- 汇率换算：
  - `GET /api/finance/exchange-rate/latest?base=USD&symbols=CNY,EUR` — 实时汇率
  - `GET /api/finance/exchange-rate/convert?from=USD&to=CNY&amount=100` — 换算
- 月度/年度报告：
  - `GET /api/finance/report/monthly?month=YYYY-MM` — 单月报告
  - `GET /api/finance/report/yearly?year=YYYY` — 年度报告
  - `POST /api/finance/report/notify` — 主动推送月报到通知中心

**投资-外汇**
- `GET /api/investment/forex/trades` / `POST` / `PATCH` / `DELETE`
- `GET /api/investment/forex/capital-flows` / `POST`
- `GET /api/investment/forex/settings` / `PUT`

**通知中心**
- 渠道：`GET/POST/PATCH/DELETE /api/notifications/channels` + `POST .../test`
- 场景：`GET/POST/PATCH/DELETE /api/notifications/scenes`（GET 时自动补齐缺失 seed）
- 模板：`GET/POST/PATCH/DELETE /api/notifications/templates`（GET 时自动补齐缺失 seed）
- 日志：`GET /api/notifications/logs` + `DELETE` 清空

**系统**
- `GET /api/system/health` — 探针（无需鉴权）
- `POST /api/analysis/*` — 智能分析（DeepSeek）

**Telegram 快速录入**
- `POST /api/telegram/bind-code` — 生成新的 6 位绑定码（需鉴权）
- `GET  /api/telegram/status` — 查询当前用户的 TG 绑定状态（需鉴权）

## Telegram Bot 配置指南

### 第一步：创建 Bot 并获取 Token

1. 在 Telegram 中搜索 **@BotFather**，发送 `/newbot`
2. 按提示输入 Bot 名称（如 `LifeOS 录入助手`）和用户名（如 `lifeos_entry_bot`）
3. 创建成功后，@BotFather 会返回一个 **Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

> **安全提醒**：Token 等同于 Bot 的密码，切勿泄露或提交到公开仓库。

### 第二步：配置环境变量

编辑 `server/.env`，将 Token 填入：

```bash
# Telegram Bot（快速录入功能，不配置则跳过启动）
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

不配置 `TELEGRAM_BOT_TOKEN` 时，后端正常启动，仅跳过 Bot 长轮询连接，控制台输出 `[Telegram] Bot disabled (no token configured).`。

### 第三步：重启后端

```bash
cd server && npm run dev
```

启动成功后控制台应显示 `[Telegram] Bot started successfully.`。如果 Token 无效会报错，请检查是否完整复制了 Token。

### 第四步：绑定账号

1. 打开 LifeOS 网页端，进入 **设置 → 个人中心 → 个人资料** Tab
2. 滚动到底部，找到 **「Telegram 快速录入」** 卡片
3. 点击 **「生成绑定码」** 按钮，获得 6 位数字码（如 `482937`），有效期 **10 分钟**
4. 打开 Telegram，搜索你的 Bot 用户名，发送：

   ```
   /bind 482937
   ```

5. 绑定成功后，Bot 回复 `✅ 绑定成功！现在可以直接发送数据了`
6. 返回网页端点击「刷新状态」，卡片显示「已绑定」

### 第五步：开始使用

绑定完成后，直接在 Telegram 中发送快捷指令即可录入数据：

| 指令 | 示例 | 说明 |
|------|------|------|
| 步数 | `步 8234` | 记录当前小时步数 |
| 全天步数 | `步 12000 全天` | 记录全天步数 |
| 体重 | `重 72.4` | 记录体重 (kg) |
| 早餐 | `早 燕麦酸奶杯 320g` | 记录早餐 |
| 午餐 | `午 牛肉饭 450g` | 记录午餐 |
| 晚餐 | `晚 三文鱼` | 记录晚餐 |
| 运动 | `跑 35min 高强度` | 记录运动 |
| 用药 | `药 维C 早1晚1` | 记录用药 |
| 购物 | `买 牛奶 28元` | 记录购物 |
| 支出 | `花 299 显示器支架` | 记录消费 |
| 新增待办 | `+ 提交报告 明天` | 新建待办 |
| 完成待办 | `- 买菜` | 完成待办 |
| 自然语言 | `今天跑了5公里大概35分钟` | AI 自动解析 |

其他可用命令：
- `/start` — 显示欢迎信息与绑定指引
- `/help` — 查看所有快捷指令帮助
- `/status` — 查看当前绑定状态
- `/bind <码>` — 绑定/重新绑定账号

## 开发指南

### 常用命令

| 命令 | 说明 |
|------|------|
| `cd client && npm run dev` | 启动前端开发服务器（Vite HMR，端口 3000） |
| `cd client && npm run typecheck` | 前端 TypeScript 类型检查 |
| `cd client && npm run build` | 前端生产构建（含 `tsc --noEmit`） |
| `cd client && npm run preview` | 本地预览生产构建 |
| `cd server && npm run dev` | 启动后端开发服务器（tsx watch，端口 3100） |
| `cd server && npm run check` | 后端 TypeScript 类型检查 |
| `cd server && npm run build` | 后端 TypeScript 编译（产物在 `dist/`） |
| `cd server && npm run seed` | 执行种子数据填充 |
| `cd server && npm start` | 启动生产服务 |
| `cd server && npm run migration:generate` | 生成迁移文件 |
| `cd server && npm run migration:run` | 执行迁移 |
| `cd server && npm run migration:revert` | 回滚最近一次迁移 |

### 新增业务模块步骤

**后端**：
1. 在 `server/src/modules/<领域>/` 下新建目录
2. 创建实体文件（`.entity.ts`）继承 `TimestampedEntity` / `UserScopedEntity` / `UserSettingEntity` 等基类
3. 创建路由文件（`.router.ts`），使用 `asyncHandler` + `validateBody(Zod)` + `successResponse()` 模式
4. 在 `server/src/routes/index.ts` 注册路由

**前端**：
1. 在 `client/src/types/` 下添加 TypeScript 类型定义
2. 在 `client/src/services/` 下添加 API 调用层（`xxxApi.ts`）和本地计算逻辑（`xxx.ts`）
3. 在 `client/src/components/<领域>/` 下添加页面子组件
4. 在 `client/src/pages/<领域>/` 下添加页面主组件
5. 在 `client/src/config/navigation.tsx` 注册菜单项和路由

**种子数据**（可选）：在 `server/src/db/seed.ts` 中添加默认数据；如果是通知场景/模板，添加后下次 GET 时会自动补齐到存量用户的数据库。

### 代码规范

- 所有函数必须包含 JSDoc 注释（**功能描述 + 参数说明 + 返回值**），遵循项目内 `<user_rules>` 约定
- API 请求参数使用 Zod Schema 校验，返回值使用统一 `successResponse()` 格式
- 错误处理使用 `AppError` 类，通过中间件统一转换为 HTTP 响应
- 前端 API 调用通过 `apiGet/apiPost/apiPatch/apiDelete` 统一封装
- 分页查询使用 `parsePagination()` 工具函数，自带边界保护
- 表单标签字体统一 14px（`var(--fs-label)`）
- 提交信息使用中文 commit message（约定）
- 提交前必须 `npm run build` 验证编译通过
- 文档更新：项目内 `README.md` 需同步更新

### 数据契约约定

为避免前后端精度/类型不匹配：

- **金额字段**（价格、待还、净资金、净收益等）：后端 entity 用 `decimal(10,2)`；返回前端前在 router 内 `Number()` 转换；前端用 `toFixed(2)` 显示
- **体重字段**：同上，`toFixed(2)` 显示
- **百分比字段**（胜率、利率等）：`toFixed(1)` 显示
- **可选 number 字段**：前端拿到 `null` 时统一用 `value === null ? '-' : value.toFixed(...)` 模式
- **盈亏符号判定**：基于后端原始数值（`netPnlRaw >= 0`）而非格式化字符串前缀（避免被 `±¥` Unicode 字符坑）

## 已知限制与 Roadmap

- **投资中心**：外汇已实现，加密 / 港股 / 美股 仅有占位页
- **DeepSeek Key**：当前所有用户共享 `env.DEEPSEEK_API_KEY`，未来需支持用户级 key 配置（需要新增 system-config 实体）
- **AI Token 估算精度**：按 1 字符 ≈ 0.6 token 的粗估公式，未引入第三方分词器
- **测试**：当前未配置测试框架（计划引入 Vitest / Jest + Supertest）
- **国际化**：界面为中文，i18n 框架未集成
- **CI/CD**：无自动化流水线（计划加入 GitHub Actions）
- **汇率数据源**：当前只接 Exchange Rate API v6，未配置时只能使用离线 FALLBACK_RATES（5 基础 × 9 货币）

## 故障排查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 前端 `Network Error` | 后端未启动 / 端口不一致 | 确认后端 3100 端口在跑；`vite.config.ts` 的 proxy 配置 |
| 登录 401 | JWT 过期 / 密钥不一致 | 重新登录；确认 `.env` 中 `JWT_SECRET` 稳定 |
| 注册入口消失 | 已存在用户 | 用已有账号登录；如需重置请清空 `system_user_account` 表 |
| `.toFixed is not a function` | 后端返回 string（如 decimal 字段未 Number 化） | 后端在 router 内 `Number(entity.field)`；前端 `Number(x).toFixed(n)` 兜底 |
| 前端构建报类型错误 | 类型未同步 | `npm run typecheck` 定位 → 同步前后端类型 |
| 数据库连接失败 | 端口 / 凭据错误 | 默认端口 3307（不是 3306）；检查 `.env` |
| 步数录入 23 点后跳错日期 | 老版本 bug | 已修复（基于 `recordTime` 计算次日） |
| 首页体重 stat-card 显示 74.10 而非 74.06 | 前端聚合或显示精度问题 | 已修复（`toFixed(2)`） |
| DeepSeek Token 组件一直显示「本站 AI 助理还未发起过请求」 | ① 后端未重启（新 entity 未注册）② DEEPSEEK_API_KEY 未配置导致 chat 走早退路径 ③ 数据源元数据未刷新 | ① 重启后端（让 TypeORM synchronize 建表）② 在 `.env` 配 API Key 或接受 `error` 状态记录 ③ 查看后端控制台 `[assistant-usage] recorded ...` 日志 |
| 投资中心净收益颜色错位 | 老版本基于格式化字符串前缀判定，被 `±¥` Unicode 字符坑 | 已修复（基于 `netPnlRaw` 数值判断） |
| TG Bot 启动失败 | ① `TELEGRAM_BOT_TOKEN` 未配置或无效 ② 网络无法连接 `api.telegram.org` | ① 在 `.env` 填入有效 Token（从 @BotFather 获取）② 确认服务器可访问外网 |
| 绑定码无效 | 绑定码已过期（10 分钟有效）或已被消费 | 重新生成绑定码，并在有效期内完成绑定 |
| TG 发送指令无响应 | 未完成账号绑定 | 先发送 `/bind <码>` 完成绑定 |

## 相关文档

- [DESIGN.md](./DESIGN.md) — UI 设计规范（Stripe 设计体系、配色、字体层级、组件样式）
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发规范与约定

---

**License**：Private
**Repo**：<https://github.com/ZeroOneCN/Life>
