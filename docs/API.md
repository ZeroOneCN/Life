# LifeOS API 接口文档

## 1. API 总览

### 1.1 基础规范

- **基础路径**: 所有 API 接口均以 `/api` 为前缀
- **请求方式**: RESTful 风格（GET / POST / PATCH / DELETE）
- **数据格式**: JSON
- **字符编码**: UTF-8
- **时间格式**: ISO 8601（如 `2024-01-01T00:00:00.000Z`），日期格式为 `YYYY-MM-DD`

### 1.2 认证方式

系统使用 **JWT (JSON Web Token)** 进行身份认证。

#### 获取 Token

通过登录接口 (`POST /api/auth/login`) 获取访问令牌（accessToken）和刷新令牌（refreshToken）。

#### 使用 Token

在需要认证的接口请求头中添加：

```
Authorization: Bearer <accessToken>
```

#### Token 刷新

当 accessToken 过期后，使用 refreshToken 调用刷新接口获取新的 accessToken。

### 1.3 统一响应格式

所有接口返回统一的 JSON 格式：

```json
{
  "success": true,
  "code": "success_code",
  "message": "操作成功",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 请求是否成功 |
| code | string | 业务状态码 |
| message | string | 响应消息 |
| data | any | 响应数据 |

### 1.4 错误码

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | invalid_request | 请求参数错误 |
| 401 | unauthorized | 未授权 |
| 401 | invalid_credentials | 用户名或密码错误 |
| 401 | invalid_refresh_token | 刷新令牌无效 |
| 403 | registration_closed | 注册已关闭 |
| 404 | resource_not_found | 资源不存在 |
| 409 | account_already_exists | 账号已存在 |
| 409 | utility_bill_duplicate_month | 月度账单重复 |
| 500 | internal_error | 服务器内部错误 |
| 503 | database_not_ready | 数据库未就绪 |

### 1.5 分页参数

列表接口支持分页查询，统一使用以下查询参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 当前页码 |
| pageSize | number | 10 | 每页条数 |

分页响应格式：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "total": 100,
  "totalPages": 10
}
```

---

## 2. 认证模块 API

**基础路径**: `/api/auth`

### 2.1 用户注册

- **路径**: `POST /api/auth/register`
- **权限**: 公开（仅首个用户可注册）
- **描述**: 注册新用户账号（系统初始化后仅允许注册一个用户）

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名（3-64字符） |
| email | string | 是 | 邮箱地址 |
| password | string | 是 | 密码（8-128字符） |
| nickname | string | 否 | 昵称 |

**响应结构**:

```json
{
  "success": true,
  "code": "register_success",
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string"
  }
}
```

### 2.2 用户登录

- **路径**: `POST /api/auth/login`
- **权限**: 公开
- **描述**: 用户登录，获取访问令牌

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**响应结构**:

```json
{
  "success": true,
  "code": "login_success",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "nickname": "string",
      "avatarUrl": "string",
      "timezone": "string"
    }
  }
}
```

### 2.3 刷新令牌

- **路径**: `POST /api/auth/refresh`
- **权限**: 公开
- **描述**: 使用刷新令牌获取新的访问令牌

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | 刷新令牌 |

**响应结构**:

```json
{
  "success": true,
  "code": "refresh_success",
  "data": {
    "accessToken": "string"
  }
}
```

### 2.4 用户登出

- **路径**: `POST /api/auth/logout`
- **权限**: 需要登录
- **描述**: 撤销当前用户的所有会话令牌

**响应结构**:

```json
{
  "success": true,
  "code": "logout_success",
  "data": {
    "ok": true
  }
}
```

### 2.5 获取当前用户信息

- **路径**: `GET /api/auth/me`
- **权限**: 需要登录
- **描述**: 获取当前登录用户的详细信息

**响应结构**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "avatarUrl": "string",
    "timezone": "string"
  }
}
```

### 2.6 更新用户资料

- **路径**: `PATCH /api/auth/profile`
- **权限**: 需要登录
- **描述**: 更新当前用户的个人资料

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| nickname | string | 是 | 昵称 |
| timezone | string | 是 | 时区 |
| avatarUrl | string | 否 | 头像 URL |

**响应结构**:

```json
{
  "success": true,
  "code": "update_profile_success",
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "nickname": "string",
    "avatarUrl": "string",
    "timezone": "string"
  }
}
```

### 2.7 修改密码

- **路径**: `POST /api/auth/change-password`
- **权限**: 需要登录
- **描述**: 修改当前用户的登录密码

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| currentPassword | string | 是 | 当前密码 |
| newPassword | string | 是 | 新密码（8-128字符） |
| confirmPassword | string | 是 | 确认新密码 |

**响应结构**:

```json
{
  "success": true,
  "code": "change_password_success",
  "data": {
    "ok": true
  }
}
```

---

## 3. 健康中心 API

### 3.1 步数模块

**基础路径**: `/api/health/step`
**权限**: 需要登录

#### 3.1.1 获取步数记录列表

- **路径**: `GET /api/health/step/records`
- **描述**: 分页查询步数记录

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页条数，默认10 |
| date | string | 否 | 按日期筛选（YYYY-MM-DD） |

**响应结构**: 分页列表，每条记录包含 id、userId、recordTime、steps、source、note、createdAt、updatedAt

#### 3.1.2 新增步数记录

- **路径**: `POST /api/health/step/records`
- **描述**: 创建一条新的步数记录

**请求参数**: recordTime、steps、source、note

#### 3.1.3 更新步数记录

- **路径**: `PATCH /api/health/step/records/:id`
- **描述**: 更新指定步数记录

#### 3.1.4 删除步数记录

- **路径**: `DELETE /api/health/step/records/:id`
- **描述**: 删除指定步数记录

#### 3.1.5 获取步数统计概览

- **路径**: `GET /api/health/step/summary`
- **描述**: 获取今日、本周、本月步数统计

#### 3.1.6 获取步数趋势

- **路径**: `GET /api/health/step/trend`
- **描述**: 获取步数趋势数据（按天）

**查询参数**: days（天数，默认7天）

#### 3.1.7 获取步数设置

- **路径**: `GET /api/health/step/settings`
- **描述**: 获取步数模块用户设置

#### 3.1.8 更新步数设置

- **路径**: `PATCH /api/health/step/settings`
- **描述**: 更新步数模块用户设置

### 3.2 健身模块

**基础路径**: `/api/health/fitness`
**权限**: 需要登录

#### 3.2.1 饮食记录

- **列表**: `GET /api/health/fitness/diet-records`
- **新增**: `POST /api/health/fitness/diet-records`
- **更新**: `PATCH /api/health/fitness/diet-records/:id`
- **删除**: `DELETE /api/health/fitness/diet-records/:id`

**字段**: date、mealType、foodName、calories、protein、carbs、fat、note

#### 3.2.2 运动记录

- **列表**: `GET /api/health/fitness/exercise-records`
- **新增**: `POST /api/health/fitness/exercise-records`
- **更新**: `PATCH /api/health/fitness/exercise-records/:id`
- **删除**: `DELETE /api/health/fitness/exercise-records/:id`

**字段**: date、exerciseType、durationMinutes、calories、intensity、note

#### 3.2.3 体重记录

- **列表**: `GET /api/health/fitness/weight-records`
- **新增**: `POST /api/health/fitness/weight-records`
- **更新**: `PATCH /api/health/fitness/weight-records/:id`
- **删除**: `DELETE /api/health/fitness/weight-records/:id`

**字段**: date、weight、bodyFat、muscleMass、note

#### 3.2.4 购物记录

- **列表**: `GET /api/health/fitness/shopping-records`
- **新增**: `POST /api/health/fitness/shopping-records`
- **更新**: `PATCH /api/health/fitness/shopping-records/:id`
- **删除**: `DELETE /api/health/fitness/shopping-records/:id`

#### 3.2.5 AI 营养建议

- **路径**: `POST /api/health/fitness/ai/nutrition-advice`
- **描述**: 使用 AI 生成营养建议

#### 3.2.6 AI 运动建议

- **路径**: `POST /api/health/fitness/ai/exercise-advice`
- **描述**: 使用 AI 生成运动建议

#### 3.2.7 获取健身概览

- **路径**: `GET /api/health/fitness/overview`
- **描述**: 获取健身模块统计概览

#### 3.2.8 获取设置

- **路径**: `GET /api/health/fitness/settings`
- **更新**: `PATCH /api/health/fitness/settings`

### 3.3 用药模块

**基础路径**: `/api/health/medication`
**权限**: 需要登录

#### 3.3.1 用药记录

- **列表**: `GET /api/health/medication/records`
- **新增**: `POST /api/health/medication/records`
- **更新**: `PATCH /api/health/medication/records/:id`
- **删除**: `DELETE /api/health/medication/records/:id`

**字段**: date、medicineName、specification、breakfast、lunch、dinner、beforeSleep、note

#### 3.3.2 购药记录

- **列表**: `GET /api/health/medication/purchases`
- **新增**: `POST /api/health/medication/purchases`
- **更新**: `PATCH /api/health/medication/purchases/:id`
- **删除**: `DELETE /api/health/medication/purchases/:id`

**字段**: date、medicineName、specification、quantity、unit、price、pharmacy、note

#### 3.3.3 库存阈值

- **列表**: `GET /api/health/medication/thresholds`
- **新增**: `POST /api/health/medication/thresholds`
- **更新**: `PATCH /api/health/medication/thresholds/:id`
- **删除**: `DELETE /api/health/medication/thresholds/:id`

#### 3.3.4 获取用药概览

- **路径**: `GET /api/health/medication/overview`
- **描述**: 获取用药统计概览和库存提醒

#### 3.3.5 获取库存提醒

- **路径**: `GET /api/health/medication/low-stock`
- **描述**: 获取低于库存阈值的药品列表

#### 3.3.6 获取设置

- **路径**: `GET /api/health/medication/settings`
- **更新**: `PATCH /api/health/medication/settings`

#### 3.3.7 触发提醒

- **路径**: `POST /api/health/medication/actions/trigger-reminders`
- **描述**: 手动触发用药提醒通知

### 3.4 体检模块

**基础路径**: `/api/health/checkup`
**权限**: 需要登录

#### 3.4.1 体检记录

- **列表**: `GET /api/health/checkup/records`
- **新增**: `POST /api/health/checkup/records`
- **更新**: `PATCH /api/health/checkup/records/:id`
- **删除**: `DELETE /api/health/checkup/records/:id`

**字段**: checkupDate、hospital、testName、testItem、resultValue、referenceRange、unit、status、followUpDate、note

#### 3.4.2 体检模板

- **列表**: `GET /api/health/checkup/templates`
- **新增**: `POST /api/health/checkup/templates`
- **更新**: `PATCH /api/health/checkup/templates/:id`
- **删除**: `DELETE /api/health/checkup/templates/:id`

#### 3.4.3 获取体检概览

- **路径**: `GET /api/health/checkup/overview`
- **描述**: 获取体检统计概览

#### 3.4.4 获取复查提醒

- **路径**: `GET /api/health/checkup/follow-up-reminders`
- **描述**: 获取待复查项目列表

#### 3.4.5 获取设置

- **路径**: `GET /api/health/checkup/settings`
- **更新**: `PATCH /api/health/checkup/settings`

---

## 4. 财务中心 API

### 4.1 购物模块

**基础路径**: `/api/finance/shopping`
**权限**: 需要登录

#### 4.1.1 购物记录

- **列表**: `GET /api/finance/shopping/records`
- **新增**: `POST /api/finance/shopping/records`
- **更新**: `PATCH /api/finance/shopping/records/:id`
- **删除**: `DELETE /api/finance/shopping/records/:id`

**字段**: userId、ledgerId、date、platform、itemName、spec、price、unitPrice、orderNo、note

**查询参数**: userId、ledgerId（默认all）、keyword、page、pageSize

#### 4.1.2 购物账本

- **列表**: `GET /api/finance/shopping/ledgers`
- **新增**: `POST /api/finance/shopping/ledgers`
- **更新**: `PATCH /api/finance/shopping/ledgers/:id`
- **删除**: `DELETE /api/finance/shopping/ledgers/:id`

**字段**: name、description、startDate、endDate、isActive

#### 4.1.3 购物平台

- **列表**: `GET /api/finance/shopping/platforms`
- **新增**: `POST /api/finance/shopping/platforms`
- **更新**: `PATCH /api/finance/shopping/platforms/:id`
- **删除**: `DELETE /api/finance/shopping/platforms/:id`

**字段**: name、colorToken、isBuiltIn

#### 4.1.4 获取购物概览

- **路径**: `GET /api/finance/shopping/overview`
- **描述**: 获取本月订单数、本月金额、总金额、总订单数、活跃平台数、追踪月数

**查询参数**: userId、ledgerId

#### 4.1.5 获取月度趋势

- **路径**: `GET /api/finance/shopping/monthly-trend`
- **描述**: 获取近12个月购物趋势

**查询参数**: userId、ledgerId

#### 4.1.6 获取平台分布

- **路径**: `GET /api/finance/shopping/platform-breakdown`
- **描述**: 获取按平台统计的消费分布

**查询参数**: userId、ledgerId

#### 4.1.7 获取账本汇总

- **路径**: `GET /api/finance/shopping/ledger-summary`
- **描述**: 获取各账本消费汇总

**查询参数**: userId

#### 4.1.8 购物设置

- **获取**: `GET /api/finance/shopping/settings`
- **更新**: `PATCH /api/finance/shopping/settings`

**字段**: activeUserId、recordsUserId、dashboardUserId、activeLedgerId、recordsLedgerId、dashboardLedgerId、currencyMode、usdtRate

#### 4.1.9 导入购物记录

- **路径**: `POST /api/finance/shopping/actions/import`
- **描述**: 批量导入购物记录

**请求参数**: fileName、rows[]

### 4.2 旅行模块

**基础路径**: `/api/finance/travel`
**权限**: 需要登录

#### 4.2.1 旅行账本

- **列表**: `GET /api/finance/travel/books`
- **新增**: `POST /api/finance/travel/books`
- **更新**: `PATCH /api/finance/travel/books/:id`
- **删除**: `DELETE /api/finance/travel/books/:id`

**字段**: userId、name、description、startDate、endDate、summary、status、currency、budget

**状态枚举**: planning（规划中）、ongoing（进行中）、completed（已完成）、archived（已归档）

#### 4.2.2 完成旅行

- **路径**: `POST /api/finance/travel/books/:id/complete`
- **描述**: 标记旅行为已完成状态

#### 4.2.3 归档旅行

- **路径**: `POST /api/finance/travel/books/:id/archive`
- **描述**: 归档旅行账本

#### 4.2.4 归档建议

- **路径**: `GET /api/finance/travel/archive/suggestions`
- **描述**: 获取可归档的旅行建议（结束超过30天的）

#### 4.2.5 旅行消费记录

- **列表**: `GET /api/finance/travel/records`
- **新增**: `POST /api/finance/travel/records`
- **更新**: `PATCH /api/finance/travel/records/:id`
- **删除**: `DELETE /api/finance/travel/records/:id`

**字段**: userId、bookId、date、timeStart、timeEnd、category、title、amount、discountAmount、discountNote、vehicleInfo、payChannel、remark、durationMinutes

**分类**: transport（交通）、hotel（住宿）、food（餐饮）、ticket（门票）、shopping（购物）、other（其他）

#### 4.2.6 支付渠道

- **列表**: `GET /api/finance/travel/pay-channels`
- **新增**: `POST /api/finance/travel/pay-channels`
- **更新**: `PATCH /api/finance/travel/pay-channels/:id`
- **删除**: `DELETE /api/finance/travel/pay-channels/:id`

**字段**: value、label

#### 4.2.7 获取消费汇总

- **路径**: `GET /api/finance/travel/summary`
- **描述**: 获取消费汇总统计

**查询参数**: userId、bookId

#### 4.2.8 获取每日趋势

- **路径**: `GET /api/finance/travel/daily-trend`
- **描述**: 获取按日统计的消费趋势

#### 4.2.9 获取分类分布

- **路径**: `GET /api/finance/travel/category-breakdown`
- **描述**: 获取按消费分类的分布

#### 4.2.10 获取支付渠道分布

- **路径**: `GET /api/finance/travel/pay-channel-breakdown`
- **描述**: 获取按支付渠道的分布

#### 4.2.11 消费排行榜

- **路径**: `GET /api/finance/travel/leaderboard`
- **描述**: 各旅行账本消费排行榜

#### 4.2.12 旅行报告

- **路径**: `GET /api/finance/travel/report`
- **描述**: 获取指定旅行账本的完整报告

**查询参数**: userId、bookId

#### 4.2.13 旅行设置

- **获取**: `GET /api/finance/travel/settings`
- **更新**: `PATCH /api/finance/travel/settings`

**字段**: activeUserId、activeBookId、detailsBookId、statsBookId、reportBookId、leaderboardUserId、reportColumns

#### 4.2.14 导入旅行记录

- **路径**: `POST /api/finance/travel/actions/import`
- **描述**: 批量导入旅行消费记录

#### 4.2.15 导出旅行报告

- **路径**: `POST /api/finance/travel/actions/export-report`
- **描述**: 导出旅行报告（JSON/HTML格式）

**请求参数**: userId、bookId、format（json/html）

### 4.3 贷款模块

**基础路径**: `/api/finance/loan`
**权限**: 需要登录

#### 4.3.1 贷款平台

- **列表**: `GET /api/finance/loan/platforms`
- **新增**: `POST /api/finance/loan/platforms`
- **更新**: `PATCH /api/finance/loan/platforms/:id`
- **删除**: `DELETE /api/finance/loan/platforms/:id`

**字段**: name、billingDay、repaymentDay、creditLimit

#### 4.3.2 贷款账单

- **列表**: `GET /api/finance/loan/bills`
- **新增**: `POST /api/finance/loan/bills`
- **更新**: `PATCH /api/finance/loan/bills/:id`
- **删除**: `DELETE /api/finance/loan/bills/:id`

**字段**: platformId、platformName、amount、interest、billingMonth、dueDate、notes、isPaid、paidAt

**查询参数**: platformId、status（paid/unpaid/overdue）、billingMonth、dueStartDate、dueEndDate、keyword

#### 4.3.3 还款记录

- **列表**: `GET /api/finance/loan/repayments`
- **新增**: `POST /api/finance/loan/repayments`
- **更新**: `PATCH /api/finance/loan/repayments/:id`
- **删除**: `DELETE /api/finance/loan/repayments/:id`

**字段**: billId、platformId、platformName、amount、interest、repaymentDate、notes

**查询参数**: platformId、repaymentStartDate、repaymentEndDate、keyword

#### 4.3.4 获取贷款概览

- **路径**: `GET /api/finance/loan/overview`
- **描述**: 获取贷款总览（总负债、已还金额、未还金额、利息、待还/逾期数）

#### 4.3.5 获取月度统计

- **路径**: `GET /api/finance/loan/monthly-stats`
- **描述**: 获取指定月份的贷款统计

**查询参数**: month（YYYY-MM）、platformId

#### 4.3.6 获取还款趋势

- **路径**: `GET /api/finance/loan/repayment-trend`
- **描述**: 获取还款趋势数据

**查询参数**: startDate、endDate、platformId

#### 4.3.7 获取平台分布

- **路径**: `GET /api/finance/loan/platform-breakdown`
- **描述**: 获取按贷款平台的统计分布

#### 4.3.8 贷款设置

- **获取**: `GET /api/finance/loan/settings`
- **更新**: `PATCH /api/finance/loan/settings`

**字段**: repaymentReminderEnabled、overdueReminderEnabled、autoRepaymentOnMarkPaid、notificationFrequency（daily/always）、upcomingDays

#### 4.3.9 标记账单已还

- **路径**: `POST /api/finance/loan/actions/mark-bill-paid`
- **描述**: 标记账单为已还状态，可自动生成还款记录

**请求参数**: billId

#### 4.3.10 触发还款提醒

- **路径**: `POST /api/finance/loan/actions/trigger-reminders`
- **描述**: 手动触发贷款还款/逾期提醒通知

**请求参数**: title（可选）

### 4.4 订阅模块

**基础路径**: `/api/finance/subscription`
**权限**: 需要登录

#### 4.4.1 订阅记录

- **列表**: `GET /api/finance/subscription/records`
- **新增**: `POST /api/finance/subscription/records`
- **更新**: `PATCH /api/finance/subscription/records/:id`
- **删除**: `DELETE /api/finance/subscription/records/:id`

**字段**: serviceName、planName、categoryId、categoryName、startDate、endDate、billingCycle、cyclePrice、autoRenew、notes

**计费周期**: monthly（月付）、quarterly（季付）、yearly（年付）、one_time（一次性）

**查询参数**: keyword、categoryId、status（all/active/upcoming/expired）、autoRenew（all/auto/manual）、expiryStartDate、expiryEndDate

#### 4.4.2 订阅分类

- **列表**: `GET /api/finance/subscription/categories`
- **新增**: `POST /api/finance/subscription/categories`
- **更新**: `PATCH /api/finance/subscription/categories/:id`
- **删除**: `DELETE /api/finance/subscription/categories/:id`

**字段**: name、description

#### 4.4.3 获取订阅概览

- **路径**: `GET /api/finance/subscription/overview`
- **描述**: 获取订阅统计概览（总数、活跃、即将到期、已过期、自动续费数、月度/年度估算）

#### 4.4.4 获取分类分布

- **路径**: `GET /api/finance/subscription/category-breakdown`
- **描述**: 获取按分类统计的订阅费用分布（不含已过期）

#### 4.4.5 获取到期时间线

- **路径**: `GET /api/finance/subscription/expiry-timeline`
- **描述**: 获取未来到期订阅时间线（默认90天内）

#### 4.4.6 订阅设置

- **获取**: `GET /api/finance/subscription/settings`
- **更新**: `PATCH /api/finance/subscription/settings`

**字段**: recordsKeyword、recordsCategoryId、recordsStatus、recordsAutoRenewFilter、recordsExpiryStartDate、recordsExpiryEndDate、dashboardRangeDays、reminderEnabled、expiryDayReminderEnabled、leadDays、includeAutoRenewInReminders

#### 4.4.7 获取提醒列表

- **路径**: `GET /api/finance/subscription/reminders`
- **描述**: 获取当前订阅到期提醒列表

#### 4.4.8 触发订阅提醒

- **路径**: `POST /api/finance/subscription/actions/trigger-reminders`
- **描述**: 手动触发订阅到期提醒通知

**请求参数**: title（可选）

### 4.5 房租模块

**基础路径**: `/api/finance/rent`
**权限**: 需要登录

#### 4.5.1 住房记录

- **列表**: `GET /api/finance/rent/records`
- **新增**: `POST /api/finance/rent/records`
- **更新**: `PATCH /api/finance/rent/records/:id`
- **删除**: `DELETE /api/finance/rent/records/:id`

**字段**: userId、address、addressShort、channelId、channelName、moveInDate、moveOutDate、rent、deposit、electricityFee、waterFee、gasFee、agencyFee、cleaningFee、laundryFee、serviceFee、orientation、notes

**派生字段**: stayDays、totalCost、dailyCost、monthlyRent、quarterlyRent、occupancyStatus（active/ended）

**查询参数**: userId、keyword、channelId、occupancy（all/active/ended）、page、pageSize

#### 4.5.2 租房渠道

- **列表**: `GET /api/finance/rent/channels`
- **新增**: `POST /api/finance/rent/channels`
- **更新**: `PATCH /api/finance/rent/channels/:id`
- **删除**: `DELETE /api/finance/rent/channels/:id`

**字段**: userId、name

#### 4.5.3 获取租房概览

- **路径**: `GET /api/finance/rent/overview`
- **描述**: 获取租房统计概览

#### 4.5.4 获取费用分布

- **路径**: `GET /api/finance/rent/cost-breakdown`
- **描述**: 获取各项费用占比分布（房租、电费、水费、燃气费、中介费、保洁费、洗衣费、服务费）

#### 4.5.5 获取渠道分布

- **路径**: `GET /api/finance/rent/channel-breakdown`
- **描述**: 获取按租房渠道的分布统计

#### 4.5.6 租房设置

- **获取**: `GET /api/finance/rent/settings`
- **更新**: `PATCH /api/finance/rent/settings`

**字段**: activeUserId、recordsUserId、statisticsUserId、editingRecordId

#### 4.5.7 月度水电燃气账单

**注意：水电燃气费用通过月度账单单独记录，不再在住房记录中存总额**

- **列表**: `GET /api/finance/rent/utility-bills`
- **新增**: `POST /api/finance/rent/utility-bills`
- **更新**: `PATCH /api/finance/rent/utility-bills/:id`
- **删除**: `DELETE /api/finance/rent/utility-bills/:id`

**字段**: recordId、yearMonth（YYYY-MM）、electricityFee、waterFee、gasFee

**查询参数**: recordId（可选，不传返回全部）

### 4.6 财务报告模块

**基础路径**: `/api/finance/report`
**权限**: 需要登录

#### 4.6.1 月度财务报告

- **路径**: `GET /api/finance/report/monthly`
- **描述**: 生成月度财务综合报告

**查询参数**: month（YYYY-MM，默认当月）

**响应结构**:
- month: 报告月份
- startDate / endDate: 月份起止日期
- totalExpense: 总支出
- previousMonthExpense: 上月总支出
- monthOverMonthChange: 环比变化金额
- monthOverMonthChangePercent: 环比变化百分比
- lastYearSameMonthExpense: 去年同月支出
- yearOverYearChange: 同比变化金额
- yearOverYearChangePercent: 同比变化百分比
- moduleBreakdown: 各模块支出分布（shopping/travel/loan/subscription/rent）
- categoryBreakdown: 分类支出分布（Top 12）
- topExpenses: Top 3 支出项
- generatedAt: 生成时间

#### 4.6.2 年度财务报告

- **路径**: `GET /api/finance/report/yearly`
- **描述**: 生成年度财务报告

**查询参数**: year（年份，默认当年）

#### 4.6.3 推送月度报告

- **路径**: `POST /api/finance/report/notify`
- **描述**: 生成月度报告并通过通知渠道推送

**请求参数**: month（可选）、title（可选）

---

### 4.7 汇率模块

**基础路径**: `/api/finance/exchange-rate`
**权限**: 需要登录

#### 4.7.1 获取最新汇率

- **路径**: `GET /api/finance/exchange-rate/latest`
- **描述**: 获取指定基准货币的最新汇率

**查询参数**:
- base: 基准货币（默认 USD）
- symbols: 目标货币列表，逗号分隔（可选）

**响应结构**:
- base: 基准货币
- rates: 汇率对象（货币代码 -> 汇率）
- source: 数据来源（exchangerate-api / fallback）
- fetchedAt: 获取时间

#### 4.7.2 货币换算

- **路径**: `GET /api/finance/exchange-rate/convert`
- **描述**: 进行货币换算

**查询参数**:
- from: 源货币（默认 USD）
- to: 目标货币（默认 CNY）
- amount: 金额（默认 1）

**响应结构**:
- from: 源货币
- to: 目标货币
- rate: 汇率
- amount: 原始金额
- converted: 换算后金额
- source: 数据来源
- fetchedAt: 获取时间

---

## 5. 生活中心 API

### 5.1 待办模块

**基础路径**: `/api/life/todo`
**权限**: 需要登录

#### 5.1.1 待办任务

- **列表**: `GET /api/life/todo/tasks`
- **新增**: `POST /api/life/todo/tasks`
- **更新**: `PATCH /api/life/todo/tasks/:id`
- **删除**: `DELETE /api/life/todo/tasks/:id`

**字段**: title、descriptionMarkdown、priority（high/medium/low）、dueDate、completed、trashedAt、tags、recurrenceRule

#### 5.1.2 批量操作

- **批量完成**: `POST /api/life/todo/actions/batch-complete`
- **批量删除**: `POST /api/life/todo/actions/batch-delete`
- **批量恢复**: `POST /api/life/todo/actions/batch-restore`

#### 5.1.3 待办概览

- **路径**: `GET /api/life/todo/overview`
- **描述**: 获取待办统计概览

#### 5.1.4 待办设置

- **获取**: `GET /api/life/todo/settings`
- **更新**: `PATCH /api/life/todo/settings`

### 5.2 物品模块

**基础路径**: `/api/life/storage`
**权限**: 需要登录

#### 5.2.1 物品记录

- **列表**: `GET /api/life/storage/items`
- **新增**: `POST /api/life/storage/items`
- **更新**: `PATCH /api/life/storage/items/:id`
- **删除**: `DELETE /api/life/storage/items/:id`（归档，非物理删除）

**字段**: name、category、location、quantity、unit、status（active/archived）、expiryDate、purchaseDate、note、shoppingRecordId、source

#### 5.2.2 从购物记录同步

- **路径**: `POST /api/life/storage/actions/sync-from-shopping`
- **描述**: 从购物记录同步创建物品追踪

#### 5.2.3 物品概览

- **路径**: `GET /api/life/storage/overview`

#### 5.2.4 物品设置

- **获取**: `GET /api/life/storage/settings`
- **更新**: `PATCH /api/life/storage/settings`

### 5.3 号卡模块

**基础路径**: `/api/life/card`
**权限**: 需要登录

#### 5.3.1 号卡记录

- **列表**: `GET /api/life/card/records`
- **新增**: `POST /api/life/card/records`
- **更新**: `PATCH /api/life/card/records/:id`
- **删除**: `DELETE /api/life/card/records/:id`

**字段**: phoneNumber、carrier、planType、balance、billDay、monthlyFee、activationDate、status、note

#### 5.3.2 充值记录

- **列表**: `GET /api/life/card/recharges`
- **新增**: `POST /api/life/card/recharges`
- **更新**: `PATCH /api/life/card/recharges/:id`
- **删除**: `DELETE /api/life/card/recharges/:id`

#### 5.3.3 账单记录

- **列表**: `GET /api/life/card/bills`
- **新增**: `POST /api/life/card/bills`
- **更新**: `PATCH /api/life/card/bills/:id`
- **删除**: `DELETE /api/life/card/bills/:id`

#### 5.3.4 运营商

- **列表**: `GET /api/life/card/carriers`
- **新增**: `POST /api/life/card/carriers`
- **更新**: `PATCH /api/life/card/carriers/:id`
- **删除**: `DELETE /api/life/card/carriers/:id`

#### 5.3.5 号卡概览

- **路径**: `GET /api/life/card/overview`

#### 5.3.6 号卡设置

- **获取**: `GET /api/life/card/settings`
- **更新**: `PATCH /api/life/card/settings`

---

## 6. 投资中心 API

### 6.1 外汇模块

**基础路径**: `/api/investment/forex`
**权限**: 需要登录

#### 6.1.1 交易记录

- **列表**: `GET /api/investment/forex/trades`
- **新增**: `POST /api/investment/forex/trades`
- **更新**: `PATCH /api/investment/forex/trades/:id`
- **删除**: `DELETE /api/investment/forex/trades/:id`

**字段**: tradeDate、instrument、direction（buy/sell）、lots、entryPrice、exitPrice、pnl、commission、strategy、note

#### 6.1.2 资金流水

- **列表**: `GET /api/investment/forex/capital-flows`
- **新增**: `POST /api/investment/forex/capital-flows`
- **更新**: `PATCH /api/investment/forex/capital-flows/:id`
- **删除**: `DELETE /api/investment/forex/capital-flows/:id`

**字段**: flowDate、flowType（deposit/withdrawal）、amount、currency、note

#### 6.1.3 获取仪表盘汇总

- **路径**: `GET /api/investment/forex/dashboard-summary`
- **描述**: 获取外汇仪表盘汇总数据

#### 6.1.4 获取交易概览

- **路径**: `GET /api/investment/forex/overview`

#### 6.1.5 获取盈亏趋势

- **路径**: `GET /api/investment/forex/pnl-trend`

#### 6.1.6 计算强平价

- **路径**: `POST /api/investment/forex/calculate-margin-call`
- **描述**: 按品种和方向分组，使用加权平均入场价和共享账户余额计算强平价

#### 6.1.7 外汇设置

- **获取**: `GET /api/investment/forex/settings`
- **更新**: `PATCH /api/investment/forex/settings`

---

## 7. 通知中心 API

**基础路径**: `/api/notifications`
**权限**: 需要登录

### 7.1 通知渠道

- **列表**: `GET /api/notifications/channels`
- **新增**: `POST /api/notifications/channels`
- **更新**: `PATCH /api/notifications/channels/:id`
- **删除**: `DELETE /api/notifications/channels/:id`

**支持的渠道类型**: email、企业微信、钉钉、飞书、Telegram、Webhook

### 7.2 通知场景

- **列表**: `GET /api/notifications/scenes`
- **更新**: `PATCH /api/notifications/scenes/:id`
- **启用/禁用**: `POST /api/notifications/scenes/:id/toggle`

**内置场景**:
- finance.report.monthly - 财务月报
- loan.repayment_upcoming - 贷款还款提醒
- loan.repayment_overdue - 贷款逾期提醒
- subscription.renewal_upcoming - 订阅即将到期
- subscription.expired - 订阅已到期
- medication.stock_reminder - 药品库存提醒
- checkup.follow_up - 体检复查提醒

### 7.3 通知模板

- **列表**: `GET /api/notifications/templates`
- **新增**: `POST /api/notifications/templates`
- **更新**: `PATCH /api/notifications/templates/:id`
- **删除**: `DELETE /api/notifications/templates/:id`

### 7.4 通知日志

- **列表**: `GET /api/notifications/logs`
- **详情**: `GET /api/notifications/logs/:id`
- **重发**: `POST /api/notifications/logs/:id/resend`

### 7.5 测试通知

- **路径**: `POST /api/notifications/channels/:id/test`
- **描述**: 发送测试通知到指定渠道

---

## 8. 智能助理 API

**基础路径**: `/api/assistant`
**权限**: 需要登录

### 8.1 AI 对话

- **路径**: `POST /api/assistant/chat`
- **描述**: 与 AI 助理对话，支持工具调用

**请求参数**:
- messages: 消息数组（1-30条）
  - role: user / assistant / system / tool
  - content: 消息内容
  - toolCallId: 工具调用ID（tool消息）
  - toolCalls: 工具调用列表（assistant消息）

**响应结构**:
- content: AI 回复内容
- toolCalls: 工具调用日志数组

**支持的工具**:
- 查询步数数据
- 查询体重记录
- 查询财务数据
- 查询投资数据
- 查询待办任务
- 查询生活数据

### 8.2 使用统计

- **路径**: `GET /api/assistant/usage`
- **描述**: 获取 DeepSeek 账户余额 + 本站 AI 助理消耗统计

**响应结构**:
- enabled: 是否启用
- ok: 查询是否成功
- balances: DeepSeek 余额信息
- local: 本地使用统计
- scenes: 按场景分类的使用统计

---

## 9. 仪表盘 API

**基础路径**: `/api/dashboard`
**权限**: 需要登录

### 9.1 仪表盘总览

- **路径**: `GET /api/dashboard/summary`
- **描述**: 获取完整的仪表盘汇总数据（含缓存，30秒 TTL）

**响应结构**:
- overviewCards: 概览卡片数组
- agenda: 统一待办事项（Top 20）
- health: 健康中心摘要
- finance: 财务中心摘要
- life: 生活中心摘要
- investment: 投资中心摘要
- notifications: 通知中心摘要

### 9.2 统一待办

- **路径**: `GET /api/dashboard/agenda`
- **描述**: 获取所有模块的待处理事项

### 9.3 健康快照

- **路径**: `GET /api/dashboard/health-snapshot`
- **描述**: 获取健康中心快速快照

### 9.4 财务快照

- **路径**: `GET /api/dashboard/finance-snapshot`
- **描述**: 获取财务中心快速快照

### 9.5 生活快照

- **路径**: `GET /api/dashboard/life-snapshot`
- **描述**: 获取生活中心快速快照

### 9.6 投资快照

- **路径**: `GET /api/dashboard/investment-snapshot`
- **描述**: 获取投资中心快速快照

### 9.7 通知快照

- **路径**: `GET /api/dashboard/notification-snapshot`
- **描述**: 获取通知中心快速快照

---

## 10. 系统 API

### 10.1 系统健康检查

- **路径**: `GET /api/system/health`
- **权限**: 公开
- **描述**: 获取系统健康状态

**响应结构**:
- databaseReady: 数据库是否就绪
- hasUsers: 是否已存在用户
- appVersion: 应用版本
- uptime: 运行时间

### 10.2 深度分析

**基础路径**: `/api/analysis`
**权限**: 需要登录

#### 10.2.1 外汇交易分析

- **路径**: `POST /api/analysis/forex`
- **描述**: 使用 DeepSeek AI 分析外汇交易数据

---

## 11. Telegram API

**基础路径**: `/api/telegram`
**权限**: 需要登录

### 11.1 获取 Telegram 绑定状态

- **路径**: `GET /api/telegram/binding`
- **描述**: 获取当前用户的 Telegram 绑定状态

### 11.2 绑定 Telegram

- **路径**: `POST /api/telegram/bind`
- **描述**: 绑定 Telegram 账号

**请求参数**: token（Telegram Bot Token）、chatId

### 11.3 解绑 Telegram

- **路径**: `POST /api/telegram/unbind`
- **描述**: 解绑 Telegram 账号

### 11.4 获取绑定二维码/链接

- **路径**: `GET /api/telegram/connect-url`
- **描述**: 获取 Telegram 绑定链接或二维码

---

## 附录

### A. 通用响应码

| 业务码 | 说明 |
|--------|------|
| success | 成功 |
| register_success | 注册成功 |
| login_success | 登录成功 |
| refresh_success | 刷新成功 |
| logout_success | 登出成功 |
| update_profile_success | 更新资料成功 |
| change_password_success | 修改密码成功 |
| create_shopping_record_success | 创建购物记录成功 |
| update_shopping_record_success | 更新购物记录成功 |
| delete_shopping_record_success | 删除购物记录成功 |
| import_shopping_records_success | 导入购物记录成功 |
| create_travel_book_success | 创建旅行账本成功 |
| update_travel_book_success | 更新旅行账本成功 |
| complete_travel_book_success | 完成旅行成功 |
| archive_travel_book_success | 归档旅行成功 |
| export_travel_report_success | 导出旅行报告成功 |
| create_loan_platform_success | 创建贷款平台成功 |
| mark_loan_bill_paid_success | 标记账单已还成功 |
| trigger_loan_reminders_success | 触发贷款提醒成功 |
| create_subscription_record_success | 创建订阅记录成功 |
| trigger_subscription_reminders_success | 触发订阅提醒成功 |
| create_rent_record_success | 创建住房记录成功 |
| create_utility_bill_success | 创建月度账单成功 |
| push_finance_monthly_report_success | 推送财务月报成功 |
| dashboard_summary | 仪表盘汇总 |

### B. 货币单位

所有金额字段默认单位为人民币元（CNY），除非另有说明。外汇交易模块使用美元（USD）。

### C. 日期格式约定

- 日期: `YYYY-MM-DD`
- 月份: `YYYY-MM`
- 时间: `HH:mm`
- 日期时间: ISO 8601 格式 `YYYY-MM-DDTHH:mm:ss.sssZ`
