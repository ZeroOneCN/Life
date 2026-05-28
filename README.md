# LifeOS — 全生命周期数字化管理平台

> 一站式个人生活数据管理系统，覆盖健康、财务、生活、投资四大领域，提供统一的数据采集、分析、提醒和通知能力。

## 项目概览

LifeOS 是一个前后端分离的全栈 Web 应用，采用 **React + TypeScript + Vite** 构建前端界面，**Express + TypeScript + TypeORM** 搭建后端服务，**MySQL** 作为持久化存储。系统以「全生命周期」为设计理念，将个人生活的各个维度纳入统一的数据管理体系。

### 核心特性

- **多模块业务覆盖**：健康中心（运动/健身/体检/用药）、财务中心（购物/旅行/贷款/订阅/房租）、生活中心（物品/号卡/待办）、投资中心（外汇/加密/港股/美股）
- **统一通知中心**：支持邮件、企业微信、Webhook 三种通知渠道，可按业务场景灵活绑定
- **JWT 安全认证**：基于 Passport-JWT 的无状态会话，支持管理员初始化引导流程
- **深色主题 UI**：参考 Linear 设计语言构建的暗色系专业界面，支持亮色/暗色切换
- **响应式布局**：桌面端侧边栏导航 + 移动端自适应，960px 以下自动回退为单列

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript 5 | 函数组件 + Hooks |
| 构建工具 | Vite 6 | 开发热更新、生产构建优化 |
| 样式方案 | Tailwind CSS 4 + 自定义 CSS 变量 | 暗色主题为主，支持亮色切换 |
| 图表库 | Recharts / ECharts | 数据可视化 |
| 路由 | React Router v6 | 懒加载 + 路由守卫 |
| HTTP 客户端 | Axios | 统一封装 API 层 |
| 后端框架 | Express 4 + TypeScript 5 | RESTful API 设计 |
| ORM | TypeORM 0.3 | 自动建表、实体映射、迁移支持 |
| 数据库 | MySQL 8 (mysql2) | 主数据存储 |
| 认证 | Passport + JWT | 无状态 Token 鉴权 |
| 参数校验 | Zod 3 | 请求体验证，类型安全 |
| 通知发送 | Nodemailer / Fetch | 邮件 / 企业微信机器人 / Webhook |
| 日志 | Winston | 结构化日志输出 |

## 项目结构

```
LifeOS2/
├── client/                          # 前端应用（React + Vite）
│   ├── src/
│   │   ├── components/             # 公共组件
│   │   │   ├── ui.tsx              # 基础 UI 组件（Btn/Field/Tag/Table 等）
│   │   │   ├── page.tsx            # 页面级容器组件（PageHeader/SectionCard/StatGrid）
│   │   │   ├── date/               # 日期选择器组件
│   │   │   ├── finance/            # 财务模块子组件
│   │   │   ├── health/             # 健康模块子组件
│   │   │   ├── investment/         # 投资模块子组件
│   │   │   ├── life/               # 生活模块子组件
│   │   │   └── Notification*.tsx   # 通知相关组件
│   │   ├── config/
│   │   │   └── navigation.tsx      # 导航菜单与路由配置
│   │   ├── hooks/                  # 自定义 Hooks
│   │   ├── layout/
│   │   │   └── MainLayout.tsx      # 主布局（侧边栏 + 顶栏 + 内容区）
│   │   ├── lib/
│   │   │   └── api.ts              # Axios 封装与错误处理
│   │   ├── pages/                  # 页面组件
│   │   │   ├── auth/Login.tsx      # 登录/注册页
│   │   │   ├── Dashboard.tsx       # 首页仪表盘
│   │   │   ├── health/             # 健康中心页面（4 个）
│   │   │   ├── finance/            # 财务中心页面（5 个）
│   │   │   ├── life/               # 生活中心页面（3 个）
│   │   │   ├── investment/         # 投资中心页面（4 个）
│   │   │   ├── notifications/      # 通知中心页面
│   │   │   └── settings/           # 系统设置页面
│   │   ├── services/               # 前端业务逻辑层（API 调用 + 本地计算）
│   │   ├── types/                  # TypeScript 类型定义
│   │   ├── utils/                  # 工具函数
│   │   ├── App.tsx                 # 应用入口
│   │   ├── main.tsx                # DOM 挂载
│   │   └── index.css               # 全局样式（CSS 变量 + 组件样式）
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                         # 后端服务（Express + TypeORM）
│   ├── src/
│   │   ├── app.ts                  # Express 应用配置
│   │   ├── index.ts                # 服务启动入口
│   │   ├── config/
│   │   │   └── env.ts              # 环境变量加载与类型化
│   │   ├── db/
│   │   │   ├── data-source.ts      # TypeORM 数据源配置
│   │   │   ├── bootstrap.ts        # 数据库自动初始化
│   │   │   ├── seed.ts             # 种子数据（默认场景/模板/渠道）
│   │   │   └── migrations/         # 数据库迁移文件
│   │   ├── modules/                # 业务模块（按领域划分）
│   │   │   ├── health/             # 健康模块（步数/健身/体检/用药）
│   │   │   ├── finance/            # 财务模块（购物/旅行/贷款/订阅/房租）
│   │   │   ├── investment/         # 投资模块（外汇）
│   │   │   ├── life/               # 生活模块（号卡/物品/待办）
│   │   │   ├── notifications/      # 通知中心模块
│   │   │   └── system/             # 系统模块（认证/仪表盘/健康探针）
│   │   ├── routes/
│   │   │   └── index.ts            # 路由注册中心
│   │   └── shared/                 # 共享基础设施
│   │       ├── db/                 # 基础 Service（用户设置等）
│   │       ├── domain/             # 领域服务（通知发送）
│   │       ├── errors/             # 自定义错误类
│   │       ├── http/               # HTTP 中间件与工具
│   │       ├── persistence/        # 基础实体（时间戳/用户范围/设置基类）
│   │       ├── services/           # 通知发送实现
│   │       └── utils/              # 工具函数（日期/分页/数字/文本）
│   ├── .env.example                # 环境变量模板
│   ├── package.json
│   └── tsconfig.json
│
├── DESIGN.md                       # UI 设计规范（Linear 暗色主题）
└── .gitignore
```

## 业务模块说明

### 健康中心

| 模块 | 功能 | 关键能力 |
|------|------|----------|
| 运动步数 | 每日步数录入与趋势图表 | Recharts 折线图、X 轴斜向标签 |
| 健身减脂 | 饮食/运动/体重/购物四维记录 | 多维度数据追踪 |
| 体检指标 | 批量录入 + 自定义模板 | 指标异常洞察分析 |
| 日常用药 | 用药记录 + 购药记录 + 库存估算 | 基于时间线的双指针库存算法、低库存阈值提醒 |

### 财务中心

| 模块 | 功能 | 关键能力 |
|------|------|----------|
| 网上购物 | 商品记录 + 平台管理 + 分类账本 | Excel 导入导出 |
| 旅行游玩 | 行程预订 + 费用记录 + 排行榜 | 支出报表生成 |
| 贷款还款 | 平台管理 + 还款计划 + 账单追踪 | 统计面板 |
| 服务订阅 | 分类管理 + 记录跟踪 + 设置 | 订阅周期管理 |
| 房租水电 | 渠道管理 + 缴费记录 + 成本统计 | 月度/年度汇总 |

### 生活中心

| 模块 | 功能 | 关键能力 |
|------|------|----------|
| 物品追踪 | 物品归档 + 存放位置 + 设置 | 归档/恢复机制 |
| 号卡中心 | 号卡管理 + 充值记录 + 账单导入 | 运营商分类 |
| 待办事项 | 任务 CRUD + 日志 + 回收站 | 软删除 + 恢复 |

### 投资中心

| 模块 | 功能 | 关键能力 |
|------|------|----------|
| 外汇市场 | 交易记录 + 资金流水 + 汇率计算器 | 盈亏统计 |
| 加密市场 | 占位（开发中） | - |
| 港股市场 | 占位（开发中） | - |
| 美股市场 | 占位（开发中） | - |

### 通知中心

统一的告警与提醒基础设施：

- **三种渠道**：邮件（SMTP）、企业微信（Webhook）、自定义 Webhook
- **场景绑定**：每个业务场景可独立绑定多个通知渠道
- **测试发送**：渠道配置后可立即测试连通性
- **日志管理**：所有发送记录统一存储，支持清空
- **接入的业务场景**：服药提醒、低库存提醒等

### Dashboard 首页

- 四大中心摘要卡片（累计用量、活跃药品、购药总额、今日用量）
- 健康趋势图表（步数/体重曲线）
- 投资收益走势
- 30 秒内存缓存降低数据库压力

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- npm 或 pnpm

### 1. 克隆项目

```bash
git clone <repository-url>
cd LifeOS2
```

### 2. 安装依赖

```bash
# 安装前端依赖
cd client && npm install

# 安装后端依赖
cd ../server && npm install
```

### 3. 配置环境变量

复制后端环境变量模板并修改：

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，至少需要配置以下项：

```env
# 服务端口
PORT=3100

# JWT 密钥（请替换为随机字符串）
JWT_SECRET=your_random_secret_here

# 数据库连接
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=lifeos

# 是否首次启动时自动建表（首次设为 true，之后改为 false）
DB_SYNCHRONIZE=true

# SMTP 邮件配置（可选，用于通知中心的邮件渠道）
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your_email@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@example.com
```

### 4. 初始化数据库

确保 MySQL 已创建对应数据库：

```sql
CREATE DATABASE IF NOT EXISTS lifeos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 启动开发服务器

```bash
# 终端 1：启动后端服务（端口 3100）
cd server
npm run dev

# 终端 2：启动前端开发服务器（端口 3000，代理到后端）
cd client
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

首次访问时会进入管理员注册引导流程——系统检测到没有用户时自动开放注册入口，创建首个管理员后注册通道关闭。

### 6. 生产构建

```bash
# 前端构建
cd client && npm run build

# 后端构建
cd server && npm run build

# 启动生产服务
cd server && npm start
```

## 开发指南

### 常用命令

| 命令 | 说明 |
|------|------|
| `cd client && npm run dev` | 启动前端开发服务器（Vite HMR） |
| `cd client && npm run typecheck` | 前端 TypeScript 类型检查 |
| `cd client && npm run build` | 前端生产构建 |
| `cd server && npm run dev` | 启动后端开发服务器（tsx watch） |
| `cd server && npm run check` | 后端 TypeScript 类型检查 |
| `cd server && npm run seed` | 执行种子数据填充 |
| `cd server && npm run start` | 启动生产服务 |

### 新增业务模块的步骤

1. **后端**：
   - 在 `server/src/modules/` 下新建目录
   - 创建实体文件（`.entity.ts`）继承基础实体类
   - 创建路由文件（`.router.ts`），使用 `asyncHandler` + `validateBody(Zod)` 模式
   - 在 `server/src/routes/index.ts` 注册路由

2. **前端**：
   - 在 `client/src/types/` 下添加 TypeScript 类型定义
   - 在 `client/src/services/` 下添加 API 调用层和本地计算逻辑
   - 在 `client/src/components/` 下添加页面子组件
   - 在 `client/src/pages/` 下添加页面主组件
   - 在 `client/src/config/navigation.tsx` 注册菜单项和路由

3. **种子数据**（可选）：在 `server/src/db/seed.ts` 中添加默认数据

### 代码规范

- 所有函数必须包含 JSDoc 注释（功能描述、参数说明、返回值）
- API 请求参数使用 Zod Schema 校验，返回值使用统一 `successResponse()` 格式
- 错误处理使用 `AppError` 类，通过中间件统一转换为 HTTP 响应
- 前端 API 调用通过 `apiGet/apiPost/apiPatch/apiDelete` 统一封装
- 分页查询使用 `parsePagination()` 工具函数，自带边界保护

## 设计规范

项目 UI 基于 Linear 暗色设计语言构建，详见 [DESIGN.md](./DESIGN.md)。

核心设计原则：
- **暗色画布**：`#010102` 近纯黑背景
- **品牌强调色**：薰衣草蓝 `#5e6ad2`
- **四级表面层级**：canvas → surface-1 → surface-2 → surface-3 → surface-4
- **细线边框**：1px hairline 分隔，不使用阴影
- **响应式断点**：960px 以下网格回退为单列

## 许可证

MIT License
