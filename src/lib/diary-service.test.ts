import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  advisorCount: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    diaryEntry: {
      upsert: mocks.upsert,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      count: mocks.count,
      deleteMany: mocks.deleteMany,
    },
    advisorSession: { count: mocks.advisorCount },
  },
}));

import {
  DiaryValidationError,
  deleteDiaryEntry,
  getDiaryList,
  normalizeDiaryPageSize,
  upsertDiaryEntry,
} from "./diary-service";

const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const dateStr = today.toISOString().slice(0, 10);
const daysBefore = (n: number) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - n));

const validBody = { date: dateStr, skinState: "good", tags: ["熬夜"], note: "状态不错" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({ id: "e1", date: today, skinState: "good", tags: [], note: null });
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.advisorCount.mockResolvedValue(0);
  mocks.deleteMany.mockResolvedValue({ count: 1 });
});

describe("normalizeDiaryPageSize", () => {
  it("默认 30，上限 50，负数下限 1，非法/零值回退默认（与旧口径一致）", () => {
    expect(normalizeDiaryPageSize(undefined)).toBe(30);
    expect(normalizeDiaryPageSize(null)).toBe(30);
    expect(normalizeDiaryPageSize("999")).toBe(50);
    expect(normalizeDiaryPageSize("0")).toBe(30);
    expect(normalizeDiaryPageSize("-5")).toBe(1);
    expect(normalizeDiaryPageSize("abc")).toBe(30);
  });
});

describe("upsertDiaryEntry 校验", () => {
  it("请求体非法 / 肌肤状态非法 / 日期格式非法 / 日期超窗均抛 DiaryValidationError", async () => {
    await expect(upsertDiaryEntry("u1", null)).rejects.toBeInstanceOf(DiaryValidationError);
    await expect(upsertDiaryEntry("u1", { ...validBody, skinState: "unknown" })).rejects.toThrow("肌肤状态不合法");
    await expect(upsertDiaryEntry("u1", { ...validBody, date: "2026-02-30" })).rejects.toThrow("日期格式错误");
    await expect(upsertDiaryEntry("u1", { ...validBody, date: "2020-01-01" })).rejects.toThrow("日期超出可记录范围");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("tags 清洗（去空/截断/最多 5 个）与 note 截断", async () => {
    mocks.findUnique.mockResolvedValue({ note: "手动", tags: ["熬夜"] }); // 编辑态，不再算 streak
    await upsertDiaryEntry("u1", {
      date: dateStr,
      skinState: "good",
      tags: [" a ", "", "b", "c", "d", "e", "f", "g"],
      note: "x".repeat(300),
    });
    const upsertArgs = mocks.upsert.mock.calls[0][0] as {
      update: { tags: string[]; note: string | null };
    };
    expect(upsertArgs.update.tags).toEqual(["a", "b", "c", "d", "e"]);
    expect(upsertArgs.update.note).toHaveLength(200);
  });
});

describe("upsertDiaryEntry 打卡积分口径", () => {
  it("首次手动打卡（昨天/前天都有）→ 连续第 3 天 +3", async () => {
    mocks.findMany.mockImplementation(async (args: { where?: { date?: { in?: Date[] } } }) =>
      args?.where?.date?.in
        ? [{ date: daysBefore(1) }, { date: daysBefore(2) }]
        : [{ date: today }, { date: daysBefore(1) }, { date: daysBefore(2) }]
    );

    const result = await upsertDiaryEntry("u1", validBody);
    expect(result.isFirstManualCheckin).toBe(true);
    expect(result.streak).toBe(3);
    expect(result.points).toBe(3);
    // streak=3 时补一次全量查询取精确天数
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("仅昨天有 → 连续第 2 天 +2（不做全量扫描）", async () => {
    mocks.findMany.mockImplementation(async (args: { where?: { date?: { in?: Date[] } } }) =>
      args?.where?.date?.in ? [{ date: daysBefore(1) }] : []
    );

    const result = await upsertDiaryEntry("u1", validBody);
    expect(result.streak).toBe(2);
    expect(result.points).toBe(2);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("无历史 → 连续第 1 天 +1", async () => {
    mocks.findMany.mockResolvedValue([]);
    const result = await upsertDiaryEntry("u1", validBody);
    expect(result.streak).toBe(1);
    expect(result.points).toBe(1);
  });

  it("接管测肤自动条目：视为首次手动打卡并返回应发积分", async () => {
    mocks.findUnique.mockResolvedValue({ note: "在线测肤：综合评分 80", tags: [] });
    const result = await upsertDiaryEntry("u1", validBody);
    expect(result.isFirstManualCheckin).toBe(true);
    expect(result.points).toBeGreaterThan(0);
  });

  it("编辑已有手动打卡：不返回应发积分", async () => {
    mocks.findUnique.mockResolvedValue({ note: "之前的手动记录", tags: ["熬夜"] });
    const result = await upsertDiaryEntry("u1", validBody);
    expect(result.isFirstManualCheckin).toBe(false);
    expect(result.streak).toBeUndefined();
    expect(result.points).toBeUndefined();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

describe("getDiaryList / deleteDiaryEntry", () => {
  it("默认 offset 分页返回 hasMore", async () => {
    mocks.findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    mocks.count.mockResolvedValue(5);
    const result = await getDiaryList("u1", { offset: 0, limit: "2" });
    expect(result.entries).toHaveLength(2);
    expect(result.pagination).toMatchObject({ total: 5, offset: 0, limit: 2, hasMore: true });
  });

  it("删除日期非法抛错；合法返回删除条数", async () => {
    await expect(deleteDiaryEntry("u1", null)).rejects.toThrow("日期格式错误");
    await expect(deleteDiaryEntry("u1", "2026-02-30")).rejects.toThrow("日期格式错误");
    await expect(deleteDiaryEntry("u1", dateStr)).resolves.toBe(1);
  });
});
