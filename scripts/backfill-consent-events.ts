/**
 * 一次性回填测肤 ConsentRecord → ConsentEvent。
 *
 * 用法：
 *   npx tsx scripts/backfill-consent-events.ts          # dry-run
 *   npx tsx scripts/backfill-consent-events.ts --apply  # 写入
 *
 * 回填规则：
 * - 未撤回：写一条 GRANTED
 * - 已撤回：写 GRANTED + REVOKED
 * - 已存在同用户/文件/版本/动作/时间的记录则跳过
 */
import dotenv from "dotenv";
import { createHash } from "crypto";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env" });

type Document = "PRIVACY" | "TERMS" | "FACE" | "HEALTH" | "AI";

function maskId(value: string): string {
  return value.length <= 8 ? "***" : `${value.slice(0, 8)}…`;
}

const DOCUMENT_BY_SCOPE: Record<string, Document> = {
  privacy: "PRIVACY",
  terms: "TERMS",
  face: "FACE",
  health: "HEALTH",
  ai: "AI",
};

async function main(): Promise<void> {
  const { default: prisma } = await import("../src/lib/prisma");
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    throw new Error("缺少 IP_HASH_SALT，无法生成 subjectHash");
  }
  const subjectHash = (userId: string) =>
    createHash("sha256").update(`${salt}:subject:${userId}`).digest("hex").slice(0, 16);

  const apply = process.argv.includes("--apply");
  const rows = await prisma.consentRecord.findMany({
    orderBy: { grantedAt: "asc" },
    select: {
      userId: true,
      scope: true,
      version: true,
      grantedAt: true,
      revokedAt: true,
    },
  });

  async function createIfMissing(input: {
    userId: string;
    document: Document;
    version: string;
    action: "GRANTED" | "REVOKED";
    occurredAt: Date;
  }): Promise<boolean> {
    const existing = await prisma.consentEvent.findFirst({
      where: {
        userId: input.userId,
        document: input.document,
        version: input.version,
        channel: "skin",
        action: input.action,
        occurredAt: input.occurredAt,
      },
      select: { id: true },
    });
    if (existing) return false;

    await prisma.consentEvent.create({
      data: {
        userId: input.userId,
        subjectType: "USER",
        subjectHash: subjectHash(input.userId),
        project: "SKIN",
        document: input.document,
        version: input.version,
        action: input.action,
        channel: "skin",
        occurredAt: input.occurredAt,
      },
    });
    return true;
  }

  let created = 0;
  for (const row of rows) {
    const document = DOCUMENT_BY_SCOPE[row.scope];
    if (!document) continue;

    const base = {
      userId: row.userId,
      document,
      version: row.version,
    };

    if (apply) {
      if (await createIfMissing({ ...base, action: "GRANTED", occurredAt: row.grantedAt })) {
        created += 1;
      }
      if (
        row.revokedAt &&
        (await createIfMissing({ ...base, action: "REVOKED", occurredAt: row.revokedAt }))
      ) {
        created += 1;
      }
    } else {
      console.log(
        `[dry-run] ${maskId(row.userId)} ${row.scope} v${row.version} ` +
          `${row.revokedAt ? "GRANTED+REVOKED" : "GRANTED"}`
      );
    }
  }

  console.log(
    apply
      ? `[backfill] 完成，新增 ${created} 条 ConsentEvent`
      : `[dry-run] 共 ${rows.length} 条 ConsentRecord；确认后加 --apply`
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[backfill] 失败:", error);
  process.exitCode = 1;
});
