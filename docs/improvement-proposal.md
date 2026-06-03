# LifeOS2 项目改进与新增功能方案

> 基于项目现状全面扫描，按优先级分 6 大方向、共 20+ 个可执行项。

---

## 一、项目现状总览

| 维度 | 现状 |
|------|------|
| **技术栈** | React 18 + Vite 6 + TailwindCSS 4（前端） / Express + TypeORM + MySQL（后端） |
| **模块数** | 4 大中心 × 17 子模块 + Dashboard + 通知中心 + 设置页 |
| **已完成** | 健康(4)、财务(5)、生活(3)、投资-外汇(1)、通知、认证 |
| **占位页面** | 加密货币、港股、美股（仅外壳，无后端） |
| **测试** | ❌ 无任何测试框架或用例 |
| **PWA** | ❌ 无 Service Worker / 离线支持 |
| **国际化** | ❌ 全部中文硬编码 |
| **错误处理** | 部分有 try/catch，无全局 Error Boundary |

---

## 二、方向 A — 补齐缺失模块（高优先级）

### A1. 投资模块补全（Crypto / HKStock / USStock）

**现状**：导航栏已注册 3 个入口，但全部是 `ModulePlaceholderPage` 占位页，后端零实体/路由。

| 子模块 | 建议核心功能 | 后端实体预估 |
|--------|-------------|-------------|
| **加密市场** | 持仓记录、买入/卖出流水、盈亏统计、价格提醒通知 | `investment-crypto-holding`, `investment-crypto-trade`, `investment-crypto-setting` |
| **港股市场** | 自选股列表、持仓跟踪、财报日历提醒、除权除息记录 | `investment-hk-watchlist`, `investment-hk-position`, `investment-hk-setting` |
| **美股市场** | 同港股结构，适配美股交易时区与规则 | `investment-us-watchlist`, `investment-us-position`, `investment-us-setting` |

**复用模式**：直接参照 `forex` 模块结构（setting → trade record → capital flow → dashboard 聚合），三套代码结构高度一致。

**工作量估算**：每个子模块约 3-5 天（entity × 3~5 + router + 前端 page + sections × 4~6）

---

### A2. 全局搜索 / 快捷跳转

**痛点**：17 个子模块分散在 4 个一级菜单下，用户找功能需要逐层点开。

**方案**：
- 顶部搜索框（`Cmd/Ctrl + K` 唤起）
- 支持模糊匹配：模块名、最近访问的记录标题
- 结果分组显示：「前往 xxx 页面」+「最近相关记录」
- 跳转后自动定位到对应 Section

**技术要点**：
- 前端轻量搜索引擎（fuse.js 或自建 index）
- 记录索引可从各模块 service 层缓存中构建
- 键盘导航（↑↓ 选择，Enter 跳转）

---

## 三、方向 B — 数据智能与分析增强（中优先级）

### B1. 跨模块数据关联分析

**现状**：Dashboard 已做基础聚合（各模块最新记录数 + 待办/用药低库存等），但模块间无关联。

**可落地的关联场景**：

| 场景 | 描述 | 价值 |
|------|------|------|
| **消费→健康关联** | 购物记录中的运动装备/补剂 → 自动关联到健身减脂模块的消费趋势 | 发现消费习惯与健康目标的联系 |
| **财务健康评分** | 综合贷款还款率 + 订阅支出占比 + 储蓄率 → 生成月度财务健康分数 | 一眼看懂财务状况 |
| **作息规律分析** | 用药时间 + 步数活跃时段 → 推断日常作息是否规律 | 健康预警 |
| **存储→购物闭环** | 物品追踪中的"即将耗尽"标签 → 自动建议加入购物清单 | 减少遗漏采购 |

**实现方式**：在 `dashboard.router.ts` 新增聚合查询接口，后端跨表 JOIN 或应用层聚合。

---

### B2. AI 助手集成（基于现有 Analysis Router）

**现状**：已有 `analysis.router.ts` 接入 DeepSeek 做 AI 分析（外汇方向）。

**扩展方向**：
- **通用问答助手**：用户可针对任意模块数据提问（"我这个月花了多少？"、"我的步数趋势如何？"）
- **智能建议引擎**：基于多模块数据自动生成周报/月报摘要
- **异常检测**：支出突增、步数骤降、药品库存不足等自动标记并推送到通知中心

**技术路径**：
- 复用现有 DeepSeek 接入层
- 构建"上下文组装器"，根据问题类型抽取对应模块数据作为 prompt context
- 流式返回（SSE）提升体验

---

### B3. 数据导出与报表系统增强

**现状**：部分模块有 Excel 导出（exceljs），但格式不统一。

**统一化方案**：
- 封装通用 `ExportService`（支持 Excel / CSV / PDF 三种格式）
- 支持自定义字段选择和时间范围
- PDF 报表使用已有的 jspdf + html2canvas
- 增加「月度综合报表」：一键导出当月所有模块数据摘要

---

## 四、方向 C — 工程质量提升（基础设施）

### C1. 测试体系搭建

**现状**：零测试。

**分层策略**：

| 层级 | 工具 | 覆盖目标 |
|------|------|---------|
| **单元测试** | Vitest | 后端 service 工具函数、Zod schema 校验、前端 utils/hooks |
| **API 集成测试** | Vitest + supertest | 每个 router 的关键接口（CRUD + 边界情况） |
| **组件测试** | Vitest + @testing-library/react | 通用组件（SettingSwitchCard、DateFields、page shell） |
| **E2E** | Playwright（可选） | 核心流程：登录 → Dashboard → 模块操作 → 登出 |

**起步建议**：先从后端 Zod 校验和工具函数开始（投入产出比最高），逐步覆盖 router。

---

### C2. 前端全局错误边界

**现状**：各页面散落 try/catch，无统一错误展示机制。

**方案**：
```
ErrorBoundary (React Component)
  ├── 捕获渲染异常 → 显示友好降级 UI
  ├── 区分错误类型：网络错误 / 权限错误 / 未知错误
  └── 提供「重试」「返回首页」操作
```
同时配合 Axios 拦截器统一处理 HTTP 错误码（401 跳登录、403 提示无权限、500 显示服务器错误）。

---

### C3. TypeScript 类型安全加固

**现状**：前后端均有 TS，但部分地方用了 `any` 或断言。

**重点检查项**：
- 后端 router 的 `req.body` 类型是否完全由 Zod schema 驱动（而非手动断言）
- 前端 API 调用的返回值类型是否与后端 response 结构对齐
- 移除 `as any`，补充缺失的类型定义

---

### C4. API 版本化管理

**现状**：所有路由直接挂在 `/api/xxx` 下，无版本前缀。

**方案**：引入 `/api/v1/` 前缀，为未来不兼容变更预留空间。配合 Swagger/OpenAPI 文档自动生成。

---

## 五、方向 D — 用户体验深化

### D1. PWA 渐进式 Web 应用

**价值**：支持桌面安装、离线缓存、推送通知。

**实施内容**：
- `manifest.json`（应用名、图标、主题色、display: standalone）
- Service Worker 缓存策略（静态资源 CacheFirst + API NetworkFirst）
- 安装引导横幅（符合 PWA 安装标准）
- 离线时的骨架屏/占位提示

**依赖**：vite-plugin-pwa（基于 Workbox）

---

### D2. 暗色/亮色主题完善

**现状**：api-debugger.html 有日间/夜间切换，但主应用的主题系统需确认。

**方案**：
- CSS 变量双套定义（`:root` / `[data-theme="dark"]`）
- 系统偏好跟随（`prefers-color-scheme`）
- 手动切换开关 + localStorage 持久化
- 过渡动画（theme 切换时不闪烁）

> 注：DESIGN.md 已定义完整的暗色色板，可直接复用。

---

### D3. 操作撤销 / 重做（Undo/Redo）

**适用场景**：误删记录、误改设置。

**方案**：
- 关键操作（删除、批量修改）后显示 Toast 提示「已删除 · 撤销」
- Undo 栈维护在内存中（session 级别）
- 可选：重要操作记录到数据库的操作日志表

---

### D4. 批量操作增强

**现状**：各模块以单条 CRUD 为主。

**增强方向**：
- 表格支持多选（checkbox 列）
- 批量删除 / 批量修改状态 / 批量打标签
- 拖拽排序（待办事项、物品分类等）
- Excel 批量导入模板下载（部分模块已有，需统一化）

---

## 六、方向 E — 运维与部署

### E1. Docker 容器化部署

**现状**：未见 docker-compose 或 Dockerfile。

**方案**：
```yaml
# docker-compose.yml
services:
  mysql:    image: mysql:8.0
  server:   build: ./server    ports: ["3100:3100"]    depends_on: [mysql]
  client:   build: ./client    ports: ["5173:5173"]
```

一键启动开发环境 + 生产环境 Nginx 反向代理配置。

---

### E2. CI/CD 流水线

**建议平台**：GitHub Actions（项目已在 GitHub）

**流水线阶段**：
1. **Lint**（ESLint + prettier）
2. **TypeCheck**（tsc --noEmit 前后端分别跑）
3. **Test**（Vitest 单元 + 集成）
4. **Build**（vite build + tsc build server）
5. **Deploy**（push to server / Docker image push）

---

### E3. 数据库迁移版本管理

**现状**：TypeORM migration 目录基本为空（只有 1 个 seed 文件）。

**建议**：
- 每次 entity 变更必须生成对应 migration 文件
- migration 文件纳入 Git 版本管理
- 生产环境部署前先执行 `migration:run`

---

## 七、方向 F — 安全加固

### F1. 安全 Checklist

| 项目 | 现状评估 | 建议 |
|------|---------|------|
| **密码哈希** | ✅ bcrypt | 保持，定期调整 cost factor |
| **JWT** | ✅ access + refresh 双 token | 检查 refresh token 轮换逻辑 |
| **CORS** | ✅ cors 中间件 | 限制允许域名，不用通配符 |
| **Helmet** | ✅ 已引入 | 确认安全头配置完整 |
| **Rate Limiting** | ⚠️ 未明确看到 | 建议添加 express-rate-limit |
| **SQL 注入** | ✅ TypeORM 参数化 | 保持 |
| **XSS 防护** | ⚠️ React 自动转义但需确认 dangerouslySetInnerHTML 使用 | 审计 |
| **输入校验** | ✅ Zod 全局使用 | 保持 |
| **敏感信息** | ⚠️ .env 是否在 .gitignore | 确认 |

---

## 八、优先级矩阵总结

```
优先级        方向              收益                  投入
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 P0 必做   A1 投资模块补全    消除占位页，功能完整  中（3个子模块×5天）
🔴 P0 必做   C2 全局错误边界    提升稳定性，用户体验好  小（1-2天）
🟡 P1 重要   B1 跨模块关联分析   产品差异化核心竞争力   大（需设计+后端聚合）
🟡 P1 重要   C1 测试体系搭建     工程质量保障           中（持续投入）
🟡 P1 重要   A2 全局搜索/快捷键  操作效率大幅提升       中（2-3天）
🟢 P2 改进   D1 PWA             可安装性+离线体验      小（1天）
🟢 P2 改进   D2 主题切换完善     视觉体验               小（1-2天）
🟢 P2 改进   B2 AI 助手扩展     智能化升级             中大（需 prompt 工程）
🟢 P2 改进   F1 安全加固         合规与防护             小（1天）
⚪ P3 远期   E1/E2/E3 运维部署   团队协作/生产环境      中
⚪ P3 远期   D3/D4 撤销/批量操作  交互便利性            中
⚪ P3 远期   C3/C4 TS加固/API版本 长期可维护性          中
```

---

## 九、建议执行顺序

| 阶段 | 内容 | 预计周期 |
|------|------|---------|
| **第一阶段** | A1 投资模块补全（Crypto 先行 → HKStock → USStock） | 2 周 |
| **第二阶段** | C2 错误边界 + F1 安全加固 + A2 全局搜索 | 1 周 |
| **第三阶段** | C1 测试体系（核心路径覆盖）+ D1 PWA + D2 主题 | 1 周 |
| **第四阶段** | B1 跨模块数据分析 + B3 统一导出 | 2 周 |
| **第五阶段** | B2 AI 助手 + D3/D4 高级交互 | 持续迭代 |
| **第六阶段** | E1/E2/E3 运维工程化 | 按需 |

---

*文档生成时间：2026-06-02*
