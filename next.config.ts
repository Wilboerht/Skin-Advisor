import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    config.module.unknownContextCritical = false;
    return config;
  },
  turbopack: {},
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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
      {
        protocol: 'https',
        hostname: 'cdn.*',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/file/:path*",
      },
    ];
  },
  async headers() {
    return [
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
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com;",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' blob: data: https://images.unsplash.com https://wp-cdn.4ce.cn https://*.alicdn.com https://*.aliyuncs.com https://*.qpic.cn https://*.myqcloud.com https://*.jd.com https://*.tmall.com https://*.taobao.com https://*.xiaohongshu.com https://*.douyincdn.com https://*.bilibili.com https://*.cdninstagram.com;",
              "font-src 'self';",
              "connect-src 'self' data: https://*.aliyuncs.com https://wp-cdn.4ce.cn https://images.unsplash.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com;",
              "manifest-src 'self';",
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
            ].join(" "),
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
