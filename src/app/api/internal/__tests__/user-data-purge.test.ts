import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * POST /api/internal/user-data/purge 测试
 * mock 模式与 internal-routes.test.ts 一致：鉴权/限流层 mock 掉，
 * prisma 以 deleteMany/updateMany 计数桩验证事务编排与响应契约。
 */

const mocks = vi.hoisted(() => ({
  authorizeInternalRequest: vi.fn(),
  rateLimit: vi.fn(),
  getClientIP: vi.fn(),
  transaction: vi.fn(),
  testRecordDeleteMany: vi.fn(),
  diaryDeleteMany: vi.fn(),
  feedbackDeleteMany: vi.fn(),
  sessionDeleteMany: vi.fn(),
  aiUsageUpdateMany: vi.fn(),
  userDeleteMany: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
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
    $transaction: mocks.transaction,
    testRecord: { deleteMany: mocks.testRecordDeleteMany },
    diaryEntry: { deleteMany: mocks.diaryDeleteMany },
    productFeedback: { deleteMany: mocks.feedbackDeleteMany },
    advisorSession: { deleteMany: mocks.sessionDeleteMany },
    aIUsageLog: { updateMany: mocks.aiUsageUpdateMany },
    user: { deleteMany: mocks.userDeleteMany },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.error, warn: mocks.warn, info: mocks.info },
}));

import { POST } from "../user-data/purge/route";

function fakeReq(url: string, body?: unknown): NextRequest {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers(),
    json: async () => body,
    text: async () => text,
  } as unknown as NextRequest;
}

const PURGE_URL = "http://localhost/api/internal/user-data/purge";
const USER = "user-sso-sub-1";

/** 设置各表删除/匿名化计数（顺序：testRecord/diary/feedback/session/aiUsage/user） */
function stubCounts(t: number, d: number, f: number, s: number, a: number, u: number) {
  mocks.testRecordDeleteMany.mockResolvedValue({ count: t });
  mocks.diaryDeleteMany.mockResolvedValue({ count: d });
  mocks.feedbackDeleteMany.mockResolvedValue({ count: f });
  mocks.sessionDeleteMany.mockResolvedValue({ count: s });
  mocks.aiUsageUpdateMany.mockResolvedValue({ count: a });
  mocks.userDeleteMany.mockResolvedValue({ count: u });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeInternalRequest.mockResolvedValue({ ok: true, mode: "signed" });
  mocks.rateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
  mocks.getClientIP.mockReturnValue("1.2.3.4");
  mocks.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  stubCounts(0, 0, 0, 0, 0, 0);
});

describe("POST /api/internal/user-data/purge 守卫", () => {
  it("鉴权失败返回 401，且不触碰数据库", async () => {
    mocks.authorizeInternalRequest.mockResolvedValue({ ok: false, mode: "signed", reason: "signature_mismatch", status: 401 });
    const res = await POST(fakeReq(`${PURGE_URL}?userId=${USER}`));
    expect(res.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("缺少 userId 返回 400", async () => {
    const res = await POST(fakeReq(PURGE_URL));
    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/user-data/purge 数据处置", () => {
  it("正常删除：各表计数与 localUser 按契约返回，where 均限定 userId", async () => {
    stubCounts(2, 3, 1, 5, 4, 1);
    const res = await POST(fakeReq(`${PURGE_URL}?userId=${USER}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      userId: USER,
      purged: {
        testRecords: 2,
        diaryEntries: 3,
        advisorSessions: 5,
        productFeedbacks: 1,
        aiUsageLogs: 4,
        localUser: true,
      },
    });

    // 物理删除的表：where 精确限定该 userId
    expect(mocks.testRecordDeleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(mocks.diaryDeleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(mocks.feedbackDeleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    // AIUsageLog 匿名化而非删除
    expect(mocks.aiUsageUpdateMany).toHaveBeenCalledWith({ where: { userId: USER }, data: { userId: null } });
    expect(mocks.userDeleteMany).toHaveBeenCalledWith({ where: { id: USER } });
    // 单事务包裹
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    // 审计日志：userId + 各表计数，无 PII
    expect(mocks.info).toHaveBeenCalledWith(
      "[internal/user-data] purge completed",
      expect.objectContaining({ userId: USER, advisorSessions: 5, localUser: true })
    );
  });

  it("幂等：二次调用（已清理）返回 ok:true 且计数全 0", async () => {
    stubCounts(0, 0, 0, 0, 0, 0);
    const res = await POST(fakeReq(`${PURGE_URL}?userId=${USER}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      userId: USER,
      purged: {
        testRecords: 0,
        diaryEntries: 0,
        advisorSessions: 0,
        productFeedbacks: 0,
        aiUsageLogs: 0,
        localUser: false,
      },
    });
  });

  it("用户不存在：ok:true + 全 0 + localUser:false（不报错，避免主站重试风暴）", async () => {
    // 与幂等同形：用户行不存在时 user.deleteMany count = 0，
    // 但该用户可能有孤儿数据（理论上 FK 阻止，防御性验证响应契约）
    stubCounts(0, 0, 0, 0, 0, 0);
    const res = await POST(fakeReq(`${PURGE_URL}?userId=never-existed`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.purged.localUser).toBe(false);
    expect(Object.values(body.purged).every((v) => v === 0 || v === false)).toBe(true);
  });

  it("数据库异常返回 500 且不落 PII", async () => {
    mocks.transaction.mockRejectedValue(new Error("connection reset"));
    const res = await POST(fakeReq(`${PURGE_URL}?userId=${USER}`));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
    expect(mocks.error).toHaveBeenCalledWith(
      "[internal/user-data] purge failed",
      expect.objectContaining({ userId: USER })
    );
  });
});
