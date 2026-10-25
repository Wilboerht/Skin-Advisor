/**
 * 阿里云 OSS 工具类
 * 用于生成直传签名和处理 OSS 相关操作
 */
// @ts-expect-error ali-oss lacks official ESM type declarations
import OSS from "ali-oss";
import crypto from "crypto";
import { logger } from "@/lib/logger";

// OSS 配置检查
const ossConfig = {
    region: process.env.ALI_OSS_REGION,
    accessKeyId: process.env.ALI_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALI_OSS_ACCESS_KEY_SECRET,
    bucket: process.env.ALI_OSS_BUCKET,
    secure: true, // 使用 HTTPS
};

// 检查配置是否完整
const isOSSConfigured = () => {
    return (
        !!ossConfig.region &&
        !!ossConfig.accessKeyId &&
        !!ossConfig.accessKeySecret &&
        !!ossConfig.bucket
    );
};

// 创建 OSS 客户端实例
// 注意：这个实例只在服务端使用，不要在客户端代码中导入
let ossClient: OSS | null = null;

if (isOSSConfigured()) {
    try {
        ossClient = new OSS({
            region: ossConfig.region!,
            accessKeyId: ossConfig.accessKeyId!,
            accessKeySecret: ossConfig.accessKeySecret!,
            bucket: ossConfig.bucket!,
            secure: ossConfig.secure,
        });
    } catch (e) {
        logger.error("Failed to initialize OSS client:", e);
    }
}

/**
 * 生成 OSS PostObject 直传策略（含 content-length-range，禁止签小传大）
 * @param filename 文件名（仅用于推断扩展名，当 objectName 传入时忽略其路径部分）
 * @param type 文件类型 (MIME type)
 * @param objectName 可选指定 OSS object key；未提供时按默认规则生成
 * @param maxSize 本次上传允许的最大字节数
 * @returns PostObject 表单字段或本地降级地址
 */
export async function generateUploadPolicy(
    filename: string,
    type: string,
    objectName: string | undefined,
    maxSize: number
) {
    if (!objectName) {
        // 生成随机文件路径: advisor/日期/随机ID.ext
        const date = new Date().toISOString().split("T")[0];
        const randomId = crypto.randomUUID();
        const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
        objectName = `advisor/${date}/${randomId}.${ext}`;
    }

    const publicDomain = process.env.ALI_OSS_PUBLIC_DOMAIN ||
        `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com`;
    const publicUrl = `${publicDomain}/${objectName}`;

    if (!ossClient || !ossConfig.bucket || !ossConfig.region ||
        !ossConfig.accessKeyId || !ossConfig.accessKeySecret) {
        logger.warn("阿里云 OSS 未配置，使用本地存储降级方案");
        return {
            storage: "local" as const,
            uploadUrl: `/api/local-upload?path=${encodeURIComponent(objectName)}`,
            publicUrl: `/uploads/${objectName}`,
            objectName: objectName
        };
    }

    const policy = {
        expiration: new Date(Date.now() + 15 * 60 * 1000)
            .toISOString()
            .replace(/\.\d{3}Z$/, "Z"),
        conditions: [
            ["content-length-range", 1, maxSize],
            ["eq", "$key", objectName],
            ["eq", "$Content-Type", type],
        ],
    };
    const policyBase64 = Buffer.from(JSON.stringify(policy), "utf8").toString("base64");
    const signature = crypto
        .createHmac("sha1", ossConfig.accessKeySecret)
        .update(policyBase64)
        .digest("base64");

    return {
        storage: "oss" as const,
        uploadUrl: `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com`,
        publicUrl,
        objectName,
        ossAccessKeyId: ossConfig.accessKeyId,
        policy: policyBase64,
        signature,
        key: objectName,
        successActionStatus: "201",
    };
}

function getAllowedOSSHosts(): string[] {
    const hosts = new Set<string>();
    if (ossConfig.bucket && ossConfig.region) {
        hosts.add(`${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com`);
    }
    const publicDomain = process.env.ALI_OSS_PUBLIC_DOMAIN;
    if (publicDomain) {
        try {
            hosts.add(new URL(publicDomain).hostname.toLowerCase());
        } catch {
            // ignore invalid public domain
        }
    }
    return Array.from(hosts);
}

/**
 * 批量删除 OSS 文件
 * @param urls 文件的完整 URL 或 objectName 列表
 */
export async function deleteOSSFiles(urls: string[]) {
    if (!ossClient) return;

    const allowedHosts = getAllowedOSSHosts();

    try {
        // 提取 objectName，并校验 URL 是否属于本 bucket/自定义域名
        const names = urls.map(url => {
            try {
                const urlObj = new URL(url);
                if (!allowedHosts.includes(urlObj.hostname.toLowerCase())) {
                    logger.warn(`[OSS] Skipping delete of non-OSS URL: ${url}`);
                    return null;
                }
                // 移除开头的 /
                return urlObj.pathname.substring(1);
            } catch {
                // Treat raw object names with basic safety checks
                if (url.startsWith("/") || url.includes("..") || url.includes("\\")) {
                    logger.warn(`[OSS] Skipping unsafe object name: ${url}`);
                    return null;
                }
                return url;
            }
        }).filter((name): name is string => Boolean(name));

        if (names.length === 0) return;

        // Aliyun OSS deleteMulti has a hard limit of 1000 keys per request
        const BATCH_SIZE = 1000;
        for (let i = 0; i < names.length; i += BATCH_SIZE) {
            const batch = names.slice(i, i + BATCH_SIZE);
            await ossClient.deleteMulti(batch);
        }
    } catch (e) {
        logger.error("Failed to delete OSS files:", e);
        throw e;
    }
}
