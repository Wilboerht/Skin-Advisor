import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeInternalRequest: vi.fn(),
  rateLimit: vi.fn(),
  getClientIP: vi.fn(),
  getDiaryList: vi.fn(),
  getDiaryArchive: vi.fn(),
  upsertDiaryEntry: vi.fn(),
  deleteDiaryEntry: vi.fn(),
  getSkinTrends: vi.fn(),
  getTestHistory: vi.fn(),
  claimGuestSessionsFromClientIp: vi.fn(),
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
vi.mock("@/lib/guest-session-claim", () => ({
  claimGuestSessionsFromClientIp: mocks.claimGuestSessionsFromClientIp,
}));
vi.mock("@/lib/diary-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/diary-service")>();
  return {
    ...actual,
    getDiaryList: mocks.getDiaryList,
    getDiaryArchive: mocks.getDiaryArchive,
    upsertDiaryEntry: mocks.upsertDiaryEntry,
    deleteDiaryEntry: mocks.deleteDiaryEntry,
  };
});
vi.mock("@/lib/skin-trends", () => ({ getSkinTrends: mocks.getSkinTrends }));
vi.mock("@/lib/test-history", () => ({ getTestHistory: mocks.getTestHistory }));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.error, warn: mocks.warn, info: mocks.info },
}));

import { DiaryValidationError } from "@/lib/diary-service";
import { DELETE, GET as diaryGet, POST } from "../diary/route";
import { GET as archiveGet } from "../diary/archive/route";
import { GET as trendsGet } from "../skin-trends/route";
import { GET as testsGet } from "../test-history/route";

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

const DIARY_URL = "http://localhost/api/internal/diary";
const USER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeInternalRequest.mockResolvedValue({ ok: true, mode: "signed" });
  mocks.rateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60_000 });
  mocks.getClientIP.mockReturnValue("1.2.3.4");
  mocks.getDiaryList.mockResolvedValue({
    entries: [{ id: "e1" }],
    pagination: { total: 1, offset: 0, limit: 30, hasMore: false },
  });
  mocks.getDiaryArchive.mockResolvedValue({
    entries: [{ id: "e1" }],
    pagination: { total: 1, offset: 0, limit: 30, hasMore: false },
    summary: { totalCheckins: 1, currentStreak: 1, longestStreak: 1, testCount: 2 },
  });
  mocks.upsertDiaryEntry.mockResolvedValue({
    entry: { id: "e1", date: new Date("2026-09-24T00:00:00.000Z"), skinState: "good", tags: [], note: null },
    isFirstManualCheckin: true,
    streak: 2,
    points: 2,
  });
  mocks.deleteDiaryEntry.mockResolvedValue(1);
  mocks.getSkinTrends.mockResolvedValue(null);
  mocks.getTestHistory.mockResolvedValue({
    history: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
  mocks.claimGuestSessionsFromClientIp.mockResolvedValue(undefined);
});

describe("内部接口守卫", () => {
  it("鉴权失败返回 401，且不做限流", async () => {
    mocks.authorizeInternalRequest.mockResolvedValue({ ok: false, mode: "signed", reason: "signature_mismatch", status: 401 });
    const res = await diaryGet(fakeReq(`${DIARY_URL}?userId=${USER}`));
    expect(res.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("缺少 userId 返回 400", async () => {
    const res = await diaryGet(fakeReq(DIARY_URL));
    expect(res.status).toBe(400);
  });

  it("用户级限流触发返回 429", async () => {
    // 第一次 IP 限流通过，第二次 userId 限流拒绝
    mocks.rateLimit
      .mockResolvedValueOnce({ success: true, limit: 600, remaining: 599, reset: Date.now() + 60_000 })
      .mockResolvedValueOnce({ success: false, limit: 60, remaining: 0, reset: Date.now() + 60_000 });
    const res = await diaryGet(fakeReq(`${DIARY_URL}?userId=${USER}`));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/internal/diary", () => {
  it("按 userId 返回列表与分页", async () => {
    const res = await diaryGet(fakeReq(`${DIARY_URL}?userId=${USER}&limit=30`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, data: [{ id: "e1" }] });
    expect(mocks.getDiaryList).toHaveBeenCalledWith(USER, expect.objectContaining({ limit: "30" }));
  });
});

describe("POST /api/internal/diary", () => {
  it("写入成功返回 entry 与应发积分（不发分）", async () => {
    const payload = { date: "2026-09-24", skinState: "good" };
    const res = await POST(fakeReq(`${DIARY_URL}?userId=${USER}`, payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      isFirstManualCheckin: true,
      streak: 2,
      points: 2,
    });
    expect(mocks.upsertDiaryEntry).toHaveBeenCalledWith(USER, payload);
    // 验签必须携带请求体原文（HMAC 覆盖 bodySha256），否则签名校验必然失败
    expect(mocks.authorizeInternalRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rawBody: JSON.stringify(payload) })
    );
  });

  it("校验失败返回 400 与中文文案", async () => {
    mocks.upsertDiaryEntry.mockRejectedValue(new DiaryValidationError("肌肤状态不合法"));
    const res = await POST(fakeReq(`${DIARY_URL}?userId=${USER}`, { skinState: "unknown" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "肌肤状态不合法" });
  });
});

describe("DELETE /api/internal/diary", () => {
  it("删除成功返回条数", async () => {
    const res = await DELETE(fakeReq(`${DIARY_URL}?userId=${USER}&date=2026-09-24`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, deleted: 1 });
    expect(mocks.deleteDiaryEntry).toHaveBeenCalledWith(USER, "2026-09-24");
  });
});

describe("其余内部接口", () => {
  it("archive 返回首屏聚合", async () => {
    const res = await archiveGet(fakeReq(`http://localhost/api/internal/diary/archive?userId=${USER}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      summary: { testCount: 2 },
    });
  });

  it("skin-trends 样本不足时 data=null", async () => {
    const res = await trendsGet(fakeReq(`http://localhost/api/internal/skin-trends?userId=${USER}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, data: null });
  });

  it("test-history 透传列表与分页", async () => {
    const res = await testsGet(fakeReq(`http://localhost/api/internal/test-history?userId=${USER}&lite=1`));
    expect(res.status).toBe(200);
    expect(mocks.getTestHistory).toHaveBeenCalledWith(USER, expect.objectContaining({ lite: true }));
    // 无 clientIp 时仍调用（内部函数自行跳过），保证接口签名统一
    expect(mocks.claimGuestSessionsFromClientIp).toHaveBeenCalledWith(USER, null);
  });

  it("test-history 携带 clientIp 时触发游客会话懒认领", async () => {
    await testsGet(
      fakeReq(`http://localhost/api/internal/test-history?userId=${USER}&clientIp=9.9.9.9`)
    );
    expect(mocks.claimGuestSessionsFromClientIp).toHaveBeenCalledWith(USER, "9.9.9.9");
  });

  it("test-history 翻页（before / page>1）不重复触发懒认领", async () => {
    await testsGet(
      fakeReq(
        `http://localhost/api/internal/test-history?userId=${USER}&before=2026-09-01T00%3A00%3A00.000Z`
      )
    );
    expect(mocks.getTestHistory).toHaveBeenCalled();
    expect(mocks.claimGuestSessionsFromClientIp).not.toHaveBeenCalled();

    mocks.claimGuestSessionsFromClientIp.mockClear();
    await testsGet(fakeReq(`http://localhost/api/internal/test-history?userId=${USER}&page=2`));
    expect(mocks.claimGuestSessionsFromClientIp).not.toHaveBeenCalled();
  });

  it("archive / skin-trends 同样在读取前触发懒认领", async () => {
    await archiveGet(fakeReq(`http://localhost/api/internal/diary/archive?userId=${USER}`));
    await trendsGet(fakeReq(`http://localhost/api/internal/skin-trends?userId=${USER}`));
    expect(mocks.claimGuestSessionsFromClientIp).toHaveBeenCalledTimes(2);
  });
});
