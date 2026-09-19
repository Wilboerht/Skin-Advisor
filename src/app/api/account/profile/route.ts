import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser, upsertLocalUser } from "@/lib/sso-auth";
import { maskPhone, resolveOfficialAccessToken, OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const OFFICIAL_USERINFO_TIMEOUT_MS = 8000;

// GET: 读本地 DB 用户副本返回资料（phone 打码展示）。
// birthday 本地 DB 无字段，回源官网 userinfo 获取（需 token 含 birthday scope）；
// 官网不可达或 scope 未授权时降级为 null，不影响其他字段。
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "unauthorized", message: "请先登录" }, { status: 401 });
    }

    // 按用户限流：回源走同一出口 IP，防单个用户耗尽全站共享的官网配额
    const limit = await rateLimit(`account:${user.id}`, "default", { maxRequests: 60, windowMs: 60_000 });
    if (!limit.success) {
        return NextResponse.json({ error: "rate_limited", message: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    try {
        // 本地 DB 查询与官网 birthday 回源并行（回源最坏 8s 超时，串行会拖慢整个 GET）
        const [local, birthday] = await Promise.all([
            prisma.user.findUnique({
                where: { id: user.id },
                select: { name: true, avatarUrl: true, gender: true, phoneNumber: true, membershipLevel: true },
            }),
            fetchBirthdayFromOfficial(req),
        ]);

        return NextResponse.json({
            nickname: local?.name ?? null,
            avatar: local?.avatarUrl ?? null,
            gender: local?.gender ?? null,
            phone: maskPhone(local?.phoneNumber),
            membershipLevel: local?.membershipLevel ?? null,
            birthday,
        });
    } catch (err) {
        logger.error("[account/profile] GET error:", err);
        return NextResponse.json({ error: "internal_error", message: "服务暂时不可用，请稍后再试" }, { status: 500 });
    }
}

/** 回源官网 userinfo 取生日；任何失败都降级为 null（不阻断资料主流程） */
async function fetchBirthdayFromOfficial(req: NextRequest): Promise<string | null> {
    const token = await resolveOfficialAccessToken(req);
    if (!token) return null;
    try {
        const res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(OFFICIAL_USERINFO_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as { birthday?: string | null } | null;
        return typeof data?.birthday === "string" ? data.birthday : null;
    } catch {
        return null;
    }
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const patchSchema = z
    .object({
        nickname: z.string().trim().min(1, "昵称不能为空").max(20, "昵称最长 20 个字符").optional(),
        avatar: z.string().refine(isHttpUrl, "头像必须是 http(s) URL").optional(),
        birthday: z.string().refine(isIsoDate, "生日格式应为 YYYY-MM-DD").nullish(),
        gender: z.enum(["male", "female"]).nullish(),
    })
    .refine(
        (obj) => obj.nickname !== undefined || obj.avatar !== undefined ||
            obj.birthday !== undefined || obj.gender !== undefined,
        { message: "至少提供一项待更新字段" }
    );

// PATCH: 校验后代理官网 PATCH /api/oauth/userinfo（Bearer 转发），
// 成功后把昵称/头像/性别同步回本地副本；birthday_locked 透传 403。
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "unauthorized", message: "请先登录" }, { status: 401 });
    }

    // 写操作限流略严于读操作
    const limit = await rateLimit(`account-write:${user.id}`, "default", { maxRequests: 20, windowMs: 60_000 });
    if (!limit.success) {
        return NextResponse.json({ error: "rate_limited", message: "操作过于频繁，请稍后再试" }, { status: 429 });
    }

    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json({ error: "validation_error", message: "请求体不是合法的 JSON" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || "参数校验失败";
        return NextResponse.json({ error: "validation_error", message }, { status: 400 });
    }

    const token = await resolveOfficialAccessToken(req);
    if (!token) {
        return NextResponse.json({ error: "unauthorized", message: "登录已过期，请重新登录" }, { status: 401 });
    }

    let res: Response;
    try {
        res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/userinfo`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(parsed.data),
            signal: AbortSignal.timeout(OFFICIAL_USERINFO_TIMEOUT_MS),
        });
    } catch (err) {
        logger.warn("[account/profile] PATCH 官网不可达", { error: String(err) });
        return NextResponse.json({ error: "upstream_error", message: "官网服务连接失败，请稍后再试" }, { status: 502 });
    }

    const data = (await res.json().catch(() => null)) as {
        nickname?: string;
        avatar?: string;
        gender?: "male" | "female" | null;
        birthday?: string | null;
        error?: string;
    } | null;

    if (res.status === 401) {
        return NextResponse.json({ error: "unauthorized", message: "登录已过期，请重新登录" }, { status: 401 });
    }
    if (res.status === 403) {
        if (data?.error === "birthday_locked") {
            return NextResponse.json(
                { error: "birthday_locked", message: "生日修改次数已用完，如需修改请联系客服" },
                { status: 403 }
            );
        }
        if (data?.error === "insufficient_scope") {
            // 多为 client 未配置 profile:write scope（官网后台/子站 NEXT_PUBLIC_SSO_SCOPES），
            // 用 error 级日志保证配置缺失可被发现
            logger.error("[account/profile] PATCH 官网拒绝：insufficient_scope（请检查 client scopes 配置）");
        }
        return NextResponse.json({ error: "forbidden", message: "当前账号没有修改资料的权限" }, { status: 403 });
    }
    if (!res.ok || !data) {
        logger.warn("[account/profile] PATCH 官网响应异常", { status: res.status });
        return NextResponse.json({ error: "upstream_error", message: "官网服务暂时不可用，请稍后再试" }, { status: 502 });
    }

    // 同步本地副本（birthday 本地无字段，仅回传给前端展示）
    try {
        await upsertLocalUser(
            { sub: user.id } as Parameters<typeof upsertLocalUser>[0],
            {
                nickname: data.nickname,
                avatar: data.avatar,
                ...(data.gender !== undefined ? { gender: data.gender } : {}),
            }
        );
    } catch (err) {
        // 官网已更新成功，本地同步失败不阻断本次响应
        logger.warn("[account/profile] PATCH 本地副本同步失败", { userId: user.id, error: String(err) });
    }

    return NextResponse.json({
        nickname: data.nickname ?? null,
        avatar: data.avatar ?? null,
        gender: data.gender ?? null,
        birthday: data.birthday ?? null,
    });
}
