/** 通用校验常量和工具 */

/** 中国大陆手机号正则 */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

/** 10MB 上传限制（服务端校验用，客户端在 upload-constants.ts） */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
