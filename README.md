<div align="center">

# 🏡 LifeOS 2 — 你的数字生活管家

> **一个把健康 · 财务 · 生活 · 投资全部收齐的全栈 Web 操作系统**
>
> React 18 · TypeScript 5.7 · Vite 6 · Express · MySQL 8 · Linear Design

[⭐ 四大业务中心](#四大业务中心)
&nbsp;·&nbsp;
[🤖 AI 智能助理](#ai-智能助理)
&nbsp;·&nbsp;
[🎨 Linear 设计系统](#🎨-设计系统--v3-布局架构)
&nbsp;·&nbsp;
[🚀 快速开始](#快速开始)

</div>

---

## ✨ 核心亮点

| 🌐 四大业务中心 | 🤖 AI 智能助理 | 📱 Telegram 快速录入 | 🔔 统一通知中心 |
|---|---|---|---|
| 健康 / 财务 / 生活 / 投资<br>跨模块聚合仪表盘 | 右下角浮动按钮一键唤起<br>12 个 Function Calling 工具 | 发一条消息就录入数据<br>步/重/早/午/晚/药/买/+/- | 邮件·企微·钉钉·飞书<br>TG·Webhook 全覆盖 |

| 🎨 Linear 设计系统 | 📐 v3 布局架构 | 💾 本地优先 · 成本可控 | ⚙️ 工程化 & 响应式 |
|---|---|---|---|
| 深色画布 · Lavender 蓝<br>Surface Ladder · 无阴影 | AppShell + NavRail<br>CommandBar ⌘K · Workspace | OCR / 计算 / 分析全本地<br>不上传第三方 | 桌面侧边栏 · 移动端吸底<br>懒加载 · NProgress |

---

## 🌐 四大业务中心

### 🏥 健康中心
| 路由 | 模块 | 核心能力 |
|---|---|---|
| `/health/overview` | 健康概览 | 体重趋势 · 累计步数 · 活跃药品 · 待办体检（跨模块聚合） |
| `/health/vital` | 体征睡眠 | 体征指标 + 睡眠记录 |
| `/health/fitness` | 运动健身 | 饮食 / 运动 / 体重 / 购物 四维录入；Excel 导入导出 |
| `/health/step` | 运动步数 | 时段录入（08/12/16/20/23）；日 / 月 / 年 / 时段趋势 |
| `/health/checkup` | 体检指标 | 自定义模板（指标+阈值）；批量录入；异常项自动分析 |
| `/health/medication` | 日常用药 | 用药 / 购药 / 库存估算；双指针库存算法；服药提醒 |
| `/health/report` | 健康报告 | 个性化健康分析报告 + 一键 PDF 导出 |

### 💰 财务中心
| 路由 | 模块 | 核心能力 |
|---|---|---|
| `/finance/overview` | 财务概览 | 待还贷款 · 订阅数 · 累计购物 · 活跃旅行 · 净资产 |
| `/finance/expense` | 消费记录 | 日常消费流水 |
| `/finance/shopping` | 网上购物 | 商品 · 平台 · 分类账本；Excel 导入导出；USDT 切换 |
| `/finance/travel` | 旅行记账 | 行程 + 费用 + 排行榜 + 报表；多币种；状态机；30 天归档提醒 |
| `/finance/bill-mgmt` | 账单管理 | 贷款 / 房租 / 订阅 三主 Tab；子 Tab 内嵌壳页；部分还款 |
| `/finance/loan` | 贷款还款 | 平台 · 还款计划 · 账单追踪 · 统计；欠款=本金+利息合计口径 |
| `/finance/rent` | 房租水电 | 渠道 · 缴费记录 · 月/年度统计；水电煤气**按月单独记录** |
| `/finance/subscription` | 服务订阅 | 分类 · 记录 · 周期管理；7 天内到期看板 |
| `/finance/bill` | 账单提醒 | 订阅 / 账单到期；提前 3 天 / 当天 / 逾期三档 |
| `/finance/planning` | 财务规划 | 预算管理 + 财务目标追踪；Tab 嵌入壳页 |
| `/finance/report` | 财务报告 | 购物·旅行·贷款·订阅·房租 5 模块聚合；同比环比；每月 1 号自动推送 |
| `/finance/exchange-rate` | 汇率换算 | Exchange Rate API v6 实时拉取；1 小时缓存；USD 桥梁；离线兜底 |

### 📋 生活中心
| 路由 | 模块 | 核心能力 |
|---|---|---|
| `/life/storage` | 物品追踪 | 物品归档 · 存放位置；购物账单一键导入；联动删除 |
| `/life/card` | 号卡中心 | 号卡管理 · 充值 · 账单导入；运营商分类 |
| `/life/todo` | 待办事项 | 任务 + 日志 + 回收站；软删除；每日/每周/每月重复；自动提醒 |
| `/life/schedule` | 日程管理 | 日历事件 · 重复日程 · 提前提醒 |

### 📈 投资中心
| 路由 | 模块 | 核心能力 |
|---|---|---|
| `/investment/forex` | 外汇交易 | 交易记录 · 资金流水 · 汇率计算器；多仓位爆仓计算；隔夜费计入净收益 |
| `/investment/crypto` | 加密市场 | （菜单已移除，路由保留待实装） |
| `/investment/hk-stock` | 港股市场 | （菜单已移除，路由保留待实装） |
| `/investment/us-stock` | 美股市场 | （菜单已移除，路由保留待实装） |

> 💡 仪表盘投资卡片 **绿盈红亏**；财务金额统一 2 位小数 `tabular-nums`。

---

## 🧩 三大支撑模块

### 🤖 AI 智能助理
- **入口**：右下角浮动按钮，任何页面一键唤起
- **能力**：12 个 Function Calling Tool
  - 🔍 **4 查询**：财务 · 健康 · 投资 · 生活
  - ✏️ **8 写入**：购物 · 订阅 · 步数 · 体重 · 用药 · 待办 · 日程 · 饮食
- **链路**：`POST /api/assistant/chat` → DeepSeek 自动判工具 → 最多 4 轮 → 自然语言回复
- **示例问题**：「这个月购物花了多少？」「最近 7 天步数趋势？」「盈亏比最高的交易？」
- **Token 看板**（个人中心）：DeepSeek 官方余额 + 本站累计 / 今日消耗，每 30 秒自动刷新
- **调用记录**：`system_assistant_usage_logs` 持久化；三层兜底（Repository → 原生 SQL → 自动建表）

### 🔔 统一通知中心（`/notifications`）
- **6 种渠道**：邮件 · 企业微信 · 钉钉 · 飞书 · Telegram · 自定义 Webhook
- **场景绑定**：每个业务场景独立配渠道
- **HTML 模板**：每场景纯文本 / HTML 模板；支持 `{{title}}` `{{message}}` `{{date}}` `{{userId}}` `{{meta.xxx}}`
- **自动补齐**：升级后新增场景 / 模板自动补到存量用户
- **发送日志**：全量可查；跳过原因明确标记（场景未开 / 渠道未配 / 渠道停用）

### 📱 Telegram 快速录入
- **绑定**：网页生成 6 位码（10 分钟有效）→ TG 发 `/bind <码>`
- **快捷指令**

| 指令 | 示例 | 说明 |
|---|---|---|
| 步数 | `步 8234` · `步 12000 全天` | 按小时 / 全天录入 |
| 体重 | `重 72.4` | - |
| 饮食 | `早 燕麦杯` · `午 牛肉饭 450g` · `晚 沙拉` | 早/午/晚三餐 |
| 运动 | `跑 30min 高强度` | - |
| 用药 | `药 维C 每日1粒` | - |
| 购物/支出 | `买 牛奶 28元` · `花 299 显示器支架` | - |
| 待办增删 | `+ 提交报告 明天` · `- 买菜` | - |
| 自然语言 | `今天跑了5公里大概35分钟` | AI 兜底解析 |

> 🔒 只响应私聊；只做新增 / 更新；没配 Token 时优雅跳过。

### 📤 数据导出（`/system/export`）
- **全量导出**：6 大模块（财务/健康/生活/投资/通知/系统）70+ 数据表一键导出
- **双格式支持**：JSON（保留完整数据结构，适合迁移） / CSV（UTF-8 BOM，Excel 可直接打开）
- **ZIP 打包**：流式打包，每个模块一个目录，每个数据表一个独立文件
- **局域网访问**：支持局域网内其他设备访问导出页面
- **元数据**：压缩包内包含 metadata.json，记录导出时间、格式、模块信息
- **访问**：`http://localhost:9009/system/export`

---

### 🎯 仪表盘首页 (`/dashboard`)
- PageHeader + 待办速览（点击跳转定位具体待办）
- 健康卡 / 财务卡 / 投资卡 / 生活卡 / 通知卡 · 跨模块聚合
- 7 天内到期订阅（按剩余天数排序）
- 趋势图：步数 / 体重 + 投资资金流水
- **30 秒内存缓存**，降低 DB 压力
- 最近动态：通知日志 + AI 调用日志（时间倒序，不显示未来提醒）

---

## 🛠️ 技术栈

### 前端 `client/`
| 类别 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 框架 | React + TypeScript | 18 / 5.7 | 函数组件 + Hooks |
| 构建 | Vite | 6 | HMR · 生产构建 |
| 路由 | React Router | 6.28 | 懒加载 · 路由守卫 |
| 状态 | Zustand + Context + Hooks | 4.x | workspace.store · auth · theme |
| 样式 | Tailwind CSS 4 + CSS Variables | 4.3 | Linear Design 设计体系 |
| 图表 | Recharts + ECharts | 3.8 / 6.1 | 折线 / 柱状 / 饼图 + 复杂可视化 |
| HTTP | Axios | 1.16 | 统一封装 · Refresh Token 自动续期 |
| 图标 | Lucide React | - | SVG 图标 |
| Markdown | react-markdown + remark-gfm | - | AI 消息渲染（安全、无 `dangerouslySetInnerHTML`） |
| 进度条 | nprogress | - | 路由懒加载 |
| 导出 | xlsx · papaparse · jspdf · html2canvas | - | Excel / CSV / PDF / 截图 |

### 后端 `server/`
| 类别 | 选型 | 版本 | 用途 |
|---|---|---|---|
| 运行时 | Node.js + TypeScript | 18+ / 5.7 | - |
| 框架 | Express | 4.21 | RESTful API |
| ORM | TypeORM | 0.3 | 自动建表 · 迁移 |
| 数据库 | MySQL + mysql2 | 8 / 3.22 | 主存储 |
| 鉴权 | Passport + JWT (jsonwebtoken) | 0.7 / 9 | 无状态 Token · Access 2h · Refresh 30d |
| 密码哈希 | Argon2id | 0.44 | 行业首选（替代 bcrypt） |
| 参数校验 | Zod | 3.24 | DTO · 类型推断一体 |
| 安全 | Helmet · CORS · Compression | - | HTTP 头 · 跨域 · 压缩 |
| 日志 | Winston | 3.19 | 结构化日志 |
| 通知 | Nodemailer · Fetch | 8 · - | 邮件 · 机器人 · Webhook |
| AI | DeepSeek API | - | Chat · JSON Mode · Function Calling 三模式 |
| TG Bot | Grammy | 1.43 | 快速录入 · 长轮询 |
| Excel | ExcelJS | 4.4 | 后端 Excel 导入导出 |
| 上传 | Multer | 2.1 | 文件上传 |

### 工具链
- 包管理：**npm**
- 类型检查：`tsc --noEmit`（前端 `typecheck` · 后端 `check`）
- 开发：Vite dev（9009）+ tsx watch（9509）
- 迁移：TypeORM CLI

---

## 🎨 设计系统 & v3 布局架构

### Linear Design Tokens
- **画布**：深色底 `#0f1115` / 浅色阶梯（surface-0 → surface-4）
- **主题色**：Lavender 蓝 `#5e6ad2`（Primary）
- **视觉**：无阴影、hairline 描边、`8px` 圆角胶囊 / 直角 Tab
- **字体**：Inter（数字 `tabular-nums`）
- **组件库**：SectionCard · StatGrid · EmptyState · Btn · Modal · PillTabs · ContextBar

### v3 Workspace 布局架构
```
┌──────────────────────────────────────────────────────────────┐
│ StatusBar（全局状态栏）                                       │
├──────┬───────────────────────────────────────────────────────┤
│      │ CommandBar（⌘K 全局搜索占位 + 面包屑 + 用户菜单）      │
│      ├───────────────────────────────────────────────────────┤
│ Nav  │                                                       │
│ Rail │                  Outlet 主内容区                       │
│ 64px │                                                       │
│ /    │                                                       │
│ 240px│                                                       │
│      │                                                       │
└──────┴───────────────────────────────────────────────────────┘
```
| 组件 | 说明 |
|---|---|
| **AppShell** | 根布局壳；桌面 NavRail 侧栏、移动端自动切底部导航 |
| **NavRail** | 64 / 240px 双模式；一级菜单 + 二级 Popover；`useDeviceCapabilities` |
| **StatusBar** | 顶部全局信息条 |
| **CommandBar** | 面包屑 + ⌘K Command Palette 占位 + 用户动作 |
| **workspace.store** | Zustand + LRU + 持久化；Workspace 上下文 |
| **兼容回退**：URL 加 `?layout=classic` 切回经典布局 |

---

## 📂 项目结构
```
LifeOS2/
├── client/                                 # 前端（React + Vite + Tailwind 4）
│   ├── src/
│   │   ├── App.tsx                         # 路由入口（含 ?layout=classic）
│   │   ├── main.tsx                        # ReactDOM mount
│   │   ├── index.css                       # ★ 全局样式 + Tailwind + Linear Tokens
│   │   ├── layout/                         # ★ v3 AppShell / NavRail / StatusBar / CommandBar
│   │   ├── pages/                          # 页面（health/finance/life/investment/...）
│   │   ├── components/
│   │   │   ├── ui.tsx                      # ★ 基础原子组件（Btn/Modal/Field/Tag...）
│   │   │   ├── page.tsx                    # ★ 页面容器（PageHeader/SectionCard/StatGrid）
│   │   │   ├── shared/                     # 共享业务组件（NotificationLogsSection 等）
│   │   │   ├── finance/ health/ investment/ life/ notifications/
│   │   ├── config/                         # navigation.tsx 菜单 + 路由
│   │   ├── hooks/                          # useDeviceCapabilities / usePageTab 等
│   │   ├── store/                          # workspace.store 等 Zustand Store
│   │   ├── lib/                            # Axios 封装
│   │   ├── services/                       # 各模块 API
│   │   └── types/                          # TypeScript 类型
│   ├── vite.config.ts
│   └── package.json
│
├── server/                                 # 后端（Express + TypeORM）
│   ├── src/
│   │   ├── config/                         # 环境变量
│   │   ├── db/                             # 数据源 + 种子 + 迁移
│   │   ├── modules/                        # 业务模块
│   │   │   ├── health/ finance/ investment/ life/
│   │   │   ├── notifications/ system/ telegram/
│   │   │   │   └── system/export.router.ts  # ★ 数据导出（ZIP/JSON/CSV）
│   │   ├── routes/                         # 路由注册
│   │   └── shared/                         # 工具函数 / AI 客户端 / 共享服务
│   ├── .env.example
│   └── package.json
│
├── DESIGN.md                               # UI 设计规范
├── DEVELOPMENT.md                          # 开发规范
└── README.md                               # 本文件
```

---

## 🚀 快速开始

### 环境要求
- **Node.js** ≥ 18（推荐 20 LTS）
- **MySQL** ≥ 8.0
- **npm** 或 **pnpm**

### 三步启动
```bash
# 1. 克隆
git clone https://github.com/ZeroOneCN/Life.git
cd Life

# 2. 装依赖
cd client && npm install
cd ../server && npm install

# 3. 配置 + 建库
cp server/.env.example server/.env   # 填 JWT_SECRET / DB_HOST / DB_*
mysql -u root -p -e \
  "CREATE DATABASE IF NOT EXISTS lifeos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. 启动（两个终端）
# 终端 A — 后端（:9509）
cd server && npm run dev
# 终端 B — 前端（:9009，代理 /api → :9509）
cd client && npm run dev
```

🌐 打开 [http://localhost:9009](http://localhost:9009)
> 首次访问：检测到无用户时自动开放注册；创建第一个账号后注册入口关闭。

### 核心环境变量（`server/.env`）
| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | ✅ | - | JWT 签名密钥（生产换随机长串） |
| `DB_HOST` `DB_USERNAME` `DB_PASSWORD` `DB_DATABASE` | ✅ | 127.0.0.1 / lifeos / 3307 | MySQL 连接 |
| `DB_SYNCHRONIZE` | - | false | 生产关闭，用 migration |
| `DEEPSEEK_API_KEY` | - | - | AI 助理 + Token 看板 |
| `EXCHANGE_RATE_API_KEY` | - | - | 汇率实时拉取，未配走离线兜底 |
| `TELEGRAM_BOT_TOKEN` | - | - | TG Bot，未配跳过 |
| `SMTP_*` | - | - | 邮件通知渠道 |

### 生产部署
```bash
cd client && npm run build       # 产物 → client/dist（Nginx 托管）
cd server && npm run build       # 产物 → server/dist
cd server && npm run migration:run
cd server && npm start           # 或 PM2 / systemd 守护
```

> 💡 建议：Nginx 托管前端 + `/api` 反代 Node；MySQL 独立部署并定期备份；关闭 `DB_SYNCHRONIZE`。

---

## 🏗️ 架构总览
```
┌─────────────────────────────────────────────────────────────┐
│              浏览器（Vite dev / Nginx prod）                 │
│   React 18 + TS + React Router + Tailwind 4 + AppShell v3   │
└─────────────────────────────────────────────────────────────┘
                          │  HTTP / Axios
                          │  Authorization: Bearer <JWT>
                          ▼
┌─────────────────────────────────────────────────────────────┐
│      Express 4 + TS + Zod + Passport-JWT + Argon2id         │
│  auth-mw → router → service → entity → 统一返回              │
└─────────────────────────────────────────────────────────────┘
                          │  TypeORM / mysql2
                          ▼
                       MySQL 8 (utf8mb4)
```

**数据流**
- 前端：页面 → 子组件 → `services/xxxApi.ts` → `lib/api.ts` (Axios) → `/api/*`
- 后端：请求 → JWT → Zod 校验 → router → service → entity → `successResponse()`

---

## 🔌 API 速查
> 统一返回 `{ code: 0, data, message }` / `{ code: 非0, message }`；鉴权接口需 `Authorization: Bearer <token>`。

### 认证（免鉴权）
| Method | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/register` | 注册（仅无用户时开放） |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/logout` | 登出（带 token 单撤销，否则全撤） |
| GET | `/api/auth/me` | 当前用户 |

### 业务
| 模块 | 代表端点 |
|---|---|
| 仪表盘 | `GET /api/dashboard/summary`（30 秒缓存） |
| AI 助理 | `POST /api/assistant/chat` · `GET /api/assistant/usage` |
| 财务 | 贷款 / 房租 / 购物 / 订阅 / 旅行：完整 CRUD；购物/旅行 Excel 导入；报告月/年 |
| 投资 | `GET/POST/PATCH/DELETE /api/investment/forex/trades` · `/capital-flows` · `/settings` |
| 通知 | `/notifications/channels|scenes|templates|logs`（GET scenes/templates 自动补齐种子） |
| Telegram | `POST /api/telegram/bind-code` · `GET /api/telegram/status` |
| 数据导出 | `GET /api/system/export/modules` · `POST /api/system/export/export` |
| 健康探针 | `GET /api/system/health`（免鉴权） |

---

## 👨‍💻 开发指南

### 常用命令
| 命令 | 说明 |
|---|---|
| `cd client && npm run dev` | 前端（:9009） |
| `cd client && npm run typecheck` | 前端类型检查 |
| `cd client && npm run build` | 前端构建 |
| `cd server && npm run dev` | 后端（:9509） |
| `cd server && npm run check` | 后端类型检查 |
| `cd server && npm run build` | 后端编译 |
| `cd server && npm run seed` | 种子数据 |
| `cd server && npm run migration:run / migration:generate` | 迁移执行 / 生成 |

### 新增业务模块（标准模式）
**后端**
1. `server/src/modules/<领域>/` 建子目录
2. 实体继承 `TimestampedEntity` / `UserScopedEntity`
3. Router 模式：`asyncHandler` + `validateBody(Zod schema)` + `successResponse()`
4. `server/src/routes/index.ts` 注册

**前端**
1. `types/` 加类型 → `services/` 加 API → `components/<领域>/` 子组件
2. `pages/<领域>/` 页面主组件（**PageHeader + SectionCard + StatGrid** 三件套）
3. `config/navigation.tsx` 注册菜单 & 路由

### 代码规范
- 函数级 **JSDoc**（功能 + 参数 + 返回值）
- Zod 参数校验；错误用 `AppError`；分页 `parsePagination()`
- 前端 `apiGet/apiPost/apiPatch/apiDelete` 统一封装
- 提交前 `npm run build` 验证编译

### 数据契约
| 类型 | 存储 | 返回 | 展示 |
|---|---|---|---|
| 金额 | `decimal(10,2)` | 后端 `Number()` | 前端 `toFixed(2)` · `tabular-nums` |
| 体重 / 体脂 | `decimal(10,2)` | 同上 | 2 位小数 |
| 百分比 | - | - | `toFixed(1)` |
| 可选 number | - | - | `null` → `-` |
| 盈亏判定 | - | 原始数值 | `netPnlRaw >= 0` 判色（非格式化字符串） |

---

## 🗄️ 数据库表概览（约 50 张）
| 模块 | 主要表 |
|---|---|
| 系统 | `system_user_account` / `system_user_profile` / `system_auth_session` / `system_assistant_usage_logs` |
| 健康 | `health_step_*` / `health_fitness_*` / `health_vital_*` / `health_sleep_*` / `health_medication_*` / `health_checkup_*` |
| 财务 | `finance_loan_*` / `finance_rent_*` / `finance_shopping_*` / `finance_subscription_*` / `finance_travel_*` / `finance_budget*` / `finance_goal*` / `finance_bill_reminder_setting` |
| 投资 | `investment_forex_*` |
| 生活 | `life_todo_*` / `life_schedule_*` / `life_storage_*` / `life_card_*` |
| 通知 | `notification_center_channel / scene / scene_channel / template / log` |
| Telegram | `telegram_binding` |

---

## 🛣️ Roadmap
| 项 | 现状 | 计划 |
|---|---|---|
| 投资中心（加密/港股/美股） | 路由保留、菜单移除 | 后端 API 规划中 |
| 用户级 DeepSeek Key | 全局单 Key | 支持用户自配 |
| 自动化测试 | 未配置 | Vitest + Supertest |
| 国际化 | 中文界面 | i18n 接入 |
| CI/CD | 手动 | GitHub Actions |
| 汇率源 | Exchange Rate API v6（+ 离线兜底） | 多源冗余 |

---

## ❓ 故障排查速查
| 现象 | 根因 | 解决 |
|---|---|---|
| 前端 `Network Error` | 后端未起 / 端口不对 | 确认 :9509 运行；查 Vite 代理 |
| 登录 401 | JWT 过期 / 密钥变更 | 重新登录；保持 `JWT_SECRET` 稳定 |
| 注册入口消失 | 已存在用户 | 登录；或清空 `system_user_account` |
| `.toFixed is not a function` | 后端返回 string | 后端加 `Number()`；前端 `Number(x).toFixed(n)` |
| 构建类型错误 | 前后端类型不同步 | `npm run typecheck` 定位 → 同步 |
| 数据库连不上 | 端口 / 凭据错 | 默认端口 `3307`（非 3306）；查 `.env` |
| Token 看板不显示 | 后端未重启 / Key 未配 | 重启让 TypeORM 建表；配 `DEEPSEEK_API_KEY` |
| 净收益颜色错 | 旧版按字符串判色 | 统一按 `netPnlRaw` 原始数值判定 |
| TG Bot 启动失败 | Token 无效 / 网络不通 | 检查 Token；可通 `api.telegram.org` |
| TG 指令无反应 | 未绑定账号 | 先发 `/bind <码>`；查 10 分钟过期 |

---

## 📖 相关文档
- [DESIGN.md](./DESIGN.md) — **Linear Design 设计规范**（Token / 配色 / 组件样式 / 栅格）
- [DEVELOPMENT.md](./DEVELOPMENT.md) — **开发规范与约定**（组件模式 / 数据流 / 调试技巧）

---

<div align="right">

**License**：Private
**仓库**：[github.com/ZeroOneCN/Life](https://github.com/ZeroOneCN/Life)

</div>
