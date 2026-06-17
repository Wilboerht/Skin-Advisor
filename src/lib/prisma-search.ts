/**
 * Prisma 搜索辅助函数
 *
 * `mode: "insensitive"` 仅在 PostgreSQL 等部分数据库的生成类型中可用。
 * SQLite 的 LIKE 默认大小写不敏感，因此不需要（也不支持）该字段。
 * 此 helper 根据数据库 URL 自动判断是否添加 `mode`，使同一份代码能同时兼容
 * 本地 SQLite 开发与生产 PostgreSQL 部署。
 */
export function containsInsensitive(search: string): { contains: string } {
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
    const isPostgres =
        url.startsWith("postgresql://") || url.startsWith("postgres://");

    if (isPostgres) {
        return { contains: search, mode: "insensitive" } as {
            contains: string;
        };
    }

    return { contains: search };
}
