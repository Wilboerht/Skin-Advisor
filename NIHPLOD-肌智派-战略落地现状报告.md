# NIHPLOD「肌智派」战略落地现状报告

> 更新：2026-08-18 ｜ 对照《20260818_NIHPLOD 肌智派战略思路》
> 涉及仓库：`skin-advisor-standalone`（主站）、`企业微信服务账号`（wecom-ai-bot）、`nihplod.cn`（官网）

## 一、结论

核心闭环"测肤 → 匹配 → 追踪 + 7×24 AI 顾问"已跑通，数据资产策略（90 天滚动续期 + 冷热分层）已落地。剩余待办仅两项：**P0 三级会员体系（待讨论后实施）、P1 品牌/产品向量数据（未启动）**。营销预案大部分为外部宣发工作，系统侧需支撑的 GEO、分享裂变均已就绪。

## 二、系统架构

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  主站 skin-advisor-standalone │         │  企业微信服务 wecom-ai-bot      │
│  Next.js 16 + Prisma         │         │  Python FastAPI + Redis      │
│  （测肤营销站）                │         │  kf.nihplod.cn               │
│                              │  ①客服链接│  · DeepSeek 多轮对话顾问      │
│  · 问卷+扫脸 AI 测肤          │ ───────▶│  · 知识库 + 人工转接兜底       │
│    (qwen-vl / deepseek-vl)   │ scene=  │  · 用户护肤档案（90 天）       │
│  · 规则引擎产品匹配            │ sessionId│  · 购买短链（9 产品×3 渠道）   │
│  · 肤质档案/趋势对比/提醒       │         │                              │
│  · 分享海报/裂变归因/SEO/GEO   │◀─────── │                              │
│  · 用户体系 + 后台管理         │  ②回调取 │                              │
│                              │  报告摘要 │                              │
└─────────────────────────────┘         └──────────────┬───────────────┘
                                                       │ 企微客服 API
                                                       ▼
                                              用户微信端 1:1 会话
```

## 三、战略逐项对照

### 1. 核心价值 —— 全部 ✅

| 战略项 | 状态 | 落点 |
|---|---|---|
| 1.1 私人肌肤管家系统 | ✅ | 结果页 `AdvisorConsultCard` 入口（复制报告摘要 + 直达企微客服） |
| 1.2 专业免费测肤 | ✅ | 问卷 + 扫脸双通道，AI 视觉分析（队列/熔断/预算工程化完备） |
| 1.2 匹配产品 | ✅ | 规则打分引擎 + 后台规则管理 + 8 肤质 IP |
| 1.2 追踪使用效果 | ✅ | 历史报告、趋势对比、产品反馈 |
| 1.2 持续性肌肤数据资产 | ✅ | 90 天滚动续期 + 冷热分层，2026-08-18 落地（见第四节） |
| 1.2 7×24 AI 顾问 | ✅ | wecom-ai-bot：DeepSeek 多轮对话 + 档案注入 + 人工兜底 |
| 1.3 口号/品牌 | ➖ | 文案层，非代码事项 |

### 2. 会员体系

| 战略项 | 状态 | 说明 |
|---|---|---|
| 2.1 三级会员架构 | ⏸ 待讨论 | 无任何等级/积分数据模型，**讨论后再做** |
| 2.2 权益/玩法设计 | ⏸ 待讨论 | 同上 |
| 2.3 引流下单/转化路径 | ✅ | 电商外链（淘宝/京东/小红书/抖音）+ 企微顾问短链推品 |
| 2.4 品牌/产品向量数据 | ❌ 未启动 | 无 embedding/向量库，纯规则匹配（P1） |
| 2.4 机器人顾问实现 | ✅ | 见 1.2（企微通道） |
| 2.5 用户数据/资产 | ✅ | 行为数据沉淀完整，保留策略已对齐（见第四节） |

### 3. 用户体验

简约高级、逻辑清晰、不强制促销、客观性均符合；依赖性/黏性靠"90 天续期 + 趋势对比 + 顾问档案"支撑，会员体系落地后进一步增强。

### 4. 营销预案 —— 大部分为外部宣发，非系统职责

| 战略项 | 性质 | 系统侧状态 |
|---|---|---|
| 4.4 GEO 大模型收录 | 系统能力 | ✅ llms.txt / sitemap / 结构化数据 / 百度推送 |
| 4.5 分享裂变 | 系统能力 | ✅ 海报生成 + 渠道追踪 + ref 归因 + 注册转化弹窗 |
| 4.2 电商内容联动 | 外部宣发 | 🟡 系统有 affiliate 外链可配合 |
| 4.8 线下联动 | 外部活动 | 🟡 系统有 Campaign 模型 + /gift 活动页可配合 |
| 4.10 白皮书 | 外部宣发 | 🟡 数据在库（冷层脱敏摘要），需要时可导出 |
| 4.1 / 4.3 / 4.6 / 4.7 / 4.9 | 外部宣发 | ➖ 无需系统支持 |

### 5. 运作思路

MVP 阶段对应的系统支撑（4.4 GEO、4.5 裂变）均已就绪；4.1–4.7 其余项为外部宣发动作，不依赖系统开发。

## 四、数据资产落地方案（2026-08-18 已实现）

**策略**：不做永久档案，采用**滚动续期 + 冷热分层**——档案 90 天有效，效期内复测即更新并重置周期。

| 层 | 策略 | 实现 |
|---|---|---|
| 当前档案（企微顾问用） | 90 天滚动，新报告覆盖旧字段 | wecom-ai-bot 本就符合，未改 |
| 当前档案（主站报告） | 注册用户 90 天 / 游客 1 小时；过期报告可查看 + 顶部复测提醒横幅 | `analyze/route.ts`、`reports/[id]/page.tsx` |
| 历史·热层 | 每用户最近 10 条完整报告，用户可见 | `data-cleanup` 归档步骤 |
| 历史·冷层 | 更早的报告就地脱水为脱敏摘要（仅分数/肤质/年龄段/预算等统计字段；过敏史/孕期/医美等敏感字段剔除），用户不可见，供趋势对比与白皮书统计；热+冷合计上限 100 条/用户 | `lib/session-archive.ts` + `data-cleanup` |

改动文件：`prisma/schema.prisma`（新增 `archivedAt` + 迁移）、`src/lib/session-archive.ts`（新增）、`src/app/api/cron/data-cleanup/route.ts`、`src/app/(advisor)/reports/[id]/page.tsx`、`src/app/api/advisor/history/route.ts`、`src/app/api/user/skin-trends/route.ts`（顺带修复取数 bug：取最近 5 次而非最早 5 次）。

验证：tsc ✅ / eslint ✅ / vitest 41 项全过（含 3 项新增归档测试）✅ / 归档 SQL 已对 Postgres 16 冒烟验证 ✅

## 五、缺口与决策记录

| 状态 | 事项 | 说明 |
|---|---|---|
| ⏸ 待讨论 | **三级会员体系**（2.1/2.2，等级/积分/权益 + 新客老客玩法） | 战略留存与转化核心钩子，**讨论后再做** |
| 🟡 P1 | **品牌/产品向量数据**（embedding 检索增强匹配，2.4） | 未启动 |
| 🟢 P2 | 主站应用内 AI 聊天 | 可选；企微通道已覆盖 |
| 🟢 P2 | 白皮书数据导出/挖掘支持 | 可选；冷层数据已在库 |
| ⛔ 已否决 | 微信小铺接入 | 与品牌调性不符；企微短链推品已闭环转化 |
| ⛔ 已否决 | Web Push 主动触达 | 授权率低 + iOS 微信内不可用 + 投入产出不匹配 |
| 🔧 已降级 | 企微档案持久化到数据库 | Redis 档案本质是缓存、可从主站重建；运维确认 Redis 开启 AOF 即可，无需开发 |

## 六、外部依赖与运维待办

| 事项 | 负责方 | 状态 |
|---|---|---|
| 隐私政策同步长期保留条款 | 官网 nihplod.cn | ✅ 已改（`PrivacyContent.tsx` 两处保留条款 + 删除三段 Web Push 描述）；⚠️ 母文档 `NIHPLOD隐私政策.docx` 需人工同步 |
| 生产执行 `prisma migrate deploy`（`archivedAt` DDL） | 运维 | ⏳ 部署时必做；本地库已手动应用 |
| 确认 Redis 开启 AOF 持久化 | 运维 | ⏳ |
| 微信模板消息"档案到期提醒" | 官网 + 主站 | ⏳ 公众平台审核申请中；拿到 template_id 后：官网 `send-template` 扩展多模板 + 主站加 cron（改动均小）。时机：首批用户接近 90 天到期前 |
| 确认 wecom-ai-bot 的 `.env` 未提交进 Git 历史 | 运维 | ⏳ 含真实密钥，如已提交需轮换 |

## 七、风险提醒

1. **密钥**：wecom-ai-bot 仓库 `.env` 含真实密钥（企微 Secret、DeepSeek Key、内部 API Key），需确认未入 Git。
2. **内网鉴权**：两仓库间内部 API 为共享密钥 + HMAC 签名（主站→官网已带时间戳/nonce；主站↔企微为密钥直比），内网调用可接受，知晓即可。
3. **合规**：数据保留策略已与隐私政策对齐（90 天滚动有效期为合规优点，已保留）；后续会员体系上线时隐私政策需再次评审。

## 附：关键文件索引

**主站 skin-advisor-standalone**

| 功能 | 路径 |
|---|---|
| AI 扫脸分析 | `src/app/api/advisor/face-analyze/route.ts` |
| 综合分析（问卷+人脸） | `src/app/api/advisor/analyze/route.ts` |
| AI 提示词 | `src/config/ai-prompts.ts` |
| 产品匹配规则引擎 | `src/lib/recommendations.ts` |
| 肤质趋势对比 | `src/app/api/user/skin-trends/route.ts` |
| 归档脱水逻辑 | `src/lib/session-archive.ts` |
| 数据清理/归档 cron | `src/app/api/cron/data-cleanup/route.ts` |
| 报告页（过期横幅/归档提示） | `src/app/(advisor)/reports/[id]/page.tsx` |
| 企微客服外链 | `src/app/api/advisor/kf-link/route.ts` |
| 报告摘要内部 API | `src/app/api/internal/report-summary` |
| GEO 文件 | `public/llms.txt`、`public/llms-full.txt` |
| 分享海报 | `src/components/advisor/poster/SharePoster.tsx` |

**企微服务 wecom-ai-bot**

| 功能 | 路径 |
|---|---|
| 路由入口 | `src/main.py` |
| 业务逻辑（对话/转人工/订单流程） | `src/core.py` |
| DeepSeek 接入 | `src/ai/deepseek.py` |
| 客服账号/提示词配置 | `kf_accounts.json` |
| 知识库 | `knowledge.txt`、`knowledge_skincare.txt` |
| 测肤报告联动 | `src/advisor_report.py` |
| 会话/档案存储（Redis） | `src/ai/store.py` |
| 购买短链 | `src/links.py` + `links.json` |

**官网 nihplod.cn**

| 功能 | 路径 |
|---|---|
| 隐私政策页 | `src/app/(website)/privacy/PrivacyContent.tsx` |
| 模板消息发送 | `src/lib/wechat-template.ts` |
| 模板消息内部 API（v1 签名鉴权） | `src/app/api/v1/internal/wechat/send-template/route.ts` |
