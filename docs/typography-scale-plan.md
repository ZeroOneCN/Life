# LifeOS2 排版层级规划（Typography Scale）

> 基于 Stripe 设计语言 + Outfit 宽体粗体的统一字号体系

---

## 一、当前问题诊断

### 1.1 字号分布（共 100 处声明）

| 字号 | 出现次数 | 占比 | 当前使用场景 |
|------|---------|------|-------------|
| **32px** | 1 | 1% | `.page-title` 页面主标题 |
| **28px** | 3 | 3% | `.section-title` 分区大标题 |
| **24px** | 3 | 3% | `.card-header` 卡片头部标题 |
| **22px** | 3 | 3% | `.sub-title` / `.card-title` 副标题 |
| **20px** | 3 | 3% | `.card-title` / `.sidebar-brand strong` 卡片标题/品牌名 |
| **18px** | 2 | 2% | `.large-text` 大号文字 / `.empty-state h3` |
| **16px** | 12 | 12% | `.body-text` 正文 / 按钮 / 统计数字 / 表格单元格 |
| **15px** | 5 | 5% | `body` 全局基础字号 / `.subtitle` / 部分表单 |
| **14px** | 13 | 13% | 通用文本 / 表格内容 / 标签文字 / 描述说明 |
| **13px** | 24 | **24%** | `.text-small` 小字说明（**最泛滥的值**） |
| **12px** | 10 | 10% | `.caption` 注释 / badge / 迷你标签 |
| **11px** | 4 | 4% | `.mini-text` 极小字 / tag-pill / eyebrow |

**总计：11 种不同字号，严重碎片化**

### 1.2 发现的具体问题

#### 问题 A：卡片标题三足鼎立
```
.card-title     → 20px (L3658)
.card-header    → 24px (L2635, L2957)
.section-title  → 22px (L518)  ← 实际也是卡片级标题
```
**同一层级的"卡片标题"用了 3 个不同的字号。**

#### 问题 B：副标题身份混乱
```
.subtitle       → 15px (L4146)   ← 偏小，接近正文
.sub-title     → 22px (L4697)   ← 偏大，接近卡片标题
.section-desc  → 14px (L527)    ← 又是另一个值
.page-subtitle  → 引用 --color-ink-secondary 但无独立字号定义
```

#### 问题 C：小字说明过度碎片化
```
13px → 24处（最多）：text-small / 各种辅助说明
14px → 13处：通用文本 / 表格 / 描述
12px → 10处：caption / badge
11px → 4处：mini-text / pill-tag / eyebrow
```
**"次要信息"这个层级被拆成了 4 种字号。**

#### 问题 D：按钮与正文同字号
```
.btn           → 16px
.body-text     → 16px
```
按钮和正文一样大，视觉上缺乏区分。

#### 问题 E：表格层级模糊
```
表头 th        → 无明确统一规则（有的 12px 有的 13px 有的 14px）
表格单元格 td  → 14px 或 13px 或 15px 不等
```

---

## 二、统一排版层级方案

### 2.1 设计原则

1. **Outfit 是宽体** — 同样 px 值视觉上比 Inter/Plus Jakarta Sans 更大更饱满，字号不宜过大
2. **字重已加粗**（500/600/700/800）— 粗体本身有放大效果，字号可适当收紧
3. **层级收敛到 7 级** — 从 11 种压缩到 7 种，每种有唯一语义定位
4. **偶数优先** — 采用 12/14/16/18/20/24/30/36 偶数阶梯，符合设计惯例

### 2.2 排版层级定义

| 层级 | Token 名称 | 字号 | 字重 | 行高 | 字距 | 使用场景 |
|:----:|-----------|:----:|:----:|:----:|:----:|---------|
| **T1** | `--fs-display` | **36px** | 800 | 1.1 | -0.02em | 页面唯一主标题（Dashboard 欢迎语、登录页大标题） |
| **T2** | `--fs-heading` | **24px** | 700 | 1.2 | -0.01em | 分区标题（页面内各区域标题） |
| **T3** | `--fs-title` | **20px** | 700 | 1.25 | 0 | 卡片标题、模块名称、弹窗标题 |
| **T4** | `--fs-body` | **16px** | 500 | 1.5 | 0 | 正文内容、段落、列表项、**按钮文字** |
| **T5** | `--fs-label` | **14px** | 500 | 1.4 | 0 | 表单 label、表格表头、标签文字、描述说明 |
| **T6** | `--fs-caption` | **13px** | 500 | 1.35 | 0 | 辅助注释、时间戳、元数据、"更新于"、placeholder |
| **T7** | `--fs-overline` | **11px** | 600 | 1.2 | 0.06em | Pill 标签、Eyebrow 徽章、Badge、状态点旁文字 |

### 2.3 层级映射对照表（旧 → 新）

| 旧字号 | 新归属层级 | 新字号 | 受影响的选择器举例 |
|--------|----------|--------|------------------|
| 32px | T1 Display | **36px** ↑ | `.page-title` |
| 28px | T2 Heading | **24px** ↓ | `.section-title`（分区大标题降为 heading） |
| 24px | T2 Heading | **24px** → | `.card-header`（归入 heading） |
| 22px | T3 Title | **20px** ↓ | `.sub-title`, `.card-title`(部分) |
| 20px | T3 Title | **20px** → | `.card-title`, `.sidebar-brand strong` |
| 18px | T3 Title | **20px** ↑ | `.large-text`, `.empty-state h3`（升入 title 级） |
| 16px | T4 Body | **16px** → | `.body-text`, `.btn`, 统计数字, 表格 td |
| 15px | T4 Body | **16px** ↑ | `body` 基础, `.subtitle`, 表单输入 |
| 14px | T5 Label | **14px** → | 表格内容, 描述, `.tag` 文字 |
| 13px | T6 Caption | **13px** → | `.text-small`, 辅助说明（保持不变，但语义明确化） |
| 12px | T7 Overline | **11px** ↓ | `.caption`, `.badge`, mini 元素 |
| 11px | T7 Overline | **11px** → | `.mini-text`, `.tag` pill, eyebrow |

### 2.4 特殊场景规则

| 场景 | 规则 | 示例 |
|------|------|------|
| **统计大数字** | T2 Heading + tabular | `¥12,847` 用 24px + `font-feature-settings: "tnum"` |
| **表格表头** | T5 Label + 600 + uppercase | 14px / 半大写 / 字距 0.06em |
| **表格单元格** | T5 Label | 14px（与表头同级，Stripe 风格） |
| **Pill 按钮** | T4 Body | 16px（与 .btn 统一） |
| **Pill 标签** | T7 Overline | 11px / 600 / uppercase |
| **导航菜单** | T4 Body | 16px（激活态加粗至 600） |
| **侧边栏品牌名** | T3 Title | 20px / 700 |
| **空状态主文字** | T3 Title | 20px |
| **空状态副文字** | T5 Label | 14px |
| **Modal 弹窗标题** | T3 Title | 20px |
| **Modal 弹窗内容** | T4 Body | 16px |
| **Toast / 通知** | T5 Label | 14px |
| **Tooltip 提示** | T6 Caption | 13px |
| **Footer 链接** | T6 Caption | 13px |
| **版权信息** | T7 Overline | 11px |

---

## 三、CSS 变量定义（将写入 :root）

```css
/* ===== Typography Scale ===== */
--fs-display:  36px;   /* T1 页面主标题 */
--fs-heading:  24px;   /* T2 分区标题 */
--fs-title:    20px;   /* T3 卡片/模块标题 */
--fs-body:      16px;   /* T4 正文/按钮 */
--fs-label:     14px;   /* T5 表单label/表头/描述 */
--fs-caption:   13px;   /* T6 注释/元数据 */
--fs-overline:  11px;   /* T7 Pill标签/Badge/Eyebrow */

/* 行高 */
--lh-tight:   1.1;
--lh-snug:    1.2;
--lh-normal:  1.35;
--lh-relaxed: 1.5;

/* 字重（配合 Outfit 宽体） */
--fw-bold:     700;
--fw-semibold: 600;
--fw-medium:   500;
```

---

## 四、执行计划

### Step 1：在 `:root` 中添加排版变量（7 个字号 + 4 个行高 + 3 个字重）
### Step 2：替换 body 基础字号 15px → var(--fs-body) 即 16px
### Step 3：按层级批量替换 100 处 font-size 声明：
- T1: `.page-title` 32px → 36px
- T2: `.section-title` 28px → 24px, `.card-header` 24px 保持
- T3: `.card-title` 20/22px → 20px, `.sub-title` 22px → 20px, `.large-text` 18px → 20px
- T4: `.body-text` 16px 保持, `.btn` 16px 保持, `body` 15px → 16px, `.subtitle` 15px → 16px
- T5: 14px 全部保持（已是正确层级）
- T6: 13px 全部保持
- T7: 12px → 11px, 11px 保持
### Step 4：同步更新 HTML 中 Google Fonts 的 Outfit 字重范围
### Step 5：验证无遗漏后提交推送

---

## 五、变更影响面

| 变更类型 | 影响数量 | 风险 |
|---------|---------|------|
| 字号增大（15→16 body） | 全局正文略微变大 | 低，宽体 16px 视觉舒适 |
| 字号减小（28→24 section） | 分区标题缩小 | 低，24px 对 Outfit 700 已足够醒目 |
| 字号增大（18→20 large-text） | 大号文字略增 | 低 |
| 字号减小（12→11 caption） | 注释文字略缩 | 低，11px 在 Retina 屏清晰可读 |
| 字号增大（32→36 page-title） | 主标题更大 | 正向变化，更有冲击力 |

*文档生成时间：2026-06-02*
