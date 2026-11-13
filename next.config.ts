import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/security-headers";

// 部署版本号：每次构建唯一（可用 NEXT_DEPLOYMENT_ID / GIT_COMMIT_SHA 指定）。
// 发布后仍停留在旧页面的客户端导航到新实例时，Next 检测到版本不一致会整页刷新，
// 避免继续请求已被新构建删除的 chunk（ChunkLoadError / 白屏）。
const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ||
  process.env.GIT_COMMIT_SHA ||
  `build-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  deploymentId,
  webpack: (config) => {
    config.module ??= { rules: [] };
    config.module.rules ??= [];
    config.module.exprContextCritical = false;
    config.module.unknownContextCritical = false;
    return config;
  },
  output: 'standalone',
  images: {
    // 优化后图片的浏览器缓存时长（秒）。默认仅 4 小时（max-age=14400），
    // 对 /images/character 等静态品牌资产太短，每次会话都回源；
    // 7 天可覆盖复访用户，内容更新时更换文件名即可刷新。
    minimumCacheTTL: 604800,
    // 组件中使用了 quality={90}；Next 16 默认只允许 [75]，不显式配置会被静默降级
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // 官网商品/礼品图片（本地存储模式为 nihplod.cn/uploads/...；
        // 子站经 /api/account/* BFF 取回后由 officialImageSrc 补全为绝对地址）
        protocol: 'https',
        hostname: 'nihplod.cn',
      },
      {
        protocol: 'https',
        hostname: 'wp-cdn.4ce.cn',
      },
      {
        protocol: 'https',
        hostname: '*.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.aliyuncs.com',
      },
      {
        protocol: 'https',
        hostname: '*.qpic.cn',
      },
      {
        protocol: 'https',
        hostname: '*.myqcloud.com',
      },
      {
        protocol: 'https',
        hostname: '*.jd.com',
      },
      {
        protocol: 'https',
        hostname: '*.tmall.com',
      },
      {
        protocol: 'https',
        hostname: '*.taobao.com',
      },
      {
        protocol: 'https',
        hostname: '*.xiaohongshu.com',
      },
      {
        protocol: 'https',
        hostname: '*.douyincdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.bilibili.com',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
    ],
  },
  compiler: {
    // 保留 info：logger.info 走 console.info，生产剥离后 instance-check/启动诊断完全不可见
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn', 'info'] }
      : false,
  },
  poweredByHeader: false,
  async rewrites() {
    // 必须用 beforeFiles：数组形式的 rewrite 属于 afterFiles，public/ 物理文件会先被
    // 静态服务命中，绕过 /api/file 的 guest/ 鉴权与路径校验（人脸照片隐私边界）。
    return {
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/file/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      // 隐私政策/服务条款由主站统一承载：子站只保留摘要弹层，旧 URL 用真 308 收敛到主站
      {
        source: "/privacy",
        destination: "https://nihplod.cn/privacy",
        permanent: true,
      },
      {
        source: "/terms",
        destination: "https://nihplod.cn/terms",
        permanent: true,
      },
      // 测肤有礼已改为首页弹窗：/gift 旧链接（分享文案、搜索结果）308 到首页并自动打开弹窗
      {
        source: "/gift",
        destination: "/?gift=1",
        permanent: true,
      },
      // 派系列表已改为首页弹窗：/skin-types 旧链接（搜索结果、llms 引用）308 回首页
      {
        source: "/skin-types",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // 注意：Next 的 headers source 使用 path-to-regexp，括号分组不会匹配子路径；
      // 必须分别为 /images、/fonts、/models 使用 :path*，否则 /images/a.png 拿不到缓存头。
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(android-chrome.*|apple-touch-icon.*|favicon.*|site.webmanifest)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy({
              allowUnsafeEval: process.env.NODE_ENV !== "production",
            }),
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security" as const,
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=()",
          },
        ],
      },
    ];
  },
  // 启用 ETag 以减少重复传输
  generateEtags: true,
  // 压缩
  compress: true,
};

export default nextConfig;
