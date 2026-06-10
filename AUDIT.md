# LifeOS2 全维度审计报告

> 📅 审计日期：2026-06-09
> 🔍 范围：UI/UX · 后端架构 · AI 能力 · 性能 · 功能完整性
> 📂 项目根：`c:\Code\LifeOS2`
> 🛠️ 仅审计未改动文件；本文件为可编辑模板，修改确认后再进入实施

---

## 0. 模板使用说明

每条发现后挂一个状态行，可选项：

- `[ ]` 待处理
- `[~]` 处理中
- `[x]` 已完成
- `[!]` 暂不处理（请在备注里写原因）
- `[?]` 待确认

格式：
```
- [ ] **简述** — 涉及文件:行号
  - 状态：`<状态>`
  - 优先级：`<P0 | P1 | P2 | P3>`
  - 备注：<空>
```

---

## 1. 整体评分卡（4 大维度 × 子项）

| 维度 | 分数 | 评语 |
|---|---|---|
| 功能完成度 | 8.0 / 10 | 17 个核心页面 + 49 张表 + Excel 导入；3 个投资市场 localStorage 伪实现 |
| UI/UX | 6.5 / 10 | 基础组件扎实；40+ 硬编码颜色；Modal 无焦点陷阱；Tab 视觉两套 |
| 后端架构 | 6.0 / 10 | 基类/工厂/共享层到位；多租户旁路 5+ 处；0 测试；0 索引 |
| AI | 5.0 / 10 | 仅 3 个 scene 跑通；token 估算误差 30%；无流式无多模型 |
| 性能 | 4.7 / 10 | 全表 find + 内存过滤 10+ 处；Section 同步 import；无缓存层 |
| 模块联动 | 3.0 / 10 | 已做：购物→储物、Dashboard 聚合、月报通知；未做：饮食→财务、信用卡→分类 |
| 商业化 | 3.5 / 10 | 单租户单用户、无 PWA、无 i18n |
| 文档 | 8.5 / 10 | README+DEVELOPMENT+DESIGN 齐全；缺 CHANGELOG、OpenAPI、ADR |

**综合：5.7 / 10 中段水平**

---

## 2. 🚨 P0 立刻要修（本周）

### 2.1 安全 · 多租户越权
- [ ] **5+ router 用 `req.body.userId ?? authUserId`，可被 A 用户改写 B 用户数据**
  - 状态：`<待处理>`
  - 优先级：`P0`
  - 涉及文件：
    - `server/src/modules/finance/subscription.router.ts:258/278/388/510/580/660/695/760`
    - `server/src/modules/finance/travel.router.ts:278`
    - `server/src/modules/finance/loan.router.ts:65-67`
    - `server/src/modules/life/card.router.ts`（多 PATCH）
    - `server/src/modules/health/fitness.router.ts`、`medication.router.ts:128-137`
  - 修复方案：
    1. 删除所有 router 入参里的 `userId`，强制 `const userId = requireAuthUser(req).id`
    2. 抽 `router.use(requireAuth)` 全局包装
    3. 写 `tenant-isolation.spec.ts` e2e 测试覆盖所有 GET/PATCH/DELETE
  - 工作量：1-2 天
  - 备注：<空>

### 2.2 性能 · 全表 find + 内存过滤
- [ ] **10+ 端点走 `repo.find({ where })` 全拉 + JS filter/aggregate**
  - 状态：`<待处理>`
  - 优先级：`P0`
  - 涉及文件：
    - `server/src/modules/finance/rent.router.ts:138-163/326-373/375-390`
    - `server/src/modules/finance/travel.router.ts:395-412/541-552/585-650`
    - `server/src/modules/finance/loan.router.ts:292-314/511-536`
    - `server/src/modules/finance/shopping.router.ts:418-447/449-471`
    - `server/src/modules/health/medication.router.ts:431-449/496-519`
    - `server/src/modules/health/fitness.router.ts`（首页 7 拉）
  - 复现：单用户 1 万条 → dashboard 1.5s+；10 万条 OOM
  - 修复方案：
    1. WHERE 下沉到 TypeORM `findAndCount({ where, take, skip })`
    2. 聚合改 QueryBuilder `SUM() GROUP BY`
    3. 强制使用 `parsePagination` 的 take（已有但多数 router 忽略）
  - 工作量：2-3 天
  - 备注：<空>

### 2.3 性能 · 实体零 @Index 复合索引
- [ ] **业务高频过滤列（billing_month/trade_date/record_time/test_date）缺复合索引**
  - 状态：`<待处理>`
  - 优先级：`P0`
  - 涉及文件：
    - `server/src/modules/finance/entities/finance-rent-record.entity.ts`
    - `server/src/modules/finance/entities/finance-loan-bill.entity.ts`
    - `server/src/modules/finance/entities/finance-travel-expense-record.entity.ts`
    - `server/src/modules/finance/entities/finance-shopping-record.entity.ts`
    - `server/src/modules/health/entities/health-fitness-diet-record.entity.ts`
    - `server/src/modules/health/entities/health-step-record.entity.ts`
    - `server/src/modules/health/entities/health-medication-record.entity.ts`
    - `server/src/shared/persistence/timestamped.entity.ts`（`deleted_at` 无索引）
  - 修复方案：
    ```ts
    @Index('idx_xxx_user_date', ['user_id', '*_date'])
    @Index('idx_deleted_at', ['deleted_at'])
    @Index('idx_user_created', ['user_id', 'created_at'])
    ```
    + migration 同步加（synchronize:true 在生产禁用后必须）
  - 工作量：1 天
  - 备注：<空>

---

## 3. P1 短期（本月）

### 3.1 架构 · 统一错误码 + API 响应契约
- [ ] **5+ 处 `res.status(...).json()` 直写，错误码 400/422 混用**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/finance/exchange-rate.router.ts:103/141/159`
    - `server/src/modules/health/fitness.router.ts:515/547`
    - `server/src/modules/system/analysis.router.ts:79/87`
  - 修复方案：
    1. 引入 `ErrorCode` 枚举（`AUTH_REQUIRED` / `TENANT_FORBIDDEN` / `DUPLICATE_RECORD` / `VALIDATION_FAILED` ...）
    2. 全局 `errorHandler` 改造，输出 `{ code, message, requestId, details? }`
    3. `validateBody` 强制替代 `schema.parse`
    4. ESLint 规则禁 `res.json`/`res.send` 出现在 router 层（白名单 `shared/http/response.ts`）
  - 工作量：2-3 天
  - 备注：<空>

### 3.2 安全 · JWT 强化
- [ ] **refresh token 不轮换、不吊销；缺登录限流；bcrypt cost=10**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/system/auth.router.ts`
    - `server/src/config/env.ts`
  - 修复方案：
    1. refresh token 一次性（用后即失效）+ Redis 黑名单 `jti`
    2. `/auth/login` 加 `express-rate-limit`（5/min/IP）
    3. 改 `argon2id` 替代 bcrypt（或 bcryptjs + worker_threads）
    4. 登出 → 加黑名单
  - 工作量：1 天（需引入 Redis 依赖）
  - 备注：<空>

### 3.3 架构 · 拆分超长 router
- [ ] **4 个 router 700-920 行，承担多业务线**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/finance/subscription.router.ts`（700+）
    - `server/src/modules/finance/travel.router.ts`（880+）
    - `server/src/modules/notifications/notification-center.router.ts`（920+）
    - `server/src/modules/investment/forex.router.ts`（780+）
  - 修复方案：
    1. 抽 `*.service.ts` 承担业务（订阅默认配置、重复检测、触发器、模板渲染）
    2. router 只做「参数解析 → service 调用 → 响应」
    3. `notification-center` 拆 4 个子 router（template/scene/preference/log）
  - 工作量：1 周
  - 备注：<空>

### 3.4 性能 · Section 同步 import + manualChunks 缺失
- [ ] **路由级 lazy 落地，但 Section 全同步；vendor 全量打包**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `client/src/pages/finance/Rent.tsx:8-19`（5 个 Section 同步 import）
    - `client/src/pages/finance/FinanceReport.tsx`
    - `client/src/pages/health/Medication.tsx`
    - `client/src/components/health/MedicationAnalysisSection.tsx:3-15`（recharts 11 个子模块）
    - `client/src/components/finance/TravelReportSection.tsx`（jspdf/html2canvas/xlsx）
    - `client/vite.config.ts:13-32`
  - 修复方案：
    1. 体积 ≥ 5KB 的 Section 改 `lazyWithProgress(() => import(...))`
    2. `vite.config.ts` 加 `manualChunks` 拆 react / charts / pdf / utils
    3. jspdf/html2canvas/xlsx 改 dynamic import（仅 PDF 导出按钮按下时下载）
  - 工作量：1 周
  - 工作量：1 周
  - 备注：<空>

### 3.5 性能 · React Query 替代 4-7 并行 useEffect fetch
- [ ] **路由切换全量重拉 4-7 个接口，无缓存无 dedupe**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `client/src/pages/finance/Rent.tsx`（4 个 effect）
    - `client/src/pages/health/Fitness.tsx`（7 个 effect）
    - `client/src/pages/health/Medication.tsx`（5 个 effect）
  - 修复方案：
    1. 引入 `@tanstack/react-query`
    2. staleTime 30s、cacheTime 5min、refetchOnWindowFocus
    3. 合并批量接口为 `/rent/dashboard` 等一发
  - 工作量：1 周
  - 备注：<空>

### 3.6 性能 · 通知批量化 + 日志清理
- [ ] **通知串行循环写库；日志无清理上限**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/finance/loan.router.ts:205-212`
    - `server/src/modules/finance/rent.router.ts:402-419`
    - `server/src/modules/notifications/notification-center.router.ts`
  - 修复方案：
    1. `Promise.all(reminders.map(sendNotificationSceneLogs))` 或 `.insert([...])` 批量
    2. 加 `notification-center.prune.scheduler.ts`，每天 3 点清理 90 天前日志
    3. 复合索引 `(user_id, created_at)`
  - 工作量：0.5 天
  - 备注：<空>

### 3.7 AI · `analysis.router.ts` 漏埋点修复
- [ ] **外汇 AI 复盘未走 `recordAssistantUsage`，Token 统计失真**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/system/analysis.router.ts:33-194/154-168`
    - `server/src/modules/system/assistant-usage.service.ts:248-252`（SCENE_LABELS 加 `'analysis': '外汇 AI 复盘'`）
  - 修复方案：1 小时
  - 备注：<空>

### 3.8 AI · 改用真实 token + 加 latency + 反注入
- [ ] **token 用 0.6 字符估算误差 30%；无 latency 字段；prompt 无反注入边界**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/system/assistant.router.ts:90`
    - `server/src/modules/system/assistant-usage.service.ts:35/104`
    - `server/src/modules/health/fitness-ai.service.ts:76/185/283`
    - `server/src/modules/system/entities/system-assistant-usage-log.entity.ts`
  - 修复方案：
    1. `callDeepSeek` 返回 `usage` 真实 token
    2. usage_log 加 `latency_ms`、`prompt_snapshot`（1% 抽样）
    3. 3 处 prompt 加反注入边界
  - 工作量：1 天
  - 备注：<空>

### 3.9 AI · 抽 `llm-router.service.ts` 多模型路由
- [ ] **3 处硬编码 `deepseek-chat`；加 OpenAI/Claude/通义要复制粘贴**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/system/assistant.router.ts:91/98`
    - `server/src/modules/system/analysis.router.ts:154-168`
    - `server/src/modules/health/fitness-ai.service.ts:85/92`
  - 修复方案：
    ```ts
    // server/src/shared/services/llm-router.service.ts
    type LlmScene = 'chat' | 'fitness.food' | 'fitness.exercise' | 'analysis';
    const ROUTE_TABLE: Record<LlmScene, { provider; model; costPer1k; maxTokens; ... }>;
    export async function llmCall(scene, messages, options) { ... }
    ```
  - 工作量：3 天
  - 备注：<空>

### 3.10 AI · 缓存表加 last_hit_at + 90 天清理 cron
- [ ] **缓存表无 TTL/LRU；命中率不可见**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/health/entities/health-food-nutrition-cache.entity.ts`
    - `server/src/modules/health/entities/health-exercise-calorie-cache.entity.ts`
  - 修复方案：
    1. 加 `last_hit_at datetime` 字段
    2. 新增 `fitness-cache.prune.scheduler.ts`，每天 3 点清理 `last_hit_at < NOW() - 90 DAY AND hit_count < 5`
    3. 新增 `GET /api/health/fitness/ai/cache-stats` 返回命中率
  - 工作量：1 天
  - 备注：<空>

### 3.11 性能 · Date 过滤全部 dayjs 内存分桶
- [ ] **拿到 records 后 `dayjs().format('YYYY-MM')` 重新分桶，O(n)**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/modules/finance/loan.router.ts:511-536`
    - `server/src/modules/finance/travel.router.ts:541-552`
    - `server/src/modules/finance/rent.router.ts:326-373`
  - 修复方案：SQL 端 `DATE_FORMAT(date, '%Y-%m')` 或 QueryBuilder
  - 工作量：1 天
  - 备注：<空>

### 3.12 数据 · `synchronize: env.DB_SYNCHRONIZE` 生产强风险
- [ ] **生产误开 synchronize 会自动 DROP COLUMN**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 涉及文件：
    - `server/src/db/data-source.ts:31`
    - `server/src/config/env.ts:36`
  - 修复方案：
    1. 生产默认 `synchronize: false`
    2. 引入 `typeorm migration:generate` + `migration:run` 流程
    3. `db/bootstrap.ts` 改造为可重入
  - 工作量：2 天
  - 备注：<空>

---

## 4. P2 中期（季度内）

### 4.1 架构 · 可观测性补齐
- [ ] **`console.error` 静默吞错；`/health` 不探活；无 request_id；内存缓存多实例不命中**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `server/src/shared/http/error-handler.ts`
    - `server/src/modules/life/storage.router.ts:301`
    - `server/src/modules/system/system-health.ts`
    - `server/src/modules/system/dashboard.router.ts`（内存缓存）
    - `server/src/modules/finance/exchange-rate.router.ts`（rateCache: Map）
  - 修复方案：
    1. 全链路 `requestId`（`AsyncLocalStorage`）
    2. `/health/live` + `/health/ready`（探 MySQL/Redis/外部 API）
    3. `dashboardCache`/`rateCache` 迁 Redis
    4. 关键操作（settings 变更、删除、登录）落 `audit_log` 表
  - 工作量：3-5 天
  - 备注：<空>

### 4.2 架构 · 跨模块抽象
- [ ] **导入逻辑、重复检测、库存计算、模板渲染散落多文件重复实现**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `server/src/modules/finance/shopping.router.ts` / `forex.router.ts`（导入）
    - `server/src/modules/finance/travel.router.ts`（重复检测）
    - `server/src/modules/health/medication.router.ts`（库存）
    - `server/src/shared/services/notification-sender.ts`（模板渲染）
    - `server/src/shared/domain/notification.ts:renderTemplate`（无白名单）
  - 修复方案：
    1. 抽 `ImportService`（CSV/Excel → 行级 transform → 批量 insert，支持 dry-run）
    2. 抽 `DuplicateDetector` 策略接口（hash / 字段组合 / 模糊匹配）
    3. 抽 `RecurrenceCalculator`（`todo-recurrence.ts` 已是雏形）
    4. 抽 `TriggerEvaluator`（通知场景判定）
    5. `renderTemplate` 加 `Object.keys` 白名单 + 转义
  - 工作量：1-2 周
  - 备注：<空>

### 4.3 UI · 40+ 硬编码颜色全部走 token
- [ ] **40+ 处硬编码 hex/rgba/white 绕开 design token，破坏一致性**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：`client/src/index.css`
    - L1406, L1438, L1695, L5102, L5129（`.btn-primary/danger-fill/switch-knob`）
    - L5257-5273（`.pnl-text-profit/dark` 等外汇盈亏色）
    - L6635, L7828, L8017, L8378, L8458, L9823, L10496（批量硬编码）
    - L11797-11805（`.dash-upcoming-sub-days.is-warn`）
    - L6982（`.dash-dot-low`）
    - L1214-1244（`.fitness-ai-result` 全部硬编码灰阶）
  - 修复方案：
    1. 替换为 `var(--color-*)` 或 `color-mix(in srgb, var(--color-X) X%, transparent)`
    2. 暗黑模式补 `.pnl-cell-profit/dark` 等变体
  - 工作量：1 天
  - 备注：<空>

### 4.4 UI · 圆角 token 几乎未被使用
- [ ] **`--radius-sm/md/lg/pill` 已定义但 200+ 处用 `border-radius: 12/14/16/18/24px`**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：`client/src/index.css` 全文
  - 修复方案：硬编码半径换 `var(--radius-md/lg)`，或删掉未用 token
  - 工作量：0.5 天
  - 备注：<空>

### 4.5 UI · Tag tone 类型扩展 + 颜色语义化
- [ ] **tone 只支持 default|green|orange|blue|red；业务用 default 兜底语义丢失**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/components/ui.tsx:343-348`
    - `client/src/pages/finance/FinanceReport.tsx:21-27`（独立 TONE_MAP）
    - `client/src/index.css:1501-1515`
  - 修复方案：扩 tone 为 `info|success|warning|danger|neutral`
  - 工作量：0.5 天
  - 备注：<空>

### 4.6 UI · Modal 焦点陷阱 + Toast aria-live
- [ ] **Modal 无 focus-trap、无初始焦点、关闭不还焦点；Toast 无 role/aria-live**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/components/ui.tsx:161-233`（Modal）
    - `client/src/components/ui.tsx:67-81`（Toast）
  - 修复方案：
    1. Modal 加 `focus-trap-react` 或自实现 keydown 拦截
    2. 关闭时焦点还给触发元素
    3. Toast 容器加 `role="status" aria-live="polite"`，错误类型用 `"assertive"`
  - 工作量：0.5 天
  - 备注：<空>

### 4.7 UI · `EmptyState` icon 类型 + FinanceReport 用法
- [ ] **`icon?: ReactNode` 期望，但 FinanceReport 传 string → emoji 被渲染成大段文字**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/components/page.tsx:83-84`
    - `client/src/pages/finance/FinanceReport.tsx:198/257/279/284/339`
    - `client/src/index.css:1623-1629`
  - 修复方案：要么 `EmptyState` 支持 string-icon 自动包 emoji span，要么 FinanceReport 传 ReactNode
  - 工作量：0.5 天
  - 备注：<空>

### 4.8 UI · 抽公共组件 ChartCard / FormGrid / tooltipStyle
- [ ] **9+ grid CSS、4+ tooltipStyle、2+ ChartCard 重复**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/components/finance/RentStatisticsSection.tsx:32-59`
    - `client/src/components/health/FitnessDashboardSection.tsx:47-72`
    - `.shopping-entry-grid-records`、`.loan-bill-entry-grid`、`.loan-repayment-entry-grid`、`.travel-book-form-grid`、`.medication-entry-grid`、`.fitness-entry-grid-{diet,exercise,shopping,weight}`
  - 修复方案：
    1. 抽 `components/charts.tsx` 含 `ChartCard` + `tooltipStyle`
    2. 抽 `<FormGrid columns="repeat(4, 1fr)">` + 一个 CSS class
    3. 抽 `services/sync.ts`（`findCreated/findDeletedIds` 4+ 文件）
  - 工作量：2 天
  - 备注：<空>

### 4.9 UI · 30s 轮询 + `document.hidden` 暂停
- [ ] **标签页隐藏时仍在轮询，浪费资源**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/pages/Dashboard.tsx:204`
    - `client/src/components/settings/DeepseekUsageWidget.tsx:302-309`
  - 修复方案：`visibilitychange` 事件 + `document.hidden` 暂停
  - 工作量：0.5 天
  - 备注：<空>

### 4.10 UI · Dashboard 可点击卡片识别
- [ ] **5 个卡片可点（hover 箭头动效），3 个不可点，视觉无法区分**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/pages/Dashboard.tsx:305/337/368/399/423/455/478/509`
  - 修复方案：要么所有 dash-card 加 `cursor` + `aria-label`；要么全做成可点
  - 工作量：0.5 天
  - 备注：<空>

### 4.11 UI · AssistantLauncher 拖动手柄 aria-label + 焦点环
- [ ] **拖动手柄无 aria-label；`:focus-visible` 不显示 tooltip**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/components/shared/AssistantLauncher.tsx:474-477/534-537/607-628`
    - `client/src/index.css:11299`
  - 修复方案：
    1. header 加 `aria-label="按住拖动 AI 助理面板"`
    2. tooltip 在 `:focus-visible` 也展示
    3. URL 白名单加 `data:` 拦截
  - 工作量：0.5 天
  - 备注：<空>

### 4.12 AI · 前端 SSE 流式 + AbortController + 失败重试
- [ ] **AssistantLauncher 是阻塞式 + 一次性 + 无流式 + 无中断**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：
    - `client/src/services/assistantApi.ts:5-7`
    - `client/src/components/shared/AssistantLauncher.tsx:560-576`
    - `server/src/modules/system/assistant.router.ts:281-285`
  - 修复方案：
    1. assistantApi 改 EventSource / fetch-stream
    2. 后端改 `text/event-stream` 持续推 `content` 增量
    3. 失败重试 + 续写按钮
    4. `MAX_HISTORY` 改 8 + 多轮压缩
  - 工作量：1 周
  - 备注：<空>

---

## 5. P3 长期（半年内）

### 5.1 功能 · 全量数据备份/恢复 + iCal 订阅
- [ ] **下载 zip 备份 / todo 订阅到系统日历**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `system/backup.router.ts` + `life/todo/ical` + 个人中心下载按钮
  - 工作量：M (2 周)
  - 备注：<空>

### 5.2 功能 · 健康月报/年报（对齐 FinanceReport）
- [ ] **健康 4 模块月聚合 + 同环比 + 异常 Top 3 + AI 解读**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `health-report.router.ts` + `pages/health/HealthReport.tsx`
  - 工作量：M (2 周)
  - 备注：<空>

### 5.3 功能 · 信用卡账单 AI 自动分类
- [ ] **导入招行账单 → 自动拆 rent/shopping/subscription + 复核**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `finance/card-bill-classify.service.ts` + DeepSeek function call + `finance_card_bill_record` 加 `auto_category`
  - 工作量：M (2-3 周)
  - 备注：<空>

### 5.4 功能 · 健身饮食 → 财务「生活成本」自动同步
- [ ] **午饭 ¥18 自动入财务月报**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：
    - 改 `finance-report.router.ts` 加 `diet` module
    - 健身页加「同步到财务」开关
  - 工作量：M (2 周)
  - 备注：<空>

### 5.5 功能 · PWA + 离线写入队列
- [ ] **地铁里录步数，到家自动同步**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `vite-plugin-pwa` + Workbox + Dexie
  - 工作量：L (3-4 周)
  - 备注：<空>

### 5.6 质量 · 测试体系（Vitest + Supertest，0→60%）
- [ ] **改一行代码 200 个单测保驾**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `vitest.config.ts` + `**/*.test.ts` + GitHub Actions
  - 工作量：L (4 周)
  - 备注：<空>

### 5.7 功能 · 投资业绩归因 + benchmark
- [ ] **「XAUUSD 贡献 ¥800，USDJPY 拖累 ¥300」**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：扩展 `forex.router.ts` dashboard-summary + 新增 `investment.performance.attribution`
  - 工作量：M (2 周)
  - 备注：<空>

### 5.8 功能 · 多用户 / 家庭共享
- [ ] **伴侣共享 todo/购物/财务；孩子家长模式**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `system_household` + `system_household_member` + 邀请码 + 角色
  - 工作量：L (4-6 周)
  - 备注：<空>

### 5.9 功能 · i18n 中/英双语
- [ ] **切英文版**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：新增 `react-i18next` + `locales/{zh-CN,en-US}.json`
  - 工作量：L (3 周)
  - 备注：<空>

### 5.10 商业化 · Marketing 基建
- [ ] **GA4 + Sentry + `/pricing` 营销页**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：
    - `client/index.html` 补 description/og
    - 新增 PostHog + Sentry
    - 新增 `pages/marketing/Pricing.tsx`
    - 新增 sitemap.xml
  - 工作量：M (2 周)
  - 备注：<空>

---

## 6. 隐藏坑（必须知道但不一定立刻修）

### 6.1 3 个投资市场是 localStorage 伪实现
- [ ] **Crypto / HKStock / USStock 100% 存 localStorage，多设备必丢**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：
    - `client/src/config/navigation.tsx:21-23`
    - `client/src/pages/investment/{Crypto,HKStock,USStock}.tsx`
    - `client/src/components/investment/InvestmentTradePage.tsx`
    - `client/src/services/investmentStorage.ts:16-37`
    - `server/src/modules/investment/entities/`（无 crypto/hk/us 实体）
  - 修复：3 个市场迁到后端，token 改为 JWT 鉴权下 server storage
  - 备注：<空>

### 6.2 `ModulePlaceholderPage` 是死代码
- [ ] **未被任何页面引用**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：`client/src/pages/shared/ModulePlaceholderPage.tsx`
  - 备注：<空>

### 6.3 `analysis.router.ts` 绕开 env 校验
- [ ] **直接 `process.env.DEEPSEEK_*` 读，绕过 Zod 校验**
  - 状态：`<待处理>`
  - 优先级：`P1`（含在 3.7 里）
  - 涉及文件：`server/src/modules/system/analysis.router.ts:11-12`
  - 备注：<空>

### 6.4 Dashboard 投资中心只算外汇净 PnL
- [ ] **3 个伪市场数据不在首页聚合**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 涉及文件：`client/src/pages/Dashboard.tsx:170-173`
  - 备注：<空>

### 6.5 文档自相矛盾
- [ ] **README:319 写 MySQL 8，DEVELOPMENT:71 写 SQLite better-sqlite3**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 备注：<空>

### 6.6 缺失必要文档
- [ ] **`说明文档.md` 缺失（user_rules 1.1 强制）**
  - 状态：`<待处理>`
  - 优先级：`P1`
  - 备注：<空>

- [ ] **CHANGELOG.md 缺失**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 备注：<空>

- [ ] **OpenAPI / API.md 缺失**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 备注：<空>

- [ ] **ADR（架构决策记录）缺失**
  - 状态：`<待处理>`
  - 优先级：`P3`
  - 备注：<空>

- [ ] **`index.html` 无 description/og/twitter meta**
  - 状态：`<待处理>`
  - 优先级：`P2`
  - 涉及文件：`client/index.html:1-45`
  - 备注：<空>

---

## 7. Top 5 应做但未做的 AI 场景（按 ROI 倒序）

| # | 场景 | ROI | 用户故事 | 涉及模块 | 估时 |
|---|---|---|---|---|---|
| 1 | 体检报告 OCR + 智能解读 | 9.5 | 上传 PDF → 自动拆 + 异常标注 + 复查建议 | `health/checkup` | 3 周 |
| 2 | 用药冲突 / 副作用预警 | 9.0 | 录「阿司匹林 + 华法林」自动弹「出血风险」 | `health/medication` | 2 周 |
| 3 | 财务砍单建议 | 8.5 | 每月 1 号 AI 复盘 + 砍 Spotify 建议 | `finance/finance-report` + `subscription` | 1 周 |
| 4 | 投资风控 | 8.0 | 连续 5 笔亏损自动暂停 24h | `investment/forex` | 1 周 |
| 5 | 通知聚合 | 7.5 | 12 条 todo 合并成 1 条晚 8 点日报 | `notifications/notification-center` | 3 天 |

---

## 8. 用户旅程断点（最高频痛点）

| 场景 | 痛点 | 建议 |
|---|---|---|
| 早上通勤 | 想查 Spotify 续费日，首页有卡片但没「点一下加日历」 | Dashboard 卡 + iCal 按钮 |
| 投资复盘 | 3 个市场是 localStorage，多设备必丢 | 见 6.1 |
| 记午饭 ¥18 | 不会自动写入财务月报 | 见 5.4 |
| 信用卡出账 | ¥8000 全手工重新录 | 见 5.3 |
| 晚上复盘 | 必须切 3 个 Tab 看「今日净热量/支出/浮亏」 | 新增 `/dashboard/today` |
| 睡前通知 | 通知中心是 admin 风格，用户没「收件箱」视图 | 新增 `notification-center/inbox` |

---

## 9. 跨模块联动 · Top 5

| Rank | 联动 | 价值 | 工作量 |
|---|---|---|---|
| 🥇 | 信用卡账单 → 5 模块自动分类 | 🔥🔥🔥 | M |
| 🥈 | 健身饮食 → 财务「生活成本」 | 🔥🔥 | M |
| 🥉 | 投资亏损 → 通知推送 | 🔥🔥 | S |
| 4 | 健身购物 → shopping 一键转 | 🔥 | S |
| 5 | todo → iCal 日历订阅 | 🔥 | S |

---

## 10. 商业化路径

| 阶段 | 动作 | 预计收益 |
|---|---|---|
| P0 留存 | 全量备份 + PWA + 数据导入向导 | 防流失、降低换工具成本 |
| P1 基础会员 | Free 100 次 AI/月 · Pro 1000 · Pro+ 无限 · DeepSeek 改 user-key | 付费转化 5-10% |
| P2 家庭共享 | household 实体 + 邀请码 + owner/member/kid 角色 | ARPU 2-3× |
| P3 增值服务 | AI 月度理财师 / 营养师周报 / 体检 OCR / 投资归因 | 高毛利护城河 |
| P4 平台化 | 模板市场 + 数据科学 API + 自托管版本 | 网络效应 |

---

## 11. 「如果只能做一件事」三选一

- 🥇 **全量备份 + iCal + PWA 三件套（4 周）**：保住数据 + 用最低成本「变产品」
- 🥈 **信用卡账单 AI 自动分类（2-3 周）**：消除最大记账痛点，对标 Money Pro
- 🥉 **测试体系 0→60% 覆盖率（4 周）**：商业化前的安全网

---

## 12. 实施建议顺序（按 ROI × 依赖关系）

1. **第 1 周**（P0 安全 + 性能）
   - 2.1 多租户越权修复
   - 2.3 加 @Index 复合索引
   - 6.6 创建 `说明文档.md`（user_rules 1.1）

2. **第 2-3 周**（P0 性能 + P1 错误码）
   - 2.2 全表 find 优化
   - 3.1 统一错误码 + API 响应契约

3. **第 4-5 周**（P1 性能 + 缓存）
   - 3.4 Section lazy + manualChunks
   - 3.5 React Query
   - 3.6 通知批量化
   - 3.10 缓存表加 TTL + cron

4. **第 6-7 周**（P1 JWT + AI 升级）
   - 3.2 JWT 强化
   - 3.7 analysis.router 漏埋点
   - 3.8 真实 token + 反注入
   - 3.9 llm-router.service

5. **第 8-10 周**（P1 拆分 + P2 跨模块）
   - 3.3 拆分超长 router
   - 4.1 可观测性
   - 4.2 跨模块抽象

6. **第 11+ 周**（P2 UI 一致性 + P3 商业化）
   - 4.3 - 4.11 UI 统一
   - 5.1 - 5.10 功能补全

---

## 13. 总评

> **现状**：LifeOS2 骨架扎实（基类、工厂、共享层、路由分层、通知中心、AI 助理），已能跑通个人生活一站式管理。
> **短板**：「最后 5% 的工程化纪律」—— 多租户边界 / 索引 / 错误码 / 缓存 / 测试 / 真实 token 估算。
> **机会**：跨模块联动（饮食→财务、信用卡→分类）和 AI 场景丰度（5 大模块各有 1 个高 ROI 场景待挖）。
> **建议**：先 4 周打掉 P0 安全 + 性能，再 4 周补 P1 错误码/JWT/缓存/AI 中台，6 个月内能完成「个人玩具 → 可付费产品」的跃迁。

---

> **本文件状态**：`<模板待修改>`
> **下次 review**：<空>
