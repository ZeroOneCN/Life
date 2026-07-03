# LifeOS 数据库设计文档

## 一、数据库设计总览

### 1.1 数据库选型与版本

- **数据库类型**: MySQL
- **ORM 框架**: TypeORM
- **编程语言**: TypeScript
- **主键策略**: UUID (v4, 36位字符串)

### 1.2 命名规范

| 规范类型 | 规则 | 示例 |
|---------|------|------|
| 表名 | 模块前缀_实体名，全小写，下划线分隔 | `system_user_account` |
| 字段名 | 全小写，下划线分隔 | `user_id`, `created_at` |
| 索引名 | `idx_`前缀 + 表名简称 + 字段名 | `idx_assistant_usage_user_created` |
| 主键 | 统一使用 `id` | `id` |
| 外键字段 | 关联表名_id | `user_id`, `platform_id` |

### 1.3 字段类型规范

| 数据类型 | 用途说明 |
|---------|---------|
| `varchar(n)` | 字符串类型，按需指定长度 |
| `text` / `mediumtext` | 长文本内容 |
| `int` | 整数类型 |
| `bigint` | 大整数（如 Telegram ID） |
| `decimal(p, s)` | 精确数值（金额、体重等） |
| `double` | 双精度浮点数 |
| `tinyint(1)` | 布尔值（0/1） |
| `date` | 日期类型（YYYY-MM-DD） |
| `datetime` | 日期时间类型 |
| `json` | JSON 数据类型 |

### 1.4 索引设计原则

1. **主键索引**: 所有表均以 `id` 为主键（UUID 类型）
2. **用户隔离索引**: 所有用户数据表现有 `user_id` 字段，用于数据隔离
3. **唯一索引**: 用户名、邮箱、绑定码等唯一约束字段
4. **联合索引**: 针对常用查询场景建立联合索引（如 `user_id + created_at`）
5. **外键关联**: 通过逻辑关联实现，不使用物理外键约束

### 1.5 实体关系概览（ER图文字描述）

```
system_user_account (1) ── (1) system_user_profile
        │
        ├─ (1) ── (N) system_auth_session
        ├─ (1) ── (N) system_assistant_usage_logs
        │
        ├─ (1) ── (1) 各模块设置表 (*_setting)
        │
        ├─ (1) ── (N) 健康模块记录表
        │   ├─ health_step_record
        │   ├─ health_fitness_weight_record
        │   ├─ health_fitness_diet_record
        │   ├─ health_fitness_exercise_record
        │   ├─ health_fitness_shopping_record
        │   ├─ health_medication_record
        │   ├─ health_medication_purchase
        │   ├─ health_medication_threshold
        │   ├─ health_medication_summary
        │   ├─ health_checkup_record
        │   └─ health_checkup_template (1) ── (N) health_checkup_template_item
        │
        ├─ (1) ── (N) 财务模块记录表
        │   ├─ finance_loan_platform (1) ── (N) finance_loan_bill
        │   │                           └─ (N) finance_loan_repayment
        │   ├─ finance_rent_channel (1) ── (N) finance_rent_record
        │   │                           └─ (N) finance_rent_utility_bill
        │   ├─ finance_shopping_ledger (1) ── (N) finance_shopping_record
        │   ├─ finance_subscription_category (1) ── (N) finance_subscription_record
        │   └─ finance_travel_book (1) ── (N) finance_travel_expense_record
        │
        ├─ (1) ── (N) 投资模块记录表
        │   ├─ investment_forex_trade_record
        │   └─ investment_forex_capital_flow
        │
        ├─ (1) ── (N) 生活模块记录表
        │   ├─ life_todo_task
        │   ├─ life_storage_item
        │   └─ life_card_carrier (1) ── (N) life_card_record
        │                                  ├─ (N) life_card_recharge_record
        │                                  └─ (N) life_card_bill_record
        │
        ├─ (1) ── (N) 通知模块表
        │   ├─ notification_center_channel
        │   ├─ notification_center_scene (1) ── (N) notification_center_scene_channel
        │   ├─ notification_center_template
        │   └─ notification_center_log
        │
        └─ (1) ── (0..1) telegram_binding
```

---

## 二、系统模块表

### 2.1 system_user_account — 用户账户表

**表说明**: 存储用户账户基本信息，包括登录凭证和账户状态。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键，用户ID |
| `username` | `varchar(64)` | 是 | - | 用户名，唯一 |
| `password_hash` | `varchar(255)` | 是 | - | 密码哈希值 |
| `email` | `varchar(128)` | 是 | - | 邮箱，唯一 |
| `is_active` | `tinyint(1)` | 是 | `1` | 账户是否激活 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 唯一索引: `username`
- 唯一索引: `email`

**关联关系**:
- 1:1 → `system_user_profile`（通过 `user_id`）
- 1:N → `system_auth_session`
- 1:N → `system_assistant_usage_logs`

---

### 2.2 system_user_profile — 用户资料表

**表说明**: 存储用户个人资料信息，与账户表一对一关系。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `nickname` | `varchar(64)` | 是 | - | 昵称 |
| `avatar_url` | `varchar(128)` | 否 | `NULL` | 头像URL |
| `timezone` | `varchar(64)` | 否 | `NULL` | 时区 |
| `preferences_json` | `json` | 否 | `NULL` | 用户偏好配置（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 2.3 system_auth_session — 认证会话表

**表说明**: 存储用户登录会话信息，用于身份验证和会话管理。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `session_token` | `varchar(128)` | 是 | - | 会话令牌，唯一 |
| `refresh_token_hash` | `varchar(255)` | 是 | - | 刷新令牌哈希 |
| `expires_at` | `datetime` | 是 | - | 过期时间 |
| `device_name` | `varchar(255)` | 否 | `NULL` | 设备名称 |
| `ip_address` | `varchar(64)` | 否 | `NULL` | IP地址 |
| `revoked` | `tinyint(1)` | 是 | `0` | 是否已撤销 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 唯一索引: `session_token`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 2.4 system_assistant_usage_logs — AI助理使用日志表

**表说明**: 记录AI助理的单次请求消耗情况，用于统计Token使用量和费用估算。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `scene` | `varchar(64)` | 是 | - | 使用场景 |
| `request_count` | `int` | 是 | `0` | HTTP请求次数（含tool_calls轮次） |
| `prompt_tokens` | `int` | 是 | `0` | 输入侧估算token数 |
| `completion_tokens` | `int` | 是 | `0` | 输出侧估算token数 |
| `estimated_cost` | `double` | 是 | `0` | 估算花费（元） |
| `status` | `varchar(16)` | 是 | `'success'` | 状态：success/error |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 联合索引: `idx_assistant_usage_user_created` (`user_id`, `created_at`)

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

## 三、健康模块表

### 3.1 health_step_record — 步数记录表

**表说明**: 记录用户每日/每小时的步数数据。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `steps` | `int` | 是 | - | 步数 |
| `hour` | `int` | 否 | `NULL` | 小时（0-23），按小时统计时使用 |
| `record_time` | `datetime` | 是 | - | 记录时间 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.2 health_step_setting — 步数设置表

**表说明**: 存储用户步数模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `stride_length` | `decimal(8,2)` | 是 | `0.7` | 步长（米） |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `stats_user_id` | `varchar(36)` | 否 | `NULL` | 统计页用户ID |
| `records_user_id` | `varchar(36)` | 否 | `NULL` | 记录页用户ID |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 3.3 health_fitness_weight_record — 体重记录表

**表说明**: 记录用户体重及身体成分数据。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 记录日期 |
| `weight` | `decimal(10,2)` | 是 | - | 体重（kg） |
| `height` | `decimal(10,2)` | 是 | - | 身高（cm） |
| `body_fat` | `decimal(10,2)` | 是 | - | 体脂率（%） |
| `visceral_fat` | `decimal(10,1)` | 是 | `0` | 内脏脂肪等级 |
| `fat_mass` | `decimal(10,2)` | 是 | `0` | 脂肪量（kg） |
| `muscle_rate` | `decimal(10,1)` | 是 | `0` | 肌肉率（%） |
| `muscle_mass` | `decimal(10,2)` | 是 | `0` | 肌肉量（kg） |
| `body_water_rate` | `decimal(10,1)` | 是 | `0` | 水分率（%） |
| `body_water_mass` | `decimal(10,2)` | 是 | `0` | 水分量（kg） |
| `protein_rate` | `decimal(10,1)` | 是 | `0` | 蛋白质率（%） |
| `protein_mass` | `decimal(10,2)` | 是 | `0` | 蛋白质量（kg） |
| `bone_rate` | `decimal(10,1)` | 是 | `0` | 骨量率（%） |
| `bone_mass` | `decimal(10,2)` | 是 | `0` | 骨量（kg） |
| `skeletal_muscle_rate` | `decimal(10,1)` | 是 | `0` | 骨骼肌率（%） |
| `skeletal_muscle_mass` | `decimal(10,2)` | 是 | `0` | 骨骼肌量（kg） |
| `subcutaneous_fat_rate` | `decimal(10,1)` | 是 | `0` | 皮下脂肪率（%） |
| `subcutaneous_fat_mass` | `decimal(10,2)` | 是 | `0` | 皮下脂肪量（kg） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.4 health_fitness_diet_record — 饮食记录表

**表说明**: 记录用户每日饮食摄入情况及营养成分。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 记录日期 |
| `meal_type` | `varchar(32)` | 是 | - | 餐次类型（早餐/午餐/晚餐/加餐等） |
| `food_name` | `varchar(255)` | 是 | - | 食物名称 |
| `grams` | `decimal(10,2)` | 是 | - | 重量（克） |
| `calories` | `decimal(10,2)` | 是 | - | 热量（千卡） |
| `protein` | `decimal(10,2)` | 是 | - | 蛋白质（克） |
| `carbs` | `decimal(10,2)` | 是 | - | 碳水化合物（克） |
| `fat` | `decimal(10,2)` | 是 | - | 脂肪（克） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.5 health_fitness_exercise_record — 运动记录表

**表说明**: 记录用户运动锻炼情况及消耗热量。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 记录日期 |
| `exercise_type` | `varchar(32)` | 是 | - | 运动类型（有氧/力量/柔韧等） |
| `exercise_name` | `varchar(255)` | 是 | - | 运动名称 |
| `duration` | `decimal(10,2)` | 是 | - | 时长（分钟） |
| `calories` | `decimal(10,2)` | 是 | - | 消耗热量（千卡） |
| `intensity` | `varchar(16)` | 是 | - | 强度（低/中/高） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.6 health_fitness_shopping_record — 健身购物记录表

**表说明**: 记录用户健身相关的购物消费记录。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 购买日期 |
| `item_name` | `varchar(255)` | 是 | - | 商品名称 |
| `spec_grams` | `decimal(10,2)` | 是 | - | 规格（克） |
| `quantity` | `decimal(10,2)` | 是 | - | 数量 |
| `unit_price` | `decimal(10,2)` | 是 | - | 单价 |
| `location` | `varchar(255)` | 是 | - | 购买地点 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.7 health_fitness_setting — 健身设置表

**表说明**: 存储用户健身模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `diet_filter_user_id` | `varchar(36)` | 否 | `NULL` | 饮食筛选用户ID |
| `exercise_filter_user_id` | `varchar(36)` | 否 | `NULL` | 运动筛选用户ID |
| `shopping_filter_user_id` | `varchar(36)` | 否 | `NULL` | 购物筛选用户ID |
| `weight_filter_user_id` | `varchar(36)` | 否 | `NULL` | 体重筛选用户ID |
| `dashboard_user_id` | `varchar(36)` | 否 | `NULL` | 仪表盘用户ID |
| `default_height_cm` | `decimal(10,2)` | 否 | `NULL` | 默认身高（cm） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 3.8 health_medication_record — 用药记录表

**表说明**: 记录用户每日用药情况，按早中晚三餐记录剂量。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 记录日期 |
| `medicine_name` | `varchar(128)` | 是 | - | 药品名称 |
| `breakfast` | `decimal(10,2)` | 是 | - | 早餐剂量 |
| `lunch` | `decimal(10,2)` | 是 | - | 午餐剂量 |
| `dinner` | `decimal(10,2)` | 是 | - | 晚餐剂量 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.9 health_medication_purchase — 购药记录表

**表说明**: 记录用户购买药品的记录，用于库存管理和费用统计。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `purchase_date` | `date` | 是 | - | 购买日期 |
| `medicine_name` | `varchar(128)` | 是 | - | 药品名称 |
| `quantity` | `decimal(10,2)` | 是 | - | 数量 |
| `unit` | `varchar(32)` | 是 | - | 单位（片/瓶/盒等） |
| `unit_price` | `decimal(10,2)` | 是 | - | 单价 |
| `total_price` | `decimal(10,2)` | 是 | - | 总价 |
| `channel` | `varchar(128)` | 是 | - | 购买渠道 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.10 health_medication_threshold — 用药阈值表

**表说明**: 设置每种药品的库存预警阈值，当库存低于阈值时触发提醒。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `medicine_name` | `varchar(128)` | 是 | - | 药品名称 |
| `threshold` | `decimal(10,2)` | 是 | - | 库存预警阈值 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.11 health_medication_summary — 用药汇总表

**表说明**: 存储用药分析汇总报告，按日期归档。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `date` | `date` | 是 | - | 汇总日期 |
| `content` | `text` | 是 | - | 汇总内容 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.12 health_medication_setting — 用药设置表

**表说明**: 存储用户用药模块的个性化设置，包括提醒配置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `records_user_id` | `varchar(36)` | 否 | `NULL` | 记录页用户ID |
| `purchase_user_id` | `varchar(36)` | 否 | `NULL` | 购药页用户ID |
| `analysis_user_id` | `varchar(36)` | 否 | `NULL` | 分析页用户ID |
| `summary_user_id` | `varchar(36)` | 否 | `NULL` | 汇总页用户ID |
| `dose_reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启服药提醒 |
| `stock_reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启库存提醒 |
| `breakfast_reminder_time` | `varchar(8)` | 是 | `'08:00'` | 早餐提醒时间 |
| `lunch_reminder_time` | `varchar(8)` | 是 | `'12:00'` | 午餐提醒时间 |
| `dinner_reminder_time` | `varchar(8)` | 是 | `'19:00'` | 晚餐提醒时间 |
| `default_stock_threshold` | `decimal(10,2)` | 是 | `3` | 默认库存阈值 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 3.13 health_checkup_template — 体检模板表

**表说明**: 定义体检报告模板，包含多个体检项目。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 模板名称 |
| `test_type` | `varchar(128)` | 是 | - | 体检类型 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `health_checkup_template_item`（通过 `template_id`）

---

### 3.14 health_checkup_template_item — 体检模板项表

**表说明**: 体检模板中的具体检查项目定义。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `template_id` | `varchar(36)` | 是 | - | 关联模板ID |
| `sort_order` | `int` | 是 | `0` | 排序序号 |
| `test_name` | `varchar(128)` | 是 | - | 检查项目名称 |
| `unit` | `varchar(64)` | 是 | - | 单位 |
| `reference_range` | `varchar(255)` | 是 | - | 参考范围 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `template_id`

**关联关系**:
- N:1 → `health_checkup_template`（通过 `template_id`）

---

### 3.15 health_checkup_record — 体检记录表

**表说明**: 记录每次体检的具体指标数据。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `test_date` | `date` | 是 | - | 体检日期 |
| `test_type` | `varchar(128)` | 是 | - | 体检类型 |
| `test_name` | `varchar(128)` | 是 | - | 检查项目名称 |
| `value` | `decimal(12,4)` | 是 | - | 检测值 |
| `unit` | `varchar(64)` | 是 | - | 单位 |
| `reference_range` | `varchar(255)` | 是 | - | 参考范围 |
| `notes` | `text` | 是 | - | 备注 |
| `follow_up_date` | `date` | 否 | `NULL` | 复查日期 |
| `status` | `varchar(16)` | 是 | - | 状态（正常/异常等） |
| `last_abnormal_alert_at` | `datetime` | 否 | `NULL` | 上次异常提醒时间 |
| `last_follow_up_reminder_at` | `datetime` | 否 | `NULL` | 上次复查提醒时间 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 3.16 health_checkup_setting — 体检设置表

**表说明**: 存储用户体检模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `records_user_id` | `varchar(36)` | 否 | `NULL` | 记录页用户ID |
| `trend_user_id` | `varchar(36)` | 否 | `NULL` | 趋势页用户ID |
| `insight_user_id` | `varchar(36)` | 否 | `NULL` | 洞察页用户ID |
| `reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启提醒 |
| `abnormal_alert_enabled` | `tinyint(1)` | 是 | `1` | 是否开启异常告警 |
| `follow_up_lead_days` | `int` | 是 | `7` | 复查提前提醒天数 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

## 四、财务模块表

### 4.1 finance_loan_platform — 贷款平台表

**表说明**: 管理贷款/信用卡平台信息，包括账单日和还款日。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 平台名称 |
| `billing_day` | `int` | 是 | - | 账单日（1-31） |
| `repayment_day` | `int` | 是 | - | 还款日（1-31） |
| `credit_limit` | `decimal(12,2)` | 是 | - | 信用额度 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `finance_loan_bill`（通过 `platform_id`）
- 1:N → `finance_loan_repayment`（通过 `platform_id`）

---

### 4.2 finance_loan_repayment — 还款计划表

**表说明**: 记录贷款/信用卡的还款计划和实际还款情况。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `bill_id` | `varchar(36)` | 否 | `NULL` | 关联账单ID |
| `platform_id` | `varchar(36)` | 是 | - | 关联平台ID |
| `platform_name` | `varchar(128)` | 是 | - | 平台名称（冗余） |
| `amount` | `decimal(12,2)` | 是 | - | 还款本金 |
| `interest` | `decimal(12,2)` | 是 | - | 利息 |
| `repayment_date` | `date` | 是 | - | 还款日期 |
| `notes` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `platform_id`
- 普通索引: `bill_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_loan_platform`（通过 `platform_id`）
- N:1 → `finance_loan_bill`（通过 `bill_id`）

---

### 4.3 finance_loan_bill — 贷款账单表

**表说明**: 记录每期贷款/信用卡账单信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `platform_id` | `varchar(36)` | 是 | - | 关联平台ID |
| `platform_name` | `varchar(128)` | 是 | - | 平台名称（冗余） |
| `amount` | `decimal(12,2)` | 是 | - | 账单金额 |
| `interest` | `decimal(12,2)` | 是 | - | 利息 |
| `billing_month` | `varchar(16)` | 是 | - | 账单月份（YYYY-MM） |
| `due_date` | `date` | 是 | - | 到期还款日 |
| `notes` | `text` | 是 | - | 备注 |
| `is_paid` | `tinyint(1)` | 是 | `0` | 是否已还清 |
| `paid_at` | `date` | 否 | `NULL` | 还清日期 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `platform_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_loan_platform`（通过 `platform_id`）
- 1:N → `finance_loan_repayment`（通过 `bill_id`）

---

### 4.4 finance_loan_setting — 贷款设置表

**表说明**: 存储用户贷款模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `repayment_reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启还款提醒 |
| `overdue_reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启逾期提醒 |
| `auto_repayment_on_mark_paid` | `tinyint(1)` | 是 | `1` | 标记已还时自动记录还款 |
| `notification_frequency` | `varchar(16)` | 是 | `'daily'` | 通知频率 |
| `upcoming_days` | `int` | 是 | `7` | 提前提醒天数 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 4.5 finance_rent_channel — 房租渠道表

**表说明**: 管理租房渠道信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 渠道名称 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `finance_rent_record`（通过 `channel_id`）

---

### 4.6 finance_rent_record — 房租记录表

**表说明**: 记录租房信息和各项费用明细。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `address` | `varchar(255)` | 是 | - | 完整地址 |
| `address_short` | `varchar(128)` | 是 | `''` | 地址简称 |
| `channel_id` | `varchar(36)` | 是 | - | 关联渠道ID |
| `channel_name` | `varchar(128)` | 是 | - | 渠道名称（冗余） |
| `move_in_date` | `date` | 是 | - | 入住日期 |
| `move_out_date` | `date` | 否 | `NULL` | 退租日期 |
| `rent` | `decimal(12,2)` | 是 | `0` | 租金 |
| `deposit` | `decimal(12,2)` | 是 | `0` | 押金 |
| `electricity_fee` | `decimal(12,2)` | 是 | `0` | 电费 |
| `water_fee` | `decimal(12,2)` | 是 | `0` | 水费 |
| `gas_fee` | `decimal(12,2)` | 是 | `0` | 燃气费 |
| `agency_fee` | `decimal(12,2)` | 是 | `0` | 中介费 |
| `cleaning_fee` | `decimal(12,2)` | 是 | `0` | 清洁费 |
| `laundry_fee` | `decimal(12,2)` | 是 | `0` | 洗衣费 |
| `service_fee` | `decimal(12,2)` | 是 | `0` | 服务费 |
| `orientation` | `varchar(32)` | 是 | `''` | 朝向 |
| `notes` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `channel_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_rent_channel`（通过 `channel_id`）
- 1:N → `finance_rent_utility_bill`（通过 `record_id`）

---

### 4.7 finance_rent_setting — 房租设置表

**表说明**: 存储用户房租模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `records_user_id` | `varchar(36)` | 否 | `NULL` | 记录页用户ID |
| `statistics_user_id` | `varchar(36)` | 否 | `NULL` | 统计页用户ID |
| `editing_record_id` | `varchar(36)` | 否 | `NULL` | 正在编辑的记录ID |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 4.8 finance_shopping_platform — 购物平台表

**表说明**: 管理购物平台信息，支持内置和自定义平台。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `name` | `varchar(128)` | 是 | - | 平台名称 |
| `color_token` | `varchar(64)` | 否 | `NULL` | 颜色标识 |
| `is_built_in` | `tinyint(1)` | 是 | `0` | 是否内置平台 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`

**关联关系**:
- 无直接外键关联（平台为全局共享）

---

### 4.9 finance_shopping_ledger — 购物账本表

**表说明**: 管理购物账本，用于分类记录不同时期的购物消费。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `name` | `varchar(128)` | 是 | - | 账本名称 |
| `description` | `text` | 是 | - | 描述 |
| `start_date` | `date` | 是 | - | 开始日期 |
| `end_date` | `date` | 否 | `NULL` | 结束日期 |
| `is_active` | `tinyint(1)` | 是 | `0` | 是否激活 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`

**关联关系**:
- 1:N → `finance_shopping_record`（通过 `ledger_id`）

---

### 4.10 finance_shopping_record — 购物记录表

**表说明**: 记录每一笔购物消费明细。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `ledger_id` | `varchar(36)` | 是 | - | 关联账本ID |
| `date` | `date` | 是 | - | 购买日期 |
| `platform` | `varchar(128)` | 是 | - | 购物平台 |
| `item_name` | `varchar(255)` | 是 | - | 商品名称 |
| `spec` | `varchar(255)` | 是 | - | 规格 |
| `price` | `decimal(12,2)` | 是 | - | 总价 |
| `unit_price` | `decimal(12,2)` | 否 | `NULL` | 单价 |
| `order_no` | `varchar(128)` | 是 | - | 订单号 |
| `note` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `ledger_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_shopping_ledger`（通过 `ledger_id`）

---

### 4.11 finance_shopping_import_batch — 购物导入批次表

**表说明**: 记录购物数据批量导入的批次信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `file_name` | `varchar(128)` | 是 | - | 文件名 |
| `total_rows` | `int` | 是 | `0` | 总行数 |
| `imported_count` | `int` | 是 | `0` | 成功导入数 |
| `duplicate_count` | `int` | 是 | `0` | 重复数 |
| `invalid_count` | `int` | 是 | `0` | 无效数 |
| `summary_json` | `json` | 否 | `NULL` | 汇总信息（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 4.12 finance_shopping_setting — 购物设置表

**表说明**: 存储用户购物模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `records_user_id` | `varchar(36)` | 否 | `NULL` | 记录页用户ID |
| `dashboard_user_id` | `varchar(36)` | 否 | `NULL` | 仪表盘用户ID |
| `active_ledger_id` | `varchar(36)` | 否 | `NULL` | 当前激活账本ID |
| `records_ledger_id` | `varchar(36)` | 否 | `NULL` | 记录页账本ID |
| `dashboard_ledger_id` | `varchar(36)` | 否 | `NULL` | 仪表盘账本ID |
| `currency_mode` | `varchar(8)` | 是 | `'CNY'` | 货币模式 |
| `usdt_rate` | `decimal(12,4)` | 是 | `7.2` | USDT汇率 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 4.13 finance_subscription_category — 订阅分类表

**表说明**: 管理订阅服务的分类信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 分类名称 |
| `description` | `text` | 是 | - | 描述 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `finance_subscription_record`（通过 `category_id`）

---

### 4.14 finance_subscription_record — 订阅记录表

**表说明**: 记录各项订阅服务的详细信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `service_name` | `varchar(255)` | 是 | - | 服务名称 |
| `plan_name` | `varchar(128)` | 是 | - | 套餐名称 |
| `category_id` | `varchar(36)` | 是 | - | 关联分类ID |
| `category_name` | `varchar(128)` | 是 | - | 分类名称（冗余） |
| `start_date` | `date` | 是 | - | 开始日期 |
| `end_date` | `date` | 是 | - | 结束日期 |
| `billing_cycle` | `varchar(16)` | 是 | - | 计费周期 |
| `cycle_price` | `decimal(12,2)` | 是 | - | 周期价格 |
| `auto_renew` | `tinyint(1)` | 是 | `0` | 是否自动续费 |
| `notes` | `text` | 是 | - | 备注 |
| `last_upcoming_reminder_marker` | `varchar(128)` | 否 | `NULL` | 上次到期提醒标记 |
| `last_expired_reminder_marker` | `varchar(128)` | 否 | `NULL` | 上次过期提醒标记 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `category_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_subscription_category`（通过 `category_id`）

---

### 4.15 finance_subscription_setting — 订阅设置表

**表说明**: 存储用户订阅模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `records_keyword` | `varchar(255)` | 是 | `''` | 记录搜索关键词 |
| `records_category_id` | `varchar(36)` | 是 | `'all'` | 记录筛选分类ID |
| `records_status` | `varchar(16)` | 是 | `'all'` | 记录筛选状态 |
| `records_auto_renew_filter` | `varchar(16)` | 是 | `'all'` | 自动续费筛选 |
| `records_expiry_start_date` | `date` | 否 | `NULL` | 到期筛选开始日期 |
| `records_expiry_end_date` | `date` | 否 | `NULL` | 到期筛选结束日期 |
| `dashboard_range_days` | `int` | 是 | `90` | 仪表盘时间范围（天） |
| `reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启提醒 |
| `expiry_day_reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启到期日提醒 |
| `lead_days` | `int` | 是 | `7` | 提前提醒天数 |
| `include_auto_renew_in_reminders` | `tinyint(1)` | 是 | `0` | 提醒是否包含自动续费 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 4.16 finance_travel_book — 旅行书表

**表说明**: 管理旅行账本，记录每次旅行的基本信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 旅行名称 |
| `description` | `text` | 是 | - | 描述 |
| `start_date` | `date` | 是 | - | 开始日期 |
| `end_date` | `date` | 否 | `NULL` | 结束日期 |
| `summary` | `text` | 是 | - | 总结 |
| `status` | `varchar(16)` | 是 | `'ongoing'` | 状态（planning/ongoing/completed/archived） |
| `currency` | `varchar(8)` | 是 | `'CNY'` | 货币类型 |
| `budget` | `decimal(12,2)` | 否 | `NULL` | 预算 |
| `archived_at` | `datetime` | 否 | `NULL` | 归档时间 |
| `last_followup_marker` | `varchar(128)` | 否 | `NULL` | 上次跟进标记 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `finance_travel_expense_record`（通过 `book_id`）

---

### 4.17 finance_travel_expense_record — 旅行费用记录表

**表说明**: 记录旅行中的每一笔费用支出。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `book_id` | `varchar(36)` | 是 | - | 关联旅行书ID |
| `date` | `date` | 是 | - | 消费日期 |
| `time_start` | `varchar(16)` | 是 | - | 开始时间 |
| `time_end` | `varchar(16)` | 是 | - | 结束时间 |
| `duration_minutes` | `int` | 是 | - | 时长（分钟） |
| `category` | `varchar(32)` | 是 | - | 消费类别 |
| `title` | `varchar(255)` | 是 | - | 标题 |
| `amount` | `decimal(12,2)` | 是 | - | 金额 |
| `discount_amount` | `decimal(12,2)` | 是 | - | 优惠金额 |
| `discount_note` | `varchar(255)` | 是 | - | 优惠说明 |
| `vehicle_info` | `varchar(255)` | 是 | - | 交通信息 |
| `pay_channel` | `varchar(64)` | 是 | - | 支付渠道 |
| `remark` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `book_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `finance_travel_book`（通过 `book_id`）

---

### 4.18 finance_travel_pay_channel — 旅行支付渠道表

**表说明**: 管理旅行支付渠道选项。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `value` | `varchar(64)` | 是 | - | 渠道值 |
| `label` | `varchar(128)` | 是 | - | 渠道标签 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`

**关联关系**:
- 无直接外键关联（支付渠道为全局共享）

---

### 4.19 finance_travel_import_batch — 旅行导入批次表

**表说明**: 记录旅行数据批量导入的批次信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `file_name` | `varchar(128)` | 是 | - | 文件名 |
| `total_rows` | `int` | 是 | `0` | 总行数 |
| `imported_count` | `int` | 是 | `0` | 成功导入数 |
| `duplicate_count` | `int` | 是 | `0` | 重复数 |
| `invalid_count` | `int` | 是 | `0` | 无效数 |
| `summary_json` | `json` | 否 | `NULL` | 汇总信息（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 4.20 finance_travel_setting — 旅行设置表

**表说明**: 存储用户旅行模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `active_user_id` | `varchar(36)` | 否 | `NULL` | 当前激活用户ID |
| `active_book_id` | `varchar(36)` | 否 | `NULL` | 当前激活旅行书ID |
| `details_book_id` | `varchar(36)` | 否 | `NULL` | 详情页旅行书ID |
| `stats_book_id` | `varchar(36)` | 否 | `NULL` | 统计页旅行书ID |
| `report_book_id` | `varchar(36)` | 否 | `NULL` | 报告页旅行书ID |
| `leaderboard_user_id` | `varchar(36)` | 否 | `NULL` | 排行榜用户ID |
| `report_columns_json` | `json` | 否 | `NULL` | 报告列配置（JSON数组） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

## 五、投资模块表

### 5.1 investment_forex_trade_record — 外汇交易记录表

**表说明**: 记录外汇交易的每笔交易详情。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `sort_order` | `int` | 是 | `0` | 排序序号 |
| `trade_date` | `date` | 是 | - | 交易日期 |
| `instrument` | `varchar(16)` | 是 | - | 交易品种 |
| `order_type` | `varchar(16)` | 是 | - | 订单类型 |
| `open_price` | `decimal(14,4)` | 是 | - | 开仓价 |
| `lot_size` | `decimal(12,2)` | 是 | - | 手数 |
| `commission` | `decimal(12,2)` | 是 | - | 佣金 |
| `close_price` | `decimal(14,4)` | 是 | - | 平仓价 |
| `pnl` | `decimal(12,2)` | 是 | - | 盈亏 |
| `overnight_fee` | `decimal(12,2)` | 是 | `0` | 隔夜费 |
| `open_time` | `varchar(16)` | 是 | - | 开仓时间 |
| `close_time` | `varchar(16)` | 是 | - | 平仓时间 |
| `hold_time` | `varchar(64)` | 是 | - | 持仓时长 |
| `remark` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 5.2 investment_forex_capital_flow — 外汇资金流水表

**表说明**: 记录外汇账户的资金出入情况。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `flow_date` | `date` | 是 | - | 流水日期 |
| `flow_type` | `varchar(16)` | 是 | - | 流水类型（入金/出金等） |
| `amount` | `decimal(12,2)` | 是 | - | 金额 |
| `remark` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 5.3 investment_forex_import_batch — 外汇导入批次表

**表说明**: 记录外汇数据批量导入的批次信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `file_name` | `varchar(128)` | 是 | - | 文件名 |
| `total_rows` | `int` | 是 | `0` | 总行数 |
| `imported_count` | `int` | 是 | `0` | 成功导入数 |
| `duplicate_count` | `int` | 是 | `0` | 重复数 |
| `invalid_count` | `int` | 是 | `0` | 无效数 |
| `summary_json` | `json` | 否 | `NULL` | 汇总信息（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 5.4 investment_forex_setting — 外汇设置表

**表说明**: 存储用户外汇模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `leverage` | `decimal(12,2)` | 是 | `100` | 杠杆倍数 |
| `forced_liquidation_ratio` | `decimal(10,2)` | 是 | `0.5` | 强平比例 |
| `dashboard_start_date` | `date` | 否 | `NULL` | 仪表盘开始日期 |
| `dashboard_end_date` | `date` | 否 | `NULL` | 仪表盘结束日期 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

## 六、生活模块表

### 6.1 life_todo_task — 待办任务表

**表说明**: 管理用户的待办任务，支持重复任务配置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `title` | `varchar(255)` | 是 | - | 任务标题 |
| `description_markdown` | `text` | 是 | - | 任务描述（Markdown） |
| `due_date` | `date` | 否 | `NULL` | 截止日期 |
| `priority` | `varchar(16)` | 是 | `'medium'` | 优先级（high/medium/low） |
| `tags_json` | `json` | 否 | `NULL` | 标签数组（JSON） |
| `is_daily` | `tinyint(1)` | 是 | `0` | 是否每日任务 |
| `recurrence_type` | `varchar(16)` | 是 | `'none'` | 重复类型（none/daily/weekly/monthly） |
| `recurrence_config` | `json` | 否 | `NULL` | 重复配置（JSON） |
| `completed` | `tinyint(1)` | 是 | `0` | 是否已完成 |
| `completed_at` | `datetime` | 否 | `NULL` | 完成时间 |
| `last_completed_date` | `date` | 否 | `NULL` | 上次完成日期 |
| `trashed_at` | `datetime` | 否 | `NULL` | 放入回收站时间 |
| `sort_order` | `int` | 是 | `0` | 排序序号 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 6.2 life_todo_setting — 待办设置表

**表说明**: 存储用户待办模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `reminder_enabled` | `tinyint(1)` | 是 | `1` | 是否开启提醒 |
| `reminder_time` | `varchar(8)` | 是 | `'09:00'` | 提醒时间 |
| `lead_days` | `int` | 是 | `3` | 提前提醒天数 |
| `include_daily_tasks` | `tinyint(1)` | 是 | `1` | 是否包含每日任务 |
| `include_overdue_tasks` | `tinyint(1)` | 是 | `1` | 是否包含逾期任务 |
| `last_auto_reminder_date` | `date` | 否 | `NULL` | 上次自动提醒日期 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 6.3 life_storage_item — 物品追踪表

**表说明**: 管理用户的物品存储信息，追踪物品生命周期。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `item_name` | `varchar(255)` | 是 | - | 物品名称 |
| `purchase_price` | `decimal(12,2)` | 是 | - | 购买价格 |
| `purchase_date` | `date` | 是 | - | 购买日期 |
| `end_date` | `date` | 否 | `NULL` | 结束/报废日期 |
| `notes` | `text` | 是 | - | 备注 |
| `status` | `varchar(16)` | 是 | `'active'` | 状态（active/archived等） |
| `archived_at` | `datetime` | 否 | `NULL` | 归档时间 |
| `source` | `varchar(20)` | 是 | `'manual'` | 来源（manual/shopping等） |
| `shopping_record_id` | `varchar(36)` | 否 | `NULL` | 关联购物记录ID |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 6.4 life_storage_setting — 物品设置表

**表说明**: 存储用户物品追踪模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `include_archived_in_dashboard` | `tinyint(1)` | 是 | `1` | 仪表盘是否包含已归档 |
| `default_sort` | `varchar(32)` | 是 | `'latest'` | 默认排序方式 |
| `default_dashboard_range` | `varchar(16)` | 是 | `'all'` | 默认仪表盘时间范围 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

### 6.5 life_card_record — 号卡记录表

**表说明**: 管理用户的手机号卡信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `phone_number` | `varchar(32)` | 是 | - | 手机号码 |
| `carrier_id` | `varchar(36)` | 是 | - | 关联运营商ID |
| `carrier_name` | `varchar(128)` | 是 | - | 运营商名称（冗余） |
| `location` | `varchar(128)` | 是 | - | 归属地 |
| `balance` | `decimal(12,2)` | 是 | - | 余额 |
| `monthly_fee` | `decimal(12,2)` | 是 | - | 月租 |
| `billing_day` | `int` | 是 | - | 账单日（1-31） |
| `data_plan` | `varchar(128)` | 是 | - | 流量套餐 |
| `call_minutes` | `varchar(64)` | 是 | - | 通话分钟 |
| `sms_count` | `varchar(64)` | 是 | - | 短信条数 |
| `activation_date` | `date` | 是 | - | 激活日期 |
| `notes` | `text` | 是 | - | 备注 |
| `last_balance_reminder_marker` | `varchar(128)` | 否 | `NULL` | 上次余额提醒标记 |
| `last_billing_reminder_marker` | `varchar(128)` | 否 | `NULL` | 上次账单提醒标记 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `carrier_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `life_card_carrier`（通过 `carrier_id`）
- 1:N → `life_card_recharge_record`（通过 `sim_id`）
- 1:N → `life_card_bill_record`（通过 `sim_id`）

---

### 6.6 life_card_carrier — 运营商表

**表说明**: 管理运营商信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `name` | `varchar(128)` | 是 | - | 运营商名称 |
| `description` | `text` | 是 | - | 描述 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- 1:N → `life_card_record`（通过 `carrier_id`）

---

### 6.7 life_card_recharge_record — 充值记录表

**表说明**: 记录手机号卡的充值记录。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `sim_id` | `varchar(36)` | 是 | - | 关联号卡ID |
| `phone_number` | `varchar(32)` | 是 | - | 手机号码（冗余） |
| `amount` | `decimal(12,2)` | 是 | - | 充值金额 |
| `recharge_date` | `date` | 是 | - | 充值日期 |
| `note` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `sim_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `life_card_record`（通过 `sim_id`）

---

### 6.8 life_card_bill_record — 账单记录表

**表说明**: 记录手机号卡的月度账单信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `sim_id` | `varchar(36)` | 是 | - | 关联号卡ID |
| `phone_number` | `varchar(32)` | 是 | - | 手机号码（冗余） |
| `carrier_name` | `varchar(128)` | 是 | - | 运营商名称（冗余） |
| `billing_month` | `varchar(16)` | 是 | - | 账单月份（YYYY-MM） |
| `monthly_fee` | `decimal(12,2)` | 是 | - | 月租费 |
| `actual_fee` | `decimal(12,2)` | 是 | - | 实际费用 |
| `extra_charges` | `decimal(12,2)` | 是 | - | 额外费用 |
| `total_fee` | `decimal(12,2)` | 是 | - | 总费用 |
| `note` | `text` | 是 | - | 备注 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `sim_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `life_card_record`（通过 `sim_id`）

---

### 6.9 life_card_bill_import_batch — 账单导入批次表

**表说明**: 记录号卡账单批量导入的批次信息。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `file_name` | `varchar(128)` | 是 | - | 文件名 |
| `total_rows` | `int` | 是 | `0` | 总行数 |
| `imported_count` | `int` | 是 | `0` | 成功导入数 |
| `duplicate_count` | `int` | 是 | `0` | 重复数 |
| `invalid_count` | `int` | 是 | `0` | 无效数 |
| `summary_json` | `json` | 否 | `NULL` | 汇总信息（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

### 6.10 life_card_setting — 号卡设置表

**表说明**: 存储用户号卡模块的个性化设置。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `user_id` | `varchar(36)` | 是 | - | 主键，关联用户ID |
| `balance_low_enabled` | `tinyint(1)` | 是 | `1` | 是否开启余额不足提醒 |
| `billing_upcoming_enabled` | `tinyint(1)` | 是 | `1` | 是否开启账单提醒 |
| `balance_threshold` | `decimal(12,2)` | 是 | `20` | 余额预警阈值 |
| `notification_days_before` | `int` | 是 | `3` | 提前提醒天数 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |

**索引**:
- 主键: `user_id`

**关联关系**:
- 1:1 → `system_user_account`（通过 `user_id`）

---

## 七、通知模块表

### 7.1 notification_center_channel — 通知渠道表

**表说明**: 管理通知发送渠道，如邮件、Telegram、Webhook等。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `channel_type` | `varchar(32)` | 是 | - | 渠道类型 |
| `label` | `varchar(64)` | 是 | - | 渠道标签/名称 |
| `enabled` | `tinyint(1)` | 是 | `1` | 是否启用 |
| `status` | `varchar(32)` | 是 | `'ready'` | 状态 |
| `config_json` | `json` | 否 | `NULL` | 渠道配置（JSON） |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:M → `notification_center_scene`（通过 `notification_center_scene_channel`）

---

### 7.2 notification_center_scene — 通知场景表

**表说明**: 定义通知场景，如还款提醒、用药提醒等。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `scene_id` | `varchar(64)` | 是 | - | 场景标识 |
| `label` | `varchar(128)` | 是 | - | 场景标签/名称 |
| `enabled` | `tinyint(1)` | 是 | `1` | 是否启用 |
| `summary` | `varchar(255)` | 是 | - | 场景摘要 |
| `description` | `text` | 是 | - | 场景描述 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:M → `notification_center_channel`（通过 `notification_center_scene_channel`）
- 1:N → `notification_center_template`（通过 `scene_id`）

---

### 7.3 notification_center_scene_channel — 场景渠道绑定表

**表说明**: 关联通知场景与通知渠道的中间表。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `scene_id` | `varchar(64)` | 是 | - | 场景标识 |
| `channel_type` | `varchar(32)` | 是 | - | 渠道类型 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 联合索引: (`scene_id`, `channel_type`)

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `notification_center_scene`（通过 `scene_id`）
- N:1 → `notification_center_channel`（通过 `channel_type`）

---

### 7.4 notification_center_template — 通知模板表

**表说明**: 定义各场景下的通知内容模板，支持纯文本和HTML格式。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `scene_id` | `varchar(64)` | 是 | - | 关联场景标识 |
| `title` | `varchar(255)` | 是 | - | 模板标题 |
| `body` | `text` | 是 | - | 模板正文（纯文本） |
| `format` | `varchar(16)` | 是 | `'text'` | 模板格式（text/html） |
| `html_body` | `mediumtext` | 否 | `NULL` | HTML模板正文 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`
- 普通索引: `scene_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）
- N:1 → `notification_center_scene`（通过 `scene_id`）

---

### 7.5 notification_center_log — 通知日志表

**表说明**: 记录每一条通知的发送日志，用于追踪和审计。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | 关联用户ID |
| `channel` | `varchar(32)` | 是 | - | 发送渠道 |
| `scene_id` | `varchar(64)` | 否 | `NULL` | 关联场景标识 |
| `kind` | `varchar(16)` | 是 | - | 通知类型 |
| `status` | `varchar(16)` | 是 | - | 发送状态 |
| `title` | `varchar(255)` | 是 | - | 通知标题 |
| `message` | `text` | 是 | - | 通知内容 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

## 八、Telegram模块表

### 8.1 telegram_binding — Telegram绑定关系表

**表说明**: 存储Telegram用户与LifeOS用户的绑定关系。

**字段列表**:

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|-------|------|---------|-------|------|
| `id` | `varchar(36)` | 是 | UUID | 主键 |
| `user_id` | `varchar(36)` | 是 | - | LifeOS用户ID |
| `telegram_user_id` | `bigint` | 是 | - | Telegram用户ID |
| `telegram_username` | `varchar(128)` | 否 | `NULL` | Telegram用户名 |
| `chat_id` | `bigint` | 是 | - | Telegram聊天ID |
| `bind_code` | `varchar(6)` | 否 | `NULL` | 6位绑定码（唯一，绑定后清空） |
| `bind_code_expires_at` | `datetime` | 否 | `NULL` | 绑定码过期时间 |
| `created_at` | `datetime` | 是 | 当前时间 | 创建时间 |
| `updated_at` | `datetime` | 是 | 当前时间 | 更新时间 |
| `deleted_at` | `datetime` | 否 | `NULL` | 删除时间（软删除） |

**索引**:
- 主键: `id`
- 唯一索引: `bind_code`
- 普通索引: `idx_telegram_user_id` (`telegram_user_id`)
- 普通索引: `idx_telegram_chat_id` (`chat_id`)
- 普通索引: `idx_telegram_bind_code` (`bind_code`)
- 普通索引: `user_id`

**关联关系**:
- N:1 → `system_user_account`（通过 `user_id`）

---

## 附录：基础实体类说明

### TimestampedEntity（时间戳基类）

所有带时间戳的实体均继承此类，提供以下字段：
- `id` - 主键，UUID
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `deleted_at` - 删除时间（软删除）

### UserScopedEntity（用户范围基类）

继承自 `TimestampedEntity`，增加用户隔离字段：
- `user_id` - 关联用户ID

### UserSettingEntity（用户设置基类）

用户设置表的基类，以 `user_id` 为主键：
- `user_id` - 主键，关联用户ID
- `created_at` - 创建时间
- `updated_at` - 更新时间

### ImportBatchEntity（导入批次基类）

继承自 `UserScopedEntity`，用于批量导入场景：
- `file_name` - 文件名
- `total_rows` - 总行数
- `imported_count` - 成功导入数
- `duplicate_count` - 重复数
- `invalid_count` - 无效数
- `summary_json` - 汇总信息
