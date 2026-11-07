# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* 会在构建期内联到客户端 bundle，必须通过 build args 注入
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_SSO_CLIENT_ID
ARG NEXT_PUBLIC_SSO_BASE_URL
ARG NEXT_PUBLIC_SSO_REDIRECT_URI
ARG NEXT_PUBLIC_SSO_SCOPES
ARG NEXT_PUBLIC_ALI_OSS_REGION
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_SSO_CLIENT_ID=$NEXT_PUBLIC_SSO_CLIENT_ID \
    NEXT_PUBLIC_SSO_BASE_URL=$NEXT_PUBLIC_SSO_BASE_URL \
    NEXT_PUBLIC_SSO_REDIRECT_URI=$NEXT_PUBLIC_SSO_REDIRECT_URI \
    NEXT_PUBLIC_SSO_SCOPES=$NEXT_PUBLIC_SSO_SCOPES \
    NEXT_PUBLIC_ALI_OSS_REGION=$NEXT_PUBLIC_ALI_OSS_REGION \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

# postbuild 已把 public/、.next/static 复制进 standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 上传目录：standalone/public/uploads 是指向 /app/public/uploads 的软链接，需保证目标存在
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
