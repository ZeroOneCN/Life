# LifeOS2 B端化改造方案

> 编制日期：2026-08-30
> 方案版本：v1.0
> 改造策略：渐进式引入 Arco Design + 自建组件保留

---

## 一、改造目标

将 LifeOS2 从个人工具提升为具备 B 端产品品质的系统，核心提升三大维度：

| 维度 | 目标 | 衡量标准 |
|------|------|---------|
| **视觉品质** | 统一的设计语言、规范的组件样式、专业的视觉反馈 | 组件风格一致、色彩体系规范、交互反馈统一 |
| **交互体验** | 流畅的操作反馈、高效的数据浏览、智能的辅助功能 | 键盘导航、统一校验、快捷操作、加载动画 |
| **B端能力** | 操作日志、权限管理、数据导出增强、通知中心完善 | 日志可追溯、权限可配置、数据可导出 |

---

## 二、改造路线图

### 总体计划

```
阶段一（第1周）      阶段二（第2周）      阶段三（第3周）      阶段四（第4周）
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ · 安装 Arco  │    │ · 替换 Modal │    │ · 替换 Form  │    │ · 替换 Menu │
│ · 替换 Button│──▶│ · 替换 Sel   │──▶│ · 替换 Field │──▶│ · 替换 Tabs │
│ · 替换 Toast │    │ · 替换 DP    │    │ · 替换验证   │    │ · 替换 Pag  │
│ · 配置主题   │    │ · 替换 Switch│    │              │    │              │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

阶段五（第5-6周）              阶段六（第7-8周）
┌────────────────────────┐    ┌────────────────────────┐
│ · 操作日志系统          │    │ · 设计 Token 统一       │
│ · 权限管理              │──▶│ · 暗色模式完善          │
│ · 导出增强              │    │ · 页面过渡动画          │
│ · 通知中心完善          │    │ · 响应式优化            │
└────────────────────────┘    └────────────────────────┘
```

---

## 三、阶段详情

### 阶段一：基础设施 + 基础组件替换（第1周）

**目标：** 引入 Arco Design 依赖，替换最常用的基础组件（Button/Toast/Select），快速见效。

**具体任务：**

| 任务 | 说明 | 涉及文件 | 工时 |
|------|------|---------|------|
| 1.1 安装依赖 | `@arco-design/web-react` + 按需加载插件 | package.json, vite.config.ts | 0.5h |
| 1.2 配置主题 | 设置品牌色/圆角/暗色模式 | App.tsx 或独立 theme 文件 | 1h |
| 1.3 替换 Btn | 将 Btn 组件底层改为 Arco Button，保持上层 API 不变 | ui.tsx | 2h |
| 1.4 替换 Toast | 将 Toast 底层改为 Arco Message，保持 API 兼容 | ui.tsx | 1h |
| 1.5 替换 SelectField | 将 SelectField 底层改为 Arco Select | ui.tsx | 2h |
| 1.6 类型检查 | 修复 TypeScript 错误 | 全局 | 1h |

**替换策略：** 不修改业务代码，仅在 ui.tsx 底层替换实现。所有业务组件通过 ui.tsx 引入，业务代码无需改动。

---

### 阶段二：交互组件替换（第2周）

**目标：** 替换 Modal/DatePicker/Switch/Pagination，提升交互体验。

**具体任务：**

| 任务 | 说明 | 涉及文件 | 工时 |
|------|------|---------|------|
| 2.1 替换 Modal | 底层改为 Arco Modal，保持 API 兼容 | ui.tsx | 2h |
| 2.2 替换 DatePicker | 引入 Arco DatePicker，统一日期选择体验 | 各业务页面 | 3h |
| 2.3 替换 Switch | 底层改为 Arco Switch | ui.tsx | 1h |
| 2.4 替换 Pagination | 底层改为 Arco Pagination | ui.tsx | 1h |
| 2.5 类型检查 | 修复 TypeScript 错误 | 全局 | 1h |

---

### 阶段三：表单体系替换（第3周）

**目标：** 引入 Arco Form，统一表单验证和提交逻辑。

**具体任务：**

| 任务 | 说明 | 涉及文件 | 工时 |
|------|------|---------|------|
| 3.1 替换 Field | 底层改为 Arco Form.Item | ui.tsx | 2h |
| 3.2 替换 TextArea | 底层改为 Arco TextArea | ui.tsx | 1h |
| 3.3 替换 Checkbox | 底层改为 Arco Checkbox | ui.tsx | 1h |
| 3.4 适配表单验证 | 将 useFormValidation 与 Arco Form 校验对接 | ui.tsx | 2h |
| 3.5 业务页面适配 | 各页面表单适配 Arco Form API | 各页面 | 4h |
| 3.6 类型检查 | 修复 TypeScript 错误 | 全局 | 1h |

---

### 阶段四：布局组件替换（第4周）

**目标：** 替换 Menu/Tabs，统一导航和标签切换体验。

**具体任务：**

| 任务 | 说明 | 涉及文件 | 工时 |
|------|------|---------|------|
| 4.1 替换 Tabs | 底层改为 Arco Tabs | ui.tsx 中 PillTabs | 2h |
| 4.2 替换 Menu | 侧边栏改为 Arco Menu | layout/MainLayout.tsx | 3h |
| 4.3 替换 Tag | 底层改为 Arco Tag | ui.tsx | 1h |
| 4.4 类型检查 | 修复 TypeScript 错误 | 全局 | 1h |

---

### 阶段五：B端功能补充（第5-6周）

**目标：** 补充 B 端产品必须的能力。

**具体任务：**

| 任务 | 说明 | 工时 |
|------|------|------|
| 5.1 操作日志系统 | 后端记录所有 CRUD 操作，前端日志查询页面 | 1周 |
| 5.2 权限管理 | 角色定义（admin/user/readonly），数据隔离 | 1周 |
| 5.3 导出增强 | 支持调度导出、自定义字段、大文件导出 | 2天 |
| 5.4 通知中心完善 | 通知模板配置、渠道管理 | 2天 |

---

### 阶段六：视觉规范统一（第7-8周）

**目标：** 统一设计 Token，完善暗色模式，增加过渡动画。

**具体任务：**

| 任务 | 说明 | 工时 |
|------|------|------|
| 6.1 设计 Token 统一 | 间距/字体/圆角/阴影规范 | 3天 |
| 6.2 暗色模式完善 | 全面审查所有页面 | 3天 |
| 6.3 页面过渡动画 | 路由切换动画、列表项入场 | 2天 |
| 6.4 响应式优化 | 平板/移动端适配 | 2天 |
| 6.5 CSS 清理 | 移除冗余样式，模块化拆分 | 2天 |

---

## 四、替换原则

### 4.1 底层替换 vs 业务层替换

**优先底层替换**：在 ui.tsx 中替换实现，不修改业务代码。

```
示例：Btn 组件的替换

// 替换前 (ui.tsx)
export function Btn({ tone, size, loading, ...props }) {
  return <button className={`btn btn-${tone} btn-${size} ${loading ? 'btn-loading' : ''}`} {...props} />;
}

// 替换后 (ui.tsx)
import { Button } from '@arco-design/web-react';
export function Btn({ tone, size, loading, ...props }) {
  const statusMap = { primary: 'primary', danger: 'danger', ... };
  return <Button type={statusMap[tone]} size={size} loading={loading} {...props} />;
}
```

### 4.2 保留的自建组件

以下组件因业务特殊性，保留自建：

| 组件 | 保留原因 |
|------|---------|
| DataTable | 已适配项目特有功能（列配置/导出联动） |
| FilterBar/FilterTag | 业务封装深度高 |
| ExportButton | 业务逻辑耦合 |
| TrendArrow | Arco 无对应 |
| useUndo/useFormKeyboardSubmit | 纯逻辑组件 |

### 4.3 关于 CSS

- 19,181 行自定义 CSS **不一次性删除**，随组件替换逐步移除
- 替换后的组件样式由 Arco 接管，可删除对应 CSS
- 最终保留纯业务布局 CSS（~40% 可保留）

---

## 五、进度记录

| 日期 | 阶段 | 完成内容 | 提交信息 |
|------|------|---------|---------|
| 2026-08-30 | 阶段一 | 安装 Arco Design + vite插件，配置 ConfigProvider 主题同步，替换 Btn/Toast/SelectField 三个组件 | commit 500d1fd ✅ |
| 2026-08-30 | 阶段二 | 替换 Modal/Switch/Pagination 组件（ui.tsx），修复 Modal width 类型错误 | 当前会话 ✅ |
| 2026-08-30 | 阶段二 | 替换 DatePicker/MonthPicker/DateTimePicker/DateRangePicker 组件（DateFields.tsx），移除 916 行自定义日历代码 | 当前会话 ✅ |
| 2026-08-30 | 阶段三 | 替换 Field/TextArea/Checkbox 组件底层为 Arco Input/Input.TextArea/Checkbox，适配 onChange 签名差异 | 当前会话 ✅ |
| 2026-08-30 | 阶段四 | 替换 PillTabs/Tag/Menu 为 Arco Tabs/Tag/Menu，侧边栏菜单支持 collapse/accordion/自动主题切换，移除 MenuNode 等 200+ 行自定义菜单代码 | 当前会话 ✅ |
| 2026-08-30 | 阶段五 | 补充B端功能：操作日志系统（后端 AuditLog 实体+中间件+查询API + 前端审计页面）、权限管理（用户角色字段+Admin 管理API + 前端用户管理页面）、登录/登出自动记录审计日志 | 当前会话 ✅ |

---

## 六、风险管理

| 风险 | 等级 | 应对 |
|------|------|------|
| Arco 组件样式与现有 CSS 冲突 | 中 | 使用 CSS 变量覆盖，加 scoped 样式 |
| 组件 API 不兼容导致业务代码报错 | 中 | 封装适配层，保持对外 API 不变 |
| 包体积膨胀 | 低 | 按需加载 + tree-shaking |
| 替换后视觉效果不一致 | 低 | 通过 DesignLab 统一主题配置 |