# NIHPLOD 肌智派 · 独立微信小程序 PRD

> 版本：v1.2（2026-10-14）
> 状态：**基础设施工毕，工程启动**
> predecessor：《NIHPLOD-肌智派-微信小程序扩展规划.md》v1.0（2026-08，商城分包方案，已作废）
> 关键变更：独立小程序（非商城分包）、全链路走官网 SSO、视觉分析单图化（正脸一张）、AI 引擎 deepseek-flash
> v1.1：购买闭环改为多渠道（微信小店/天猫/抖音/小红书）
> v1.2：认证链路双端实现并部署验证完毕（§2 全部落地）；技术栈定为**原生小程序**；类目已定为「商家自营-美妆」；购买渠道确认为四渠道

---

## 1. 背景与目标

现有「肌智派 AI 测肤」为 Next.js H5 应用（smart.nihplod.cn），承担 SEO 与微信外分享。本期建设**独立微信小程序**，承接微信生态流量，打通"测肤 → 报告 → 多渠道购买"闭环。

**小程序基础信息（已注册）：**
- AppID：`wxb52753aa11ed6654`（原始 ID：`gh_2d9333ca7d66`）
- 主体：旎柏（上海）商贸有限公司（与服务号/H5 微信登录同主体，unionid 可打通）
- 类目：商家自营 - 美妆（经营范围含化妆品批发/零售，匹配）

**目标：**

- 小程序内完成完整测肤：登录（SSO）→ 问卷 → 正脸拍摄（1 张）→ AI 分析 → 报告 → 产品推荐。
- 账号与 H5/官网完全互通：同一官网 User，报告历史三端（小程序/H5/官网会员中心）互见。
- H5 站点保留不动。

**非目标（本期不做）：**

- 自建电商能力（购买走外部渠道，见 §5.4）。
- 4 角度拍摄（产品已改为正脸单图分析，见 §5.2）。
- 活动运营模块（已下线）。

---

## 2. 账号与认证（SSO 打通）—— ✅ 已实现并部署验证（2026-10-14）

### 2.1 架构

小程序**不自建账号体系**，直连官网（IdP）认证；子站只做 token 验证。

```
小程序                     官网（IdP）                                子站（本仓库）
  │ wx.login → code          │                                          │
  │─────────────────────────>│ POST /api/auth/wechat/miniprogram-login │
  │                          │ code2session → openid+unionid           │
  │                          │ 按 unionid 聚合查/建官网 User            │
  │<── access + refresh ─────│ 签发 RS256 OAuth token（aud=wechat-mp-skin）│
  │                                                          │
  │────── Authorization: Bearer <access_token> ────────────> │
  │                                          mpVerifier（独立 audience）
  │                                          JWKS 本地验签 / introspect 兜底
  │
  │ 刷新：POST 官网 /api/oauth/token（grant_type=refresh_token，public client 免 secret）
```

**unionid 打通前提已满足**：小程序与服务号/H5 微信登录同主体（旎柏（上海）商贸有限公司），小程序经服务号快速注册通道创建。微信老用户进小程序自动合并既有账号，报告历史天然互通。手机号绑定后置到真正需要的场景（短信通知/积分兑换），不作为测肤前置条件。

### 2.2 官网侧实现（已上线）

**端点**：`POST /api/auth/wechat/miniprogram-login`（复用既有路由，签发改为 OAuth 口径）

```
请求：{ "code": "wx.login 的 code", "phoneCode": "可选，getPhoneNumber 授权码（一步绑手机号）" }

响应 200：
{
  "success": true,
  "data": {
    "needBinding": false,
    "accessToken": "<RS256 JWT>",     // aud=wechat-mp-skin，有效期 900s
    "refreshToken": "<30d>",
    "expiresIn": 900,
    "user": { "id", "name", "avatarUrl", "membershipLevel", "phoneBound" }
  }
}
未绑手机号：{ "success": true, "data": { "needBinding": true, "bindToken": "..." } }
  → 引导 phoneCode 一键绑定（免短信）或 POST /api/auth/wechat/bind（bindToken+手机号+短信码）
错误：400 WECHAT_AUTH_FAILED（code 无效）/ 403 ACCOUNT_DISABLED / 500 OAUTH_CLIENT_MISSING（client 未配置）
```

**配套 OAuth Client（已建）**：

```
client_id: wechat-mp-skin
类型: Public（硬校验，否则 refresh 401）
scopes: openid profile phone membership birthday profile:write
accessTokenTtlSeconds: 900（硬要求：JWKS 本地验签不感知撤销，靠短 TTL 兜底）
回调 URL: https://smart.nihplod.cn/（占位，流程不使用）
```

**注意**：官网管理后台创建 client 时 client_id 由系统生成，需 SQL 改名（本次已执行：
`UPDATE "OAuthClient" SET "clientId"='wechat-mp-skin', "accessTokenTtlSeconds"=900 ...`）。

**顺带修复**：`/api/v1/internal/wechat/send-template` 的 userId 校验从 `z.string().cuid()`（cuid v1）放宽为 `/^[a-z][0-9a-z]{5,31}$/i`（cuid2 兼容）——修复 2026-10-13 生产故障（u 开头的合法 userId 被误拒，微信模板消息全部发送失败）。

### 2.3 子站侧实现（已上线）

| 改动 | 说明 |
|---|---|
| 独立小程序验签器 | `sso-auth.ts` 新增 `mpVerifier`（audience=`wechat-mp-skin`，可用 `SSO_MP_CLIENT_ID` 覆盖）。子站主验签器强制 audience=子站自身 client_id，小程序 token 必须独立验签器——JWKS 与 introspect 两条路径都不兼容跨 client |
| `getSessionUser` 支持 Bearer | 带 `Authorization: Bearer` 的请求只走 mpVerifier；payload.sub 复用现有 `upsertLocalUser` 建档/会员同步。验证失败直接 null（不回落 Cookie）；无 Authorization 头行为不变 |
| CSRF 豁免 | `verifyCsrfToken` 对 Bearer 请求放行（无浏览器 ambient authority，无 CSRF 面）；Cookie 路径校验不变 |
| 撤销语义 | JWKS 本地验签不感知会话撤销，靠 900s 短 TTL 兜底 |
| 配额/打卡/历史 | 全部按 user.id 工作，零改动 |

### 2.4 小程序端会话管理

- token 对存 `wx.setStorage`（不存 globalData）。
- 请求拦截器：401 → 静默 refresh（官网 `/api/oauth/token` refresh grant）；refresh 失败 → 重新 `wx.login` 走 mp-login。
- 新用户（`phoneBound=false`）：**不强制绑手机号**；仅在需要手机号能力的场景（短信通知等）引导 `getPhoneNumber` 授权，走 mp-login 的 phoneCode 一步绑定（免短信）。

---

## 3. 页面清单与 API 映射

技术栈：**原生小程序**（无跨端需求；VisionKit/CameraContext 等微信原生能力文档最全、无构建链负担）。

| # | 页面 | 说明 | 主要 API |
|---|---|---|---|
| 1 | 首页/入口 | 隐私协议弹窗（首次强制）、入口预检 | `check-config`、`test-limit` |
| 2 | 登录页 | 一键微信登录（mp-login）；手机号按需绑定 | 官网 miniprogram-login |
| 3 | 问卷页 | 单选/多选、条件题、本地暂存 | `GET /api/advisor/questions` |
| 4 | 拍摄页 | 正脸检测 + 自动/手动快门（1 张） | VisionKit、`POST /api/oss/sign` |
| 5 | 分析中页 | 进度展示 + 轮询 | `face-analyze`、`analyze`、`session/status` |
| 6 | 结果页 | 报告、派系形象、产品推荐（多渠道）、客服入口、海报保存 | `products`、`kf-link` |
| 7 | 历史报告页 | 报告列表与详情 | Bearer 直连用户态 API（不走 x-internal-key） |

> 说明：现有 `x-internal-key` 内部接口（mp-skin 等）是服务端间通道；本小程序是**用户身份直连**，一律 Bearer + 现有用户态 API。

---

## 4. 服务端 API 复用清单（零重写）

以下现有 API 直接复用，Bearer 认证已支持（§2.3）：

- `GET /api/advisor/questions`、`check-config`、`test-limit`
- `POST /api/advisor/face-analyze`（视觉分析）、`POST /api/advisor/analyze`（文本报告）、`GET /api/advisor/session/status`
- `POST /api/oss/sign`（照片上传）、`GET /api/products`
- `POST /api/advisor/kf-link`（企业微信客服）
- `POST /api/advisor/analytics/track`（埋点）

---

## 5. 关键方案

### 5.1 人脸采集（已大幅简化）

2026-10-13 起视觉分析只使用**正脸单图**，4 角度状态机、连拍选帧降级、角度复核全部取消。

- **主方案**：VisionKit `detectFace` 检测正脸（yaw/pitch 接近 0）且画面稳定 → 自动快门；VK 不可用 → 手动拍摄。
- **服务端复核**：`face-analyze` 内建 AI validation 即足够（人脸存在性/遮挡/翻拍；2026-10-13 已放宽：背景杂物、光照不均不拒），不需要独立 face-precheck 接口。
- 照片预处理（压缩至 ≤300KB）在小程序端 canvas 完成，逻辑参照 H5 `preprocessFaceImage`。

### 5.2 AI 引擎现状（2026-10-13 起）

| 用途 | 主力 | 兜底 | 单次耗时 | 单次成本 |
|---|---|---|---|---|
| 视觉分析 | deepseek-flash | qwen3-vl-plus（聚合网关） | ~20s | ¥0.02~0.04 |
| 文本报告 | deepseek-flash | qwen-plus | ~30s | ~¥0.03（峰时×2） |

小程序不感知 provider。流量放大后注意：DeepSeek 峰时（北京 9-12/14-18 点）价格翻倍；子站护栏：队列限流 30 并发、预算熔断（日 ¥200）、单用户日限 30 次（管理员自定义用户豁免）。

**篇幅纪律**：deepseek-flash 推理链与正文共享 max_tokens（视觉 5000 / 文本 8000），prompt 已加字数硬约束防止截断（2026-10-13 两次生产截断事故的修复）。

### 5.3 海报生成

- H5 证书图为客户端 canvas 合成（`cert-image.ts`），小程序不可用 → 本期做**服务端 sharp 合成**，H5/小程序共用一套。
- 小程序端 `wx.saveImageToPhotosAlbum` 保存；分享卡片 `onShareAppMessage`。

### 5.4 购买闭环（多渠道）

**前提澄清：不存在商城小程序**（旧规划文档的前提错误）。现有购买渠道四个：微信小店、天猫国际、抖音商城、小红书。

微信生态对跳出有硬限制：小程序间跳转需目标 appid 白名单且弹窗确认；抖音与微信互相屏蔽不可跳；天猫/小红书 App 无法从小程序直接唤起。因此按渠道分级：

| 渠道 | 小程序内落地方式 | 体验 |
|---|---|---|
| 微信小店 | **直跳**（`wx.navigateToMiniProgram`，小店小程序 appid + 商品路径；基础库 2.3.0+ 会弹窗确认）。注意：「商家自营-美妆」类目默认不开放跳入跳出能力，自家小店跳转是否豁免需实测 | 最好，微信内闭环 |
| 天猫国际 / 抖音 / 小红书 | **复制口令/链接**：点击后复制购买口令到剪贴板，引导去对应 App 粘贴打开 | 行业通行做法（淘宝口令模式） |

**结果页推荐卡片设计**：默认主推微信小店（直跳），其余渠道以"复制口令"按钮呈现。产品后台需为每个 SKU 维护各渠道链接/口令（企微客服 bot 已有 `links.json` 短链映射的先例）。

**MVP 建议**：微信小店直跳 + 其余渠道复制口令。web-view H5 商品页作为未配置渠道时的兜底。

> 阶段 0 调研项：微信小店商品路径参数格式（从小店后台商品分享链接提取）；自家小店跳转是否受类目跳出限制；各平台口令文案审核口径。

### 5.5 合规与隐私

- 人脸照片属敏感个人信息：小程序隐私协议弹窗（采集目的/存储周期/删除渠道），首次启动强制同意；**用户隐私保护指引必须显式声明人脸照片采集用途**（AI 测肤类被驳回的最常见原因）。
- 摄像头权限用途声明；相册写入权限使用时申请。
- 类目：商家自营-美妆（已选定）；文案维持护肤建议口径，不涉医疗宣称。
- 报告页沿用"AI 生成仅供参考"类标识（深度合成自评口径）。
- 数据生命周期由现有 data-cleanup cron 统一覆盖。

---

## 6. 分期与工期（1-2 人，MVP 3-4 周）

### 阶段 0：准备 —— ✅ 已完成（2026-10-14）

- ✅ 小程序注册（服务号快速通道，主体一致）、类目（商家自营-美妆）
- ✅ 官网 mp-login OAuth 化 + 部署 + 假 code 验证（微信 invalid code 响应确认链路通）
- ✅ OAuth client `wechat-mp-skin` 建成（Public / 6 scopes / TTL 900）
- ✅ 子站 Bearer 通道部署
- ✅ cuid 校验 bug 修复
- 剩余：request 合法域名（`smart.nihplod.cn` + `nihplod.cn`）、隐私协议备案、微信小店跳转实测

### 阶段 1：MVP（约 2-3 周）

| 周 | 内容 |
|---|---|
| W1 | 工程骨架（token 管理/请求封装）+ 登录 + 问卷 + 结果 + 历史报告 |
| W2 | 拍摄页（VK 检测 + 快门）+ 上传 + 分析对接 + 海报（服务端 sharp） |
| W3 | 隐私合规收尾 + 真机回归（iOS/安卓高低端各 3 款）+ 提审 |

**MVP 验收标准：**

- 完整流程通过率：iOS/安卓各 3 款机型走通"登录→问卷→拍摄→报告"。
- 账号互通：小程序完成的报告在 H5 历史与官网会员中心可见（同 unionid）。
- 分析成功率 ≥ 98%（视觉+文本全链，含兜底切换）。
- 拍摄页中端安卓机（骁龙 7 系同级）人脸检测判定延迟 ≤ 200ms。

### 阶段 2：增强（另排期）

- 订阅消息：报告完成通知、复测提醒（cuid 校验 bug 已修，通道已通）。
- 测肤与会员权益联动（积分/优惠券）。
- 分享裂变：结果海报带小程序码。

---

## 7. 风险清单

| 风险 | 等级 | 对策 |
|---|---|---|
| 审核驳回（人脸敏感信息） | 中 | 隐私指引明示人脸采集 + 非医疗口径；预留 1-2 轮提审 |
| 自营美妆类目限制微信小店直跳 | 中 | 阶段 0 实测；受限则口令/web-view 兜底 |
| 低端机拍摄页卡顿 | 低 | 帧节流；兜底手动拍摄 |
| 流量放大推高 AI 成本 | 低 | 现有预算熔断 + 队列护栏；上线后按 AIUsageLog 复盘 |

---

## 8. 待决策事项

- [x] 开放平台主体：同主体（旎柏（上海）商贸有限公司），unionid 打通 ✅
- [x] 小程序技术栈：**原生** ✅
- [x] 形态：独立小程序 ✅；购买渠道：微信小店直跳 + 三平台口令 ✅
- [x] 官网 mp-login：已实现/部署/验证 ✅（client_id `wechat-mp-skin`）
- [ ] 服务端 sharp 海报是否同步替换 H5 现有 canvas 方案（统一收口）
- [ ] 各 SKU 的四渠道口令/链接数据补全（运营）

---

## 附：与旧规划文档的差异对照

| 项 | 旧规划（2026-08） | 本 PRD |
|---|---|---|
| 形态 | 商城小程序分包 | 独立小程序 |
| 认证 | 子站自建 mp-login + 手机号 | 官网 SSO 直连（miniprogram-login OAuth 化） |
| 拍摄 | 4 角度自动拍摄（核心风险） | 正脸单图（风险已消除） |
| AI 引擎 | OpenAI 视觉 | deepseek-flash / qwen3-vl-plus |
| 服务端复核 | 新增 face-precheck 接口 | 不需要（复用 face-analyze 内建 validation） |
| 购买闭环 | 商城分包内闭环 | 微信小店直跳 + 天猫/抖音/小红书口令 |
| MVP 工期 | 5-7 周 | 3-4 周 |
