# NIHPLOD 肌智派 · 独立微信小程序 PRD

> 版本：v1.1（2026-10-13）
> 状态：待评审
>  predecessor：《NIHPLOD-肌智派-微信小程序扩展规划.md》v1.0（2026-08，商城分包方案，已作废）
> 关键变更：独立小程序（非商城分包）、全链路走官网 SSO、视觉分析已单图化（正脸一张）、AI 引擎已切换 deepseek-flash
> v1.1 修正：不存在商城小程序（旧规划前提错误），现有电商载体为**微信小店**；购买闭环方案重写（§5.4）

---

## 1. 背景与目标

现有「肌智派 AI 测肤」为 Next.js H5 应用（smart.nihplod.cn），承担 SEO 与微信外分享。本期建设**独立微信小程序**，承接微信生态流量，打通"测肤 → 报告 → 微信小店购买"闭环。

**目标：**

- 小程序内完成完整测肤：登录（SSO）→ 问卷 → 正脸拍摄（1 张）→ AI 分析 → 报告 → 产品推荐。
- 账号与 H5/官网完全互通：同一官网 User，报告历史三端（小程序/H5/官网会员中心）互见。
- H5 站点保留不动。

**非目标（本期不做）：**

- 自建电商能力（购买跳微信小店/H5，见 §5.4）。
- 4 角度拍摄（产品已改为正脸单图分析，见 §5.2）。
- 活动运营模块（已下线）。

---

## 2. 账号与认证（SSO 打通）

### 2.1 架构决策

小程序**不自建账号体系**，直连官网（IdP）认证；子站只做 token 验证，不参与登录流程。

```
小程序                     官网（IdP）                     子站（本仓库）
  │ wx.login → code          │                               │
  │─────────────────────────>│ POST /api/auth/mp-login       │
  │                          │ 微信 code2Session →           │
  │                          │ openid + unionid              │
  │                          │ 按 unionid 查/建官网 User      │
  │<── access + refresh ─────│ 签发与网页 SSO 同密钥的 token 对 │
  │                                                          │
  │────── Authorization: Bearer <access_token> ────────────> │
  │                                              sso-verify 本地验签
  │                                              （JWKS，已有能力）
```

**关键前提：小程序与 H5 微信登录必须挂同一开放平台主体**，unionid 一致，微信老用户进小程序自动合并到既有账号，报告历史天然互通。主体不一致则降级为手机号绑定合并（首次测肤前强制 `getPhoneNumber`）。

### 2.2 官网侧新增接口（契约设计）

官网仓库（NIHPLOD-Homepage.CN）新增一个端点，复用现有 JWT 密钥体系与 User 表：

```
POST /api/auth/mp-login
Content-Type: application/json

请求：
{
  "code": "wx.login 的 code",        // 必填
  "appid": "小程序 appid",           // 必填，服务端校验白名单
  "nickname": "可选", "avatarUrl": "可选"   // 授权后补充
}

响应 200：
{
  "success": true,
  "data": {
    "accessToken": "<RS256 JWT，15min>",     // 与网页 SSO 同签名密钥/JWKS
    "refreshToken": "<30d>",
    "expiresIn": 900,
    "user": {
      "id": "cuid2",
      "name": "...", "avatarUrl": "...",
      "membershipLevel": "REGULAR|SILVER|GOLD|DIAMOND",
      "phoneBound": true | false              // 前端据此决定是否强制绑手机号
    }
  }
}

错误：
400 MP_CODE_INVALID     code 无效/过期
403 MP_APPID_REJECTED   appid 不在白名单
503 WECHAT_API_DOWN     微信服务端不可用
```

配套要求：

- token 刷新：复用/适配现有 refresh 机制，小程序为 public client（无 secret），refresh 端点需接受无 client_secret 的刷新（或以 appid 白名单代替）。
- 顺带修复既有 bug：`/api/v1/internal/wechat/send-template` 的 userId 校验正则是 cuid v1（`/^c[0-9a-z]{6,}$/i`），而官网现役 ID 已是 cuid2（任意字母开头 24 位）——放宽为 `/^[a-z][0-9a-z]{5,31}$/i`。（2026-10-13 生产故障确认）

### 2.3 子站侧改动（本仓库，改动小）

| 改动 | 说明 |
|---|---|
| `getSessionUser` 支持 Bearer | 现仅认 `__Host-nihplod_sso_at` Cookie；新增 `Authorization: Bearer` 通道，走现有 ssoVerifier（JWKS 本地验签优先，introspection 兜底） |
| CSRF 豁免边界 | Bearer 凭据无 Cookie  ambient authority，天然无 CSRF 面；仅豁免 Bearer 路径，Cookie 路径校验不变 |
| 配额/打卡/历史 | 全部按 user.id 工作，零改动 |

### 2.4 小程序端会话管理

- token 对存 `wx.setStorage`（不存 globalData）。
- 请求拦截器：401 → 静默 refresh；refresh 失败 → 重新 `wx.login` 走 mp-login。
- 新用户（`phoneBound=false`）首次测肤前强制 `getPhoneNumber` 授权绑定（调官网绑号接口，并入 `User.phoneNumber` 体系）。

---

## 3. 页面清单与 API 映射

| # | 页面 | 说明 | 主要 API |
|---|---|---|---|
| 1 | 首页/入口 | 隐私协议弹窗（首次强制）、入口预检 | `check-config`、`test-limit` |
| 2 | 登录页 | 一键微信登录（mp-login）+ 手机号绑定 | 官网 mp-login / 绑号接口 |
| 3 | 问卷页 | 单选/多选、条件题、本地暂存 | `GET /api/advisor/questions` |
| 4 | 拍摄页 | 正脸检测 + 自动/手动快门（1 张） | VisionKit、`POST /api/oss/sign` |
| 5 | 分析中页 | 进度展示 + 轮询 | `face-analyze`、`analyze`、`session/status` |
| 6 | 结果页 | 报告、派系形象、产品推荐、客服入口、海报保存 | `products`、`kf-link` |
| 7 | 历史报告页 | 报告列表与详情 | `GET /api/internal/test-history` 等（Bearer 直连，不走 x-internal-key） |

> 说明：现有 `x-internal-key` 内部接口（mp-skin 等）是商城小程序的服务端间通道；本小程序是**用户身份直连**，一律 Bearer + 现有用户态 API，不复用内部接口模式。

---

## 4. 服务端 API 复用清单（零重写）

以下现有 API 直接复用，仅需支持 Bearer 认证（见 §2.3）：

- `GET /api/advisor/questions`、`check-config`、`test-limit`
- `POST /api/advisor/face-analyze`（视觉分析，deepseek-flash 主力 / qwen3-vl-plus 兜底）
- `POST /api/advisor/analyze`（文本报告）、`GET /api/advisor/session/status`
- `POST /api/oss/sign`（照片上传）、`GET /api/products`
- `POST /api/advisor/kf-link`（企业微信客服）
- `POST /api/advisor/analytics/track`（埋点）

---

## 5. 关键方案

### 5.1 人脸采集（已大幅简化）

2026-10-13 起视觉分析只使用**正脸单图**，原规划的 4 角度状态机、连拍选帧降级、角度复核全部取消。

- **主方案**：VisionKit `detectFace` 检测正脸（yaw/pitch 接近 0）且画面稳定 → 自动快门；VK 不可用 → 手动拍摄。
- **服务端复核**：`face-analyze` 已有的 AI validation（人脸存在性/遮挡/翻拍拦截，2026-10-13 已放宽：背景杂物、光照不均不拒）即足够，**不需要独立 face-precheck 接口**。
- 照片预处理（压缩至 ≤300KB）在小程序端 canvas 完成，逻辑参照 H5 `preprocessFaceImage`。

### 5.2 AI 引擎现状（2026-10-13 起）

| 用途 | 主力 | 兜底 | 单次耗时 | 单次成本 |
|---|---|---|---|---|
| 视觉分析 | deepseek-flash | qwen3-vl-plus（聚合网关） | ~20s | ¥0.02~0.04 |
| 文本报告 | deepseek-flash | qwen-plus | ~30s | ~¥0.05（峰时×2） |

小程序不感知 provider，全部走子站现有链路。流量放大后注意：DeepSeek 峰时（北京 9-12/14-18 点）价格翻倍；子站有队列限流（30 并发）与预算熔断（日 ¥200）护栏。

### 5.3 海报生成

- H5 证书图为客户端 canvas 合成（`cert-image.ts`），小程序不可用 → 本期做**服务端 sharp 合成**，H5/小程序共用一套。
- 小程序端 `wx.saveImageToPhotosAlbum` 保存；分享卡片 `onShareAppMessage`。

### 5.4 购买闭环（多渠道）

**前提澄清：不存在商城小程序**（旧规划文档的前提错误）。现有购买渠道四个：微信小店、天猫国际、抖音商城、小红书。

微信生态对跳出有硬限制：小程序间跳转需目标 appid 白名单且弹窗确认；抖音与微信互相屏蔽不可跳；天猫/小红书 App 无法从小程序直接唤起。因此按渠道分级：

| 渠道 | 小程序内落地方式 | 体验 |
|---|---|---|
| 微信小店 | **直跳**（`wx.navigateToMiniProgram`，小店小程序 appid + 商品路径；基础库 2.3.0+ 会弹窗确认） | 最好，微信内闭环 |
| 天猫国际 / 抖音 / 小红书 | **复制口令/链接**：结果页点击后复制购买口令到剪贴板，引导用户去对应 App 粘贴打开 | 行业通行做法（淘宝口令模式） |

**结果页推荐卡片设计**：每个推荐产品给出渠道选择——默认主推微信小店（直跳），其余渠道以"复制口令"按钮呈现。产品后台需为每个 SKU 维护各渠道链接/口令（企微客服 bot 已有 `links.json` 短链映射的先例，可复用该数据维护模式）。

**MVP 建议**：微信小店直跳 + 其余渠道复制口令。web-view H5 商品页作为未配置渠道时的兜底。

> 阶段 0 调研项：微信小店小程序的商品路径参数格式（从你小店后台的商品分享链接提取）；口令文案规范（各平台对诱导性口令的审核口径）。

### 5.5 合规与隐私

- 人脸照片属敏感个人信息：小程序隐私协议弹窗（采集目的/存储周期/删除渠道），首次启动强制同意。
- 摄像头权限用途声明；相册写入权限使用时申请。
- 类目：美妆/工具；文案维持护肤建议口径，不涉医疗宣称。
- 数据生命周期由现有 data-cleanup cron 统一覆盖。

---

## 6. 分期与工期（1-2 人，MVP 3-4 周）

### 阶段 0：准备（约 1 周）

- 小程序注册、类目、隐私协议备案、request 合法域名。
- 确认开放平台主体（unionid 打通前提）。
- 官网 `mp-login` 端点开发 + 子站 Bearer 通道开发 + 联调。
- VisionKit 正脸检测 PoC（权重已降低，1-2 天）。

### 阶段 1：MVP（约 2-3 周）

| 周 | 内容 |
|---|---|
| W1 | 登录 + 问卷 + 结果 + 历史报告（纯 API 对接与 UI） |
| W2 | 拍摄页（VK 检测 + 快门）+ 上传 + 分析对接 + 海报（服务端 sharp） |
| W3 | 隐私合规收尾 + 真机回归（iOS/安卓高低端各 3 款）+ 提审 |

**MVP 验收标准：**

- 完整流程通过率：iOS/安卓各 3 款机型走通"登录→问卷→拍摄→报告"。
- 账号互通：小程序完成的报告在 H5 历史与官网会员中心可见（同 unionid/手机号）。
- 分析成功率 ≥ 98%（视觉+文本全链，含兜底切换）。
- 拍摄页中端安卓机（骁龙 7 系同级）人脸检测判定延迟 ≤ 200ms。

### 阶段 2：增强（另排期）

- 订阅消息：报告完成通知、复测提醒（注意先修 §2.2 的 cuid 校验 bug）。
- 测肤与会员权益联动（积分/优惠券）。
- 分享裂变：结果海报带小程序码。

---

## 7. 风险清单

| 风险 | 等级 | 对策 |
|---|---|---|
| 审核驳回（人脸敏感信息） | 中 | 隐私协议明示 + 非医疗口径；预留 1-2 轮提审 |
| 开放平台主体不一致 → unionid 打不通 | 中 | 启动前确认；降级为手机号绑定合并 |
| 官网 mp-login 排期阻塞（跨仓库依赖） | 中 | 阶段 0 最先启动；契约见 §2.2 |
| 低端机拍摄页卡顿 | 低 | 帧节流；兜底手动拍摄 |
| 流量放大推高 AI 成本 | 低 | 现有预算熔断 + 队列护栏；上线后按 AIUsageLog 复盘 |

---

## 8. 待决策事项

- [ ] 开放平台主体确认（unionid 打通 or 手机号合并）。**建议 unionid 优先**：新小程序绑定到现有开放平台账号（open.weixin.qq.com → 管理中心 → 绑定小程序），与 H5 微信登录/服务号同主体即可自动合并；手机号绑定后置到真正需要它的场景（短信通知/积分兑换），不作为测肤前置条件
- [ ] 购买闭环已定方向：微信小店直跳 + 天猫/抖音/小红书复制口令（§5.4）；待办：小店商品路径格式调研、各 SKU 的渠道口令数据补全
- [ ] 小程序技术栈：原生 vs Taro（独立工程后两者皆可，原生更轻）
- [ ] 官网 `mp-login` 开发与发版排期（跨团队/跨仓库依赖）
- [ ] 服务端 sharp 海报是否同步替换 H5 现有 canvas 方案（统一收口）

---

## 附：与旧规划文档的差异对照

| 项 | 旧规划（2026-08） | 本 PRD |
|---|---|---|
| 形态 | 商城小程序分包 | 独立小程序 |
| 认证 | 子站自建 mp-login + 手机号 | 官网 SSO 直连（mp-login 在官网侧） |
| 拍摄 | 4 角度自动拍摄（核心风险） | 正脸单图（风险已消除） |
| AI 引擎 | OpenAI 视觉 | deepseek-flash / qwen3-vl-plus |
| 服务端复核 | 新增 face-precheck 接口 | 不需要（复用 face-analyze 内建 validation） |
| MVP 工期 | 5-7 周 | 3-4 周 |
