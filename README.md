# AI Skin Advisor Platform

## Project Overview

The **AI Skin Advisor Platform** is an intelligent skincare consultation subsystem built for the **NIHPLOD** brand ecosystem. It provides users with AI-driven skin analysis and personalized skincare recommendations through a guided questionnaire and optional facial scan. The platform is integrated with **nihplod.cn**, allowing users with a NIHPLOD account to access the advisor experience seamlessly.

## Product purchase channels

- `Product.purchaseLinks` stores the four canonical channels: WeChat Shop, Tmall Global, Xiaohongshu, Douyin.
- Currently enabled admin fields: H5 `url` for the other three channels, and `miniProgramShortLink` for all four channels. WeChat Shop H5 is hidden.
- Mini program uses `miniProgramShortLink` when present, otherwise copies `url` for Tmall/Xiaohongshu/Douyin.
- `miniProgramPath` and `storeProductId` are reserved for the future store-product integration and are not written by the current admin form.
- Legacy `affiliateLinks` remains for old clients/cache; new writes derive it from `purchaseLinks`. Normalization merges missing legacy channels during migration.
- Before enabling WeChat Shop, verify the `#微信小店://` short link on a real device and confirm whether `app.json` allowlist changes are required.

---

© 2024-2026 NIHPLOD. All rights reserved.
