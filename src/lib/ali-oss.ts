/**
 * 阿里云 OSS 工具类
 * 用于生成直传签名和处理 OSS 相关操作
 */
// @ts-expect-error ali-oss lacks official ESM type declarations
import OSS from "ali-oss";
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
 * 生成直传签名 URL
 * @param filename 文件名
 * @param type 文件类型 (MIME type)
 * @returns { uploadUrl, publicUrl } 用于前端上传和访问
 */
export async function generateUploadSignature(filename: string, type: string) {
    // 生成随机文件路径: advisor/日期/随机ID.ext
    const date = new Date().toISOString().split("T")[0];
    const randomId = crypto.randomUUID();
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const objectName = `advisor/${date}/${randomId}.${ext}`;

    if (!ossClient) {
        logger.warn("阿里云 OSS 未配置，使用本地存储降级方案");
        return {
            uploadUrl: `/api/local-upload?path=${encodeURIComponent(objectName)}`,
            publicUrl: `/uploads/${objectName}`,
            objectName: objectName
        };
    }

    // 生成签名 URL，有效期 15 分钟 (900秒)
    // 允许 PUT 方法上传
    const url = ossClient.signatureUrl(objectName, {
        method: "PUT",
        expires: 900,
        "Content-Type": type,
    });

    // 计算公开访问 URL (不带签名参数)
    // 优先使用自定义域名（如果有）
    const publicDomain = process.env.ALI_OSS_PUBLIC_DOMAIN ||
        `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com`;

    const publicUrl = `${publicDomain}/${objectName}`;

    return {
        uploadUrl: url,
        publicUrl: publicUrl,
        objectName: objectName
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
