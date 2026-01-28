# 甄选产品推荐 - 重构实现计划

> 创建时间: 2026-01-28
> 最后更新: 2026-01-28 15:15
> 状态: ✅ 所有阶段已完成

## 📋 目标概述

将现有的产品推荐模块从简单的 Grid 展示升级为智能化、个性化、可交互的完整产品推荐系统。

---

## 🏗️ 实现阶段

### Phase 1: 核心布局重构 ✅ 已完成

**目标**: 按护肤步骤分组展示产品

1. **创建分组数据结构** ✅
   - [x] 定义护肤步骤枚举 (`src/lib/skincare-steps.ts`)
   - [x] 修改 Product 模型，添加 `step` 字段
   - [x] 创建 `groupProductsByStep()` 工具函数

2. **新建组件** ✅
   - [x] `ProductRecommendationSection.tsx` - 分组容器
   - [x] `StepProductGroup.tsx` - 单个步骤分组
   - [x] `ProductCard.tsx` - 产品卡片 (独立组件)
   - [x] `ProductCardSkeleton.tsx` - 骨架屏

3. **布局实现** ✅
   ```
   💧 第1步: 洁面
   ┌──────┐ ┌──────┐
   │产品A │ │产品B │
   └──────┘ └──────┘
   
   🧴 第2步: 精华
   ┌──────┐ ┌──────┐ ┌──────┐
   │产品C │ │产品D │ │产品E │
   └──────┘ └──────┘ └──────┘
   ```

---

### Phase 2: 智能推荐逻辑升级 ✅ 已完成

**目标**: 个性化推荐 + 环境联动

1. **AI 个性化理由生成** ✅
   - [x] 推荐理由关联用户具体维度评分
   - [x] 理由模板: "针对您的 **{dimension} {score}分**，推荐..."
   - [x] 传入 `faceAnalysis.dimensions` 到推荐组件

2. **环境联动推荐** ✅
   - [x] 新建 `lib/env-recommendation.ts`
   - [x] 根据 UV 指数调整防晒产品权重
   - [x] 根据湿度调整保湿产品权重
   - [x] 根据 AQI 调整清洁产品权重
   - [x] 季节性推荐调整

---

### Phase 3: 交互功能实现 ✅ 已完成

**目标**: 丰富用户操作

1. **加入护肤流程** ✅
   - [x] 点击 + 按钮直接加入流程
   - [x] 创建 `lib/routine-products.ts` 管理模块
   - [x] 持久化到 localStorage

2. **成分悬浮预览** ✅
   - [x] 创建 `IngredientTooltip.tsx` 组件
   - [x] 使用 Framer Motion 动画
   - [x] 显示: 核心成分、功效、使用方法

3. **心愿单功能** ✅
   - [x] 新建 `lib/wishlist.ts` (localStorage + 服务器同步)
   - [x] 卡片右上角添加爱心按钮 `WishlistButton.tsx`
   - [x] 心愿单页面 `/wishlist`
   - [x] 心愿单导航按钮 `WishlistNavButton.tsx`
   - [x] API 路由 `/api/wishlist`

4. **电商跳转** ✅
   - [x] Product 模型添加 `affiliateLinks` 字段
   - [x] 创建 `lib/affiliate-links.ts` 工具模块
   - [x] 支持小红书/淘宝/京东/抖音
   - [x] 卡片底部显示 "去购买" 按钮，多平台选择

---

### Phase 4: 技术优化 ✅ 已完成

1. **骨架屏** ✅
   - [x] 使用 Tailwind animate-pulse
   - [x] 匹配卡片实际布局

2. **图片优化** ✅
   - [x] 使用 `<Image>` (Next.js)
   - [x] 添加 `placeholder="blur"` + `blurDataURL`

3. **分页/无限滚动** ✅
   - [x] 初始显示 4 个产品
   - [x] "查看更多" 按钮加载剩余

4. **后台管理** ✅
   - [x] 更新 `ProductForm.tsx` 添加新字段
   - [x] 创建迁移 API `/api/admin/migrate-steps`

---

## 📁 新增文件清单

```
src/
├── components/
│   └── advisor/
│       ├── ProductRecommendationSection.tsx  ✅ 主容器
│       ├── StepProductGroup.tsx              ✅ 步骤分组
│       ├── ProductCard.tsx                   ✅ 产品卡片
│       ├── ProductCardSkeleton.tsx           ✅ 骨架屏
│       ├── IngredientTooltip.tsx             ✅ 成分悬浮
│       ├── WishlistButton.tsx                ✅ 收藏按钮
│       └── WishlistNavButton.tsx             ✅ 导航按钮
├── lib/
│   ├── skincare-steps.ts                     ✅ 护肤步骤类型
│   ├── env-recommendation.ts                 ✅ 环境联动
│   ├── wishlist.ts                           ✅ 心愿单逻辑
│   ├── affiliate-links.ts                    ✅ 电商链接
│   └── routine-products.ts                   ✅ 流程产品管理
└── app/
    ├── (advisor)/
    │   └── wishlist/
    │       └── page.tsx                      ✅ 心愿单页面
    └── api/
        ├── wishlist/
        │   ├── route.ts                      ✅ 心愿单API
        │   └── sync/
        │       └── route.ts                  ✅ 同步API
        └── admin/
            └── migrate-steps/
                └── route.ts                  ✅ 迁移API
```

---

## 🔄 数据库变更 ✅ 已完成

```prisma
model Product {
  // 新增字段
  step              String?   // 护肤步骤
  howToUse          String?   // 使用方法
  affiliateLinks    Json?     // 电商链接
  ingredientDetails Json?     // 成分详情
  
  wishlistItems     WishlistItem[]
}

model Wishlist {
  id        String         @id
  userId    String?        // 已登录用户
  guestId   String?        // 游客ID
  items     WishlistItem[]
  ...
}

model WishlistItem {
  id         String   @id
  wishlistId String
  productId  String
  addedAt    DateTime
  note       String?
  ...
}
```

---

## ✅ 完成状态

| 阶段 | 状态 | 工时 |
|------|------|------|
| Phase 1: 布局重构 | ✅ 完成 | ~2h |
| Phase 2: 智能推荐 | ✅ 完成 | ~1h |
| Phase 3: 交互功能 | ✅ 完成 | ~2h |
| Phase 4: 技术优化 | ✅ 完成 | ~1h |
| **总计** | **完成** | **~6h** |

---

## 🚀 下一步

1. 访问 `/api/admin/migrate-steps` (POST) 执行产品迁移
2. 在后台为产品添加电商链接和护肤步骤
3. 将心愿单入口添加到页面导航栏
