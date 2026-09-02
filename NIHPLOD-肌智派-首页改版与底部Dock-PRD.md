# NIHPLOD 肌智派 · 首页改版与全端底部 Dock PRD

| 版本 | 日期 | 状态 |
|------|------|------|
| v1.0 | 2026-02 | 待评审 |
| v1.1 | 2026-02 | 评审修订：FAQ 改模态框（保留 /faq 静态页做 SEO）、日记日期时区方案、skin-trends 复用确认、--dock-height 变量、桌面端悬浮胶囊定稿 |
| v1.2 | 2026-02 | M1 实现方案定稿：Dock 根 layout 挂载 + usePathname 自我排除，排除清单扩展至 /admin 与认证页 |
| v1.3 | 2026-02 | 日记页内容定稿：+ 情境标签、连续打卡天数；mood 更名 skinState；明确不做照片打卡/早晚打卡/产品反馈关联 |
| v1.4 | 2026-02 | 日记页新增测肤记录模态框：抽共享组件 TestHistoryList 复用 /api/advisor/history，/profile 区块保留 |
| v1.5 | 2026-02 | 日记历史区升级为时间线视图：合并测肤事件、替换原倒序列表、不显示空日期、近 30 天 + 加载更早、藏青细线左轴 |
| v1.6 | 2026-02 | 登录链路修复：SSO 跳转壳加 8s 超时逃生出口；AuthUrlDetector 上移至根 layout 全局生效；"我的"登录后回跳 /profile；AuthModal 双 dialog 改断点条件渲染 |

## 1. 背景与问题

当前首页为"一屏居中大字 + 单按钮"的极简落地页，存在以下问题：

- **信息密度过低**：首屏只有标题和一个按钮，空间浪费，缺乏设计感与品牌记忆点
- **导航模式老旧**：顶部导航栏 + 移动端汉堡菜单，不符合移动端为主的产品形态
- **内容无出口**：8 个肌智派 IP 形象已有详情页（/skin-types），但首页没有任何引导入口
- **活动入口突兀**：原右下角悬浮卡片已被移除，活动需要更自然的融入方式

## 2. 目标

| 目标 | 衡量指标 |
|------|----------|
| 首页从单一落地页升级为"品牌主视觉 + 内容矩阵" | 首屏点击率提升 |
| 导航 App 化，全端统一底部 Dock | 移动端页面跳转步数减少 |
| 新增护肤日记，建立用户留存钩子 | 日记页访问与打卡行为产生 |

## 3. 范围

### 3.1 做（In Scope）

1. **全端底部 Dock**（移动端 + 桌面端统一）
2. **首页改版**：主视觉卡 + 派系卡片墙 + 活动胶囊入口 + FAQ 模态框入口
3. **新建护肤日记页**（/diary）：每日打卡 + 测肤趋势
4. **移除顶部导航栏**：所有内容页（测评流程页除外，见 3.2）
5. **FAQ 模态框化**：FAQ 内容改为首页触发的模态框；`/faq` 静态页保留（仅作 SEO 入口，见 4.4）

### 3.2 不做（Out of Scope）

- 测评流程页（/questions、/face-scan、/result、/reports）保持沉浸式布局，**不出现 Dock，不做任何改动**；结果详情页对 `WebsiteNavbar`（variant="dark"）的引用保留，勿随顶栏移除误删
- 不引入参考稿的紫色/黄色配色，坚持米白 + 藏青品牌色
- 不新增图片素材，派系形象复用现有 `/images/character/*`
- 管理后台（/admin）不动
- "测肤有礼"活动不进入 Dock，保留首页胶囊入口
- "探索旎柏"外链从导航中移除（可在后续版本并入"我的"页面）
- **`/faq` 路由不删除**：sitemap.ts、robots.ts、baidu-push.ts、proxy.ts 中的相关条目全部保持现状（SEO 基础设施不动）

## 4. 详细设计

### 4.1 全端底部 Dock

**位置与层级**
- `position: fixed` 底部贴边，全端统一（桌面端也是底部，悬浮胶囊样式，已定稿）
- z-index：新增全局变量 `--z-dock: 100000`（与被移除的 `--z-navbar` 同级，低于 `--z-modal: 100100`，高于内容；测评/结果页不渲染 Dock，无层级冲突）
- 底部适配 `env(safe-area-inset-bottom)`（iPhone Home 指示条）

**尺寸规范（新增）**
- Dock 高度定义为 CSS 变量 `--dock-height`（初值约 64px，含图标 + 文字）
- 各内容页底部留白统一为 `padding-bottom: calc(var(--dock-height) + env(safe-area-inset-bottom) + 16px)`，后期调高度只改变量，不逐页改

**Tab 构成（4 个，平铺，无中间凸起）**

| Tab | 图标（lucide） | 目标 | 说明 |
|-----|------|------|------|
| 在线测肤 | ScanFace | / | 首页 |
| 护肤日记 | NotebookPen | /diary | 新建页面，见 4.3 |
| 了解肌智派 | Sparkles | /skin-types | 派系列表 |
| 我的 | CircleUserRound | /profile | 未登录时打开登录弹窗（复用 AuthModal），登录后进个人中心 |

**实现方案（v1.2 定稿）**
- 组件：`src/components/website/BottomDock.tsx`（与 `WebsiteNavbar`、`SiteFooter` 同级，属全站 chrome）
- 挂载：根 layout `src/app/layout.tsx` 的 `<body>` 内、`<AuthModal />` 旁，**置于 `<main>` 之外**（避开 `<main>` 上 `pointer-events-none [&>*]:pointer-events-auto` 的 hack）
- 排除方式：组件内 `usePathname()` 自我排除（"默认接入、显式排除"，新增沉浸式页面只需加一行前缀），命中即 `return null`：

```ts
const HIDDEN_PREFIXES = ["/questions", "/face-scan", "/result", "/reports", "/wechat", "/admin", "/login", "/register", "/forgot-password", "/reset-password"];
```

- 高亮逻辑：首页 tab 用 `pathname === "/"` 精确匹配，其余 tab 用 `startsWith`（如 `/skin-types/[type]` 详情页高亮"了解肌智派"）

**行为规则**
- 当前页面对应 tab 高亮（藏青实心），其余 50% 透明度
- 不渲染 Dock 的页面（v1.2 扩展）：测评流程页（/questions、/face-scan、/result、/reports/*）、登录回调页（/wechat/*）、管理后台（/admin/*）、认证全屏页（/login、/register、/forgot-password、/reset-password）
- 每个 tab 触摸区域 ≥ 48×48px，带 `aria-current="page"` 语义
- 桌面端 Dock 居中限宽（max-w-md），视觉上为悬浮胶囊条

**连带改动**
- 移除内容页的 `WebsiteNavbar`（首页、/skin-types、/profile；/faq 页保留顶栏还是同步移除，实施时按"内容页统一无顶栏"处理——/faq 仅作 SEO 入口，从导航消失后顶栏无存在必要，一并移除，页面顶部改为正常 padding）
- 顶栏功能盘点（已核实无静默损失）：导航链接 → Dock 覆盖；登录入口 → Dock"我的"tab 覆盖；非首页的"首页"返回链接 → Dock 首 tab 覆盖；"探索旎柏" → 按 3.2 移除
- 各内容页顶部留白从"为顶栏预留"改为正常 padding；底部留白按上方 `--dock-height` 规范
- 移动端汉堡抽屉菜单随之废弃删除

### 4.2 首页改版

**结构（自上而下）**

1. **品牌区**（保留）：肌智派印章徽标 + "在线 AI 测肤"大标题
2. **主视觉卡（新增）**：藏青底（`brand-charcoal`）大圆角卡片
   - 左侧：标题"开始完整肌肤检测" + 三个卖点（2-5 分钟 · 10 维精准检测 · 1 份专属报告）+ 白色描边胶囊按钮
   - 右侧：肌智派 IP 形象图（复用现有 webp，如 guardian_female）
   - 整卡可点击，触发现有 `handleStart` 流程（隐私同意 → 问卷）
   - hover：微浮起 + 阴影加深；reduced-motion 降级为无动画
   - 移动端：纵向排布（文案上、形象图下）；桌面端：左右排布
3. **活动胶囊（升级）**：现有"测肤有礼 · 参与赢好礼"文字链升级为描边胶囊样式，位置在主视觉卡下方，点击打开 GiftModal（逻辑不变）
4. **FAQ 入口（新增，v1.1）**：与活动胶囊同级的描边文字链/胶囊（如"常见问题"），位置紧邻活动胶囊，点击打开 FAQ 模态框（见 4.4）；样式与活动胶囊保持同一视觉层级，不占主视觉
5. **派系卡片墙（新增）**
   - 标题："八大肌智派，你是哪一派？"
   - 8 张卡片：派系名 + IP 形象图 + 一句话标签
   - 数据来源：`src/lib/result-content.ts` 的 `skinTypes` + `routeOrder`
   - 移动端横向滑动（snap scroll），桌面端 4 列网格
   - 点击跳转 `/skin-types/[type]` 详情页
6. **页脚**（保留现状）：SiteFooter 同款版权 + 链接 + 备案

### 4.3 护肤日记页（/diary）

**页面结构（v1.3 定稿）**

1. **顶部**：页面标题"护肤日记" + 一句话副标题
2. **今日打卡卡**（核心功能）：
   - 肌肤状态选择：5 档图标（很好 / 不错 / 一般 / 较差 / 爆痘敏感）
   - 情境标签（可选，固定 chip 多选）：熬夜 / 换季 / 生理期 / 换了新产品
   - 备注输入框（可选，≤200 字）
   - 提交按钮；已登录直接提交，未登录弹登录框（复用 AuthModal）
   - 当日已打卡则显示"今日已记录"状态 + 允许修改
   - 卡上显示连续打卡天数（"已连续记录 N 天"，由 DiaryEntry 数据推导，无需额外表字段）
3. **测肤趋势区**：复用现有 `/api/user/skin-trends` 数据
   - 近 5 次测肤综合评分的折线趋势（或简化柱状）
   - **接口已核实可直接复用，零后端改动**：返回 `{ dates, scores, dimensions }`（近 5 次、时间正序，`scores` 即 `overallScore` 数组）；测肤记录 < 2 次时返回 `data: null` + "Not enough data"，前端据此渲染"完成 2 次测肤后解锁趋势"引导卡，无需加聚合参数
   - 标题行右侧放"测肤记录"按钮（History 图标），点击打开测肤记录模态框（见下）
4. **历程时间线（v1.5，替换原"历史记录列表"）**
   - 垂直时间线：左轴为日期列（星期 + 日号，藏青文字 + 细竖线，不做深色块），右侧为当日事件条目，按日期倒序
   - 合并两类事件：日记打卡（状态图标 + 备注摘要 + 标签，色点按肌肤状态着色：很好绿 → 爆痘敏感红）；测肤里程碑（数据源 `/api/advisor/history`，"完成测肤 · N 分 · 派系"，藏青实心标记，点击进 /reports/[id] 详情）
   - 今天永远在最上方：无打卡则显示"今天还没记录"引导态 + 快捷打卡入口（滚动回打卡卡）
   - 空日期不渲染；跨月时插入月份分隔行
   - 范围：接口已有近 90 天数据，首屏只渲染近 30 天，底部"加载更早的记录"按钮展开全部

**测肤记录模态框（v1.4 新增）**
- 数据：复用现有 `/api/advisor/history`（分页、排除冷层归档，零 API 改动）；列表项含派系/评分/日期/关注点，点击跳 `/reports/[sessionId]` 详情页
- 实现：从 `ProfileClient.tsx` 抽共享组件 `TestHistoryList`（含数据拉取与分页逻辑），`/profile` 与 `/diary` 模态框共用，单点维护
- 模态框复用现有模态体系（焦点圈定、滚动锁、Esc 关闭，同 AuthModal/GiftModal/FaqModal）
- 未登录：按钮正常显示，点击弹 AuthModal 登录引导
- **/profile 的测肤记录区块保留不动**（个人中心定位是数据总览；共享组件后双处维护成本为零）

**明确不做（v1.3 定稿，含远期规划）**
- ~~照片打卡~~：与"照片不存储"的品牌隐私承诺冲突
- ~~早晚护肤打卡~~：不接推送提醒就是半个功能，且打卡模型需从"每日一条"改为"每日两条"，不做
- ~~关联产品反馈~~：属于"我的"页/报告页延伸，非日记核心

**数据模型（新建）**

```prisma
model DiaryEntry {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date          // 打卡日期（每日一条，时区语义见下）
  skinState String                     // great / good / normal / bad / terrible（肌肤状态，非心情）
  tags      Json?                      // 情境标签 string[]：["熬夜", "换季", "生理期", "换了新产品"]
  note      String?  @db.VarChar(200)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId])
}
```

**日期时区方案（v1.1 定稿）**
- 客户端提交时携带本地日期字符串（`YYYY-MM-DD`，由用户设备时区生成）
- 服务端以该日期字符串为准入库（按 UTC 零点存储该日历日），"当日是否已打卡"的判断与 upsert 键均使用此客户端日期
- 不依赖服务器时区，避免跨时区用户"当日"判断漂移

**API（新建）**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user/diary` | GET | 获取当前用户日记列表（近 90 天），需登录 |
| `/api/user/diary` | POST | 创建/更新当日打卡（请求体携带 `date: YYYY-MM-DD` 客户端本地日期，upsert by userId+date），需登录，限流 20 次/分 |
| `/api/user/skin-trends` | GET | 现有接口复用，趋势图数据源（无需改动） |

未登录访问 /diary：页面正常渲染，打卡区和趋势区显示"登录后记录你的护肤日记"引导卡 + 登录按钮。

### 4.4 FAQ 模态框（v1.1 新增）

**背景**：FAQ 从独立页面改为首页触发的模态框，为 Dock 四 tab 结构让位；但 `/faq` 静态页保留——它带 `FAQPageSchema` 结构化数据（搜索富摘要）、canonical，且已被 sitemap.ts / robots.ts（5 条 allow 规则）/ baidu-push.ts / proxy.ts 引用，删除代价大、SEO 损失明确。

**方案**
- FAQ 数据抽离：`src/app/faq/page.tsx` 中的 `faqs` 数组抽到共享文件（如 `src/lib/faq-data.ts`），页面与模态框共用同一份数据源，单点维护
- `FaqModal` 组件：复用现有模态框体系（焦点圈定 useFocusTrap、滚动锁 useBodyScrollLock、Esc 关闭，参考 AuthModal/GiftModal 模式），内容区可滚动，手风琴展开样式与原 `<details>` 列表一致
- 触发入口：首页 FAQ 描边文字链（见 4.2 第 4 项）
- `/faq` 静态页：保留路由与全部 SEO 元数据不动，仅从站内导航/页脚入口中移除（现状页脚本就无 FAQ 链接，顶栏菜单将整体废弃，无额外摘除工作）

## 5. 非功能需求

- **性能**：派系墙图片懒加载（`loading="lazy"`，首屏主视觉卡内图除外）；Dock 不打入测评流程页面的包
- **无障碍**：Dock 使用 `<nav aria-label="主导航">`；tab 使用链接语义 + `aria-current`；reduced-motion 下所有浮起动画降级；FAQ 模态框遵循焦点管理与 Esc 关闭规范
- **响应式**：Dock 全端底部；派系墙移动端横滑、桌面端网格
- **兼容**：iOS safe-area 全适配；不支持 Dock 时页面内容仍可完整滚动访问

## 6. 验收标准

1. 移动端 + 桌面端所有内容页底部出现 4-tab Dock，当前页高亮正确
2. 测评流程页（问卷/扫脸/结果/报告）无 Dock、无顶部栏，与现状完全一致（含结果详情页的深色顶栏引用不受影响）；/admin 与 /login、/register 等认证页同样无 Dock、行为不变
3. 首页首屏可见藏青主视觉卡，点击可进入测评流程
4. 派系墙 8 张卡片可正常跳转详情页，移动端可横滑
5. 首页 FAQ 入口可打开模态框，内容与 /faq 页一致（共用数据源）；直接访问 /faq 静态页仍正常渲染且 SEO 元数据完整
6. /diary 未登录显示引导；登录后可打卡、当日重复打卡为更新而非报错（以客户端本地日期为"当日"判据）
7. 趋势区在测肤记录 ≥2 次时显示折线，否则显示引导文案；趋势区"测肤记录"按钮可打开记录模态框，列表与 /profile 数据一致，点击可进报告详情；/profile 原测肤记录区块功能不变
8. /diary 历史区为时间线视图：日记与测肤事件按日合并倒序、今天置顶（含未打卡引导）、空日期不渲染、首屏近 30 天可"加载更早"、测肤条目可跳报告详情
8. 各内容页底部留白通过 `--dock-height` 变量实现，无内容被 Dock 遮挡
9. `tsc --noEmit` 0 错误，`eslint` 0 错误，`npm run build` 成功
10. 移动端 390px 与桌面端 1440px 截图复核无布局溢出

## 7. 里程碑

| 阶段 | 内容 | 产出 |
|------|------|------|
| M1 | BottomDock 组件 + `--dock-height`/`--z-dock` 变量 + 全站接入 + 移除顶栏 | 导航切换完成 |
| M2 | 首页改版（主视觉卡 + 派系墙 + 活动胶囊 + FAQ 模态框） | 新首页上线 |
| M3 | /diary 页面 + Prisma 模型 + API（可与 M2 并行，不依赖首页） | 日记功能可用 |
| M4 | 验证（构建 + 截图）+ 文档更新 | 交付 |

## 8. 开放问题

1. ~~日记"打卡提醒"是否接入现有 ReminderSettings / 推送体系~~（v1.3 已定稿：不做，早晚打卡功能整体砍掉）
2. ~~桌面端 Dock 的视觉效果~~（v1.1 已定稿：悬浮胶囊，上线后看反馈再调）
