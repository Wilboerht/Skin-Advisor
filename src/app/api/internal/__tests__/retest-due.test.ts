/**
 * GET /api/internal/retest-due 测试
 * 覆盖：鉴权失败 401（不做限流）、限流 429、30 天 CST 窗口筛选（含空值/过新/过旧）。
 * 窗口动态构造（相对"今天"），避免固定日期随时钟漂移失效。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeInternalRequest: vi.fn(),
  rateLimit: vi.fn(),
  getClientIP: vi.fn(),
  groupBy: vi.fn(),
  userFindMany: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/internal-api", () => ({
  authorizeInternalRequest: mocks.authorizeInternalRequest,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: mocks.rateLimit,
  getClientIP: mocks.getClientIP,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    advisorSession: { groupBy: mocks.groupBy },
    user: { findMany: mocks.userFindMany },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.error, warn: mocks.warn },
}));

import { GET } from "../retest-due/route";

function fakeReq(url: string): NextRequest {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as NextRequest;
}

const URL_ = "http://localhost/api/internal/retest-due";
const DAY_MS = 86_400_000;
const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 相对于 CST 今天，偏移 offsetDays 天的"正午"（返回 UTC Date） */
function cstNoon(offsetDays: number): Date {
  const nowCst = new Date(Date.now() + CST_OFFSET_MS);
  const todayStartUtc =
    Date.UTC(nowCst.getUTCFullYear(), nowCst.getUTCMonth(), nowCst.getUTCDate()) - CST_OFFSET_MS;
  return new Date(todayStartUtc + offsetDays * DAY_MS + 12 * 60 * 60 * 1000);
}

describe("GET /api/internal/retest-due", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeInternalRequest.mockResolvedValue({ ok: true, mode: "signed" });
    mocks.rateLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: Date.now() + 60_000 });
    mocks.getClientIP.mockReturnValue("1.2.3.4");
    mocks.groupBy.mockResolvedValue([]);
    mocks.userFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id }))
    );
  });

  it("鉴权失败返回 401，且不做限流", async () => {
    mocks.authorizeInternalRequest.mockResolvedValue({
      ok: false,
      mode: "signed",
      reason: "signature_mismatch",
      status: 401,
    });
    const res = await GET(fakeReq(URL_));
    expect(res.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("限流触发返回 429", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: Date.now() });
    const res = await GET(fakeReq(URL_));
    expect(res.status).toBe(429);
  });

  it("仅返回 lastTestAt 落在「30 天前 CST 自然日」的用户（过新/过旧/空值均剔除）", async () => {
    const inWindow = cstNoon(-30); // 30 天前正午 → 命中
    const tooNew = cstNoon(-29); // 29 天前 → 太新
    const tooOld = cstNoon(-31); // 31 天前 → 太旧
    mocks.groupBy.mockResolvedValue([
      { userId: "u1", _max: { completedAt: inWindow } },
      { userId: "u2", _max: { completedAt: tooNew } },
      { userId: "u3", _max: { completedAt: tooOld } },
      { userId: "u4", _max: { completedAt: null } },
      { userId: null, _max: { completedAt: inWindow } }, // 游客会话（无账号）：不可提醒
    ]);

    const res = await GET(fakeReq(URL_));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      users: [{ userId: "u1", lastTestAt: inWindow.toISOString() }],
    });
  });

  it("无命中返回空名单", async () => {
    mocks.groupBy.mockResolvedValue([{ userId: "u1", _max: { completedAt: cstNoon(-10) } }]);
    const res = await GET(fakeReq(URL_));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ users: [] });
  });

  it("子站账号已禁用的用户不进入提醒名单", async () => {
    mocks.groupBy.mockResolvedValue([{ userId: "u1", _max: { completedAt: cstNoon(-30) } }]);
    mocks.userFindMany.mockResolvedValue([]);
    const res = await GET(fakeReq(URL_));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ users: [] });
  });
});
