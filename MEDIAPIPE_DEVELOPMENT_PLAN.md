# 深度护肤顾问系统升级计划：MediaPipe VIP 专属 AR 分析引擎

## 1. 项目愿景与技术分层策略
本项目旨在通过 **高精度 CV (Computer Vision)** 与 **AR (Augmented Reality)** 技术，为 VIP 用户提供超越竞品的“在此即彼”的可视化诊断体验。

### 技术架构分层
| 层级 | 目标用户 | 核心技术栈 | 功能描述 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **基础层** | 所有用户 | **`@vladmandic/face-api`** | 68点面部检测、自动拍照、基础裁剪 | ✅ 已就绪 (`FaceCapture.tsx`) |
| **高级层** | **VIP 专属** | **MediaPipe Face Mesh** | **468点高精度网格**、AR热力图、法令纹/泪沟深度分析 | ✅ **已就绪** |

---

## 2. 核心功能差异 (Free vs VIP)

| 功能模块 | 普通用户 (Free) | VIP 用户 (Pro) | 实现差异 |
| :--- | :--- | :--- | :--- |
| **可视化诊断** | 静态图 + 基础框选 | **动态 AR 热力图** (T区油光、红区高亮) | Canvas 渲染层级不同 |
| **五官分析** | 文字描述 | **高精度轮廓线** (眼袋、法令纹、脸型) | 468点 vs 无 |
| **交互体验** | 单向查看报告 | **点击交互** (点击"痘痘"高亮对应区域) | 交互式 Canvas |
| **流量消耗** | **0 MB** (不加载模型) | ~10 MB (MediaPipe 模型) | **完全隔离** |

---

## 3. 详细实施计划 (Actionable Roadmap)

### ✅ 第一阶段：基础设施与权限体系 (已完成)
- [x] **Schema 设计**：`User` 表 `role` 字段已就绪 (需新增 `vipExpiresAt`)。
- [x] **鉴权逻辑**：`/api/auth/me` 和 `useAuth()` Hook 已能够返回用户 Role。
- [x] **基础 CV**：`FaceCapture` 组件已集成了 `face-api` 用于基础拍照。

### ✅ 第二阶段：高级 CV 引擎集成 (MediaPipe) - 已完成
**目标**：引入 MediaPipe Face Mesh (468点) 并确保本地化运行。

1.  - [x] **资源本地化**：
    *   `@mediapipe/tasks-vision` 已安装。
    *   `face_landmarker.task` (3.6MB) → `public/models/mediapipe/`
    *   `vision_wasm_internal.wasm` (10.9MB) → `public/models/mediapipe/wasm/`

2.  - [x] **工具库封装 (`src/lib/mediapipe-utils.ts`)**：
    *   **单例模式**：`initFaceLandmarker()` 支持并发安全。
    *   **核心 API**：`detectFaceMesh(imageSource)` 返回 468 点数据。

### ✅ 第三阶段：高精度 AR 热力图引擎 (2.0) - 已完成
**目标**：构建“影视级”面部热力图，支持多维度切换，且过渡自然细腻（最高精度方案）。

1.  - [x] **区域三角剖分与 HSL 引擎 (`src/lib/face-zones.ts`)**：
    *   **核心算法**：不使用粗糙多边形，采用 **Triangle Mesh Tessellation**（三角形逐面着色）。
    *   **区域定义**：建立 468 个顶点 -> 6 大区域 (`forehead`, `tZone`, `cheeks` 等) 的精确映射表 `VERTEX_ZONE_MAP`。
    *   **色彩算法**：实现 `scoreToHSL(score)`，支持从透明绿 (0) 到 警示红 (100) 的**连续平滑插值**。
    *   **数据结构**：
        *   `MESH_TRIANGLES`: 预计算的三角形顶点索引列表（基于 Tessellation）。
        *   `getZoneScore(zoneData, activeDimension)`: 动态提取各维度评分。

2.  - [x] **热力图渲染管线 (`src/components/advisor/FaceAnalysisOverlay.tsx`)**：
    *   **架构**：使用 **Offscreen Canvas + Main Canvas** 的双缓冲策略。
    *   **Layer 1: 动态热力层 (Heatmap)**：
        *   遍历 ~900 个 Mesh 三角形。
        *   计算每个三角形的重心所属区域 -> 获取评分 -> 计算 HSL 颜色。
        *   绘制填充三角形 -> 应用重度 `Gaussian Blur (15px+)` 消除网格棱角，实现丝滑过渡。
        *   支持 **渐入动画** (opacity 0->1) 和 **维度切换 Crossfade**。
    *   **Layer 2: 轮廓增强层 (Contours)**：
        *   绘制清晰的五官线条 (Eyes, Lips, Eyebrows)，叠加在模糊热力图之上，确保面部结构清晰。
    *   **Layer 3: 交互层 (Interaction)**：
        *   监听点击事件，计算点击点所属区域 -> 触发 `onZoneClick`。

3.  - [x] **维度切换组件 (`src/components/advisor/DimensionSwitcher.tsx`)**：
    *   **独立组件**：管理 `activeDimension` 状态。
    *   **支持维度**：综合 / 油分 / 毛孔 / 皱纹 / 色斑 / 泛红。
    *   **交互**：点击切换 -> 触发 `FaceAnalysisOverlay` 重新计算颜色。

### 🚧 第四阶段：业务逻辑与完全隔离策略 - 预计 1 天
**目标**：实现 VIP 专属路径，确保普通用户零负担（不加载模型、不运行 CV）。

1.  **Schema 修正与权限工具 (`prisma/schema.prisma` & `src/lib/auth.ts`)**：
    *   [x] **User 表更新**：添加 `vipExpiresAt: DateTime?` 字段。
    *   [x] **Role 枚举**：明确支持 `"vip"` 角色。
    *   [x] **工具函数**：实现 `isVip(user)` 判断逻辑 (检查 role + 过期时间)。

2.  **VIP 隔离容器组件 (`src/components/advisor/VIPAnalysisSection.tsx`)**：
    *   [x] **封装**：作为 `ResultClient` 的子组件，负责动态加载 MediaPipe。
    *   [x] **按需加载**：使用 `dynamic(() => import(...), { ssr: false })` 导入 `FaceAnalysisOverlay`。
    *   [x] **Props**：接收 `imageUrl` 和 `zoneAnalysis`。
    *   [x] **逻辑**：
        *   VIP 用户 -> 渲染 `<FaceAnalysisOverlay />` + `<DimensionSwitcher />`。
        *   普通用户 -> 渲染 `<VIPFeatureCard />`。

3.  **静态营销组件 (`src/components/advisor/VIPFeatureCard.tsx`)**：
    *   [x] **替代原有的模糊遮罩**：普通用户看不到实时 AR，而是看到一张精美的静态宣传卡片。
    *   [x] **内容**：展示一张“示例”热力图（设计好的静态图片），配文“VIP 专属：解锁 AI 面部深层热力图分析”。
    *   [x] **行为**：点击触发 VIP 升级弹窗 (或 Toast 提示)。

4.  **ResultClient 集成 (`src/app/(advisor)/result/ResultClient.tsx`)**：
    *   [x] **简化**：移除文件内直接引用的 MediaPipe 逻辑，替换为 `<VIPAnalysisSection />`。
    *   [x] **数据传递**：将 `faceAnalysis.zoneAnalysis` 传递给子组件。

5.  **Prompt 差异化 (`src/config/ai-prompts.ts` & `src/app/api/advisor/face-analyze/route.ts`)**：
    *   [x] **VIP 指令常量**：创建 `VIP_ANALYSIS_INSTRUCTION`，要求微观分析、精准描述、医疗美容建议。
    *   [x] **API 注入**：`face-analyze` 路由中通过 `getSession()` 判断 VIP 身份，动态拼接 Prompt。
    *   [x] **日志追踪**：VIP 模式激活时记录用户 ID。

### 🚧 第五阶段：集成与验证
1.  **性能优化**：确保 `face-api` (拍照) 和 `MediaPipe` (分析) 不会同时加载。
2.  **E2E 测试**：
    *   普通用户流程：拍照 -> 分析 -> 查看报告 (无 AR) -> 点击卡片 -> 提示升级。
    *   VIP 用户流程：拍照 -> 分析 -> 查看报告 (自动加载 AR 热力图) -> 切换维度。

---

## 4. 风险与对策
*   **普通用户误触发**：确保 `isVip` 判断逻辑在组件渲染的最顶层。
*   **模型加载失败**：VIP 用户如果加载模型失败，应自动降级到普通视图，提示“高级分析暂时不可用”。

## 5. 开发顺序建议
1.  **Schema Update** (DB 层)
2.  **Face Zones & Mapping** (数据层) - ✅ Done
3.  **VIPAnalysisSection** (隔离层)
4.  **VIPFeatureCard** (营销层)
5.  **ResultClient Integration** (集成)
