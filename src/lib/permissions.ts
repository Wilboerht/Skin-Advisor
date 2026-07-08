/**
 * 集中式角色与权限定义
 *
 * 说明：
 * - 所有用户/管理员角色值必须在此定义，避免魔法字符串散落在各处
 * - 新增权限判断时优先在此添加 helper，再在业务代码中调用
 */

// ==================== C 端用户角色 ====================
export const UserRole = {
    USER: "user",
    DISABLED: "disabled",
} as const;

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole];

export const VALID_USER_ROLES: readonly string[] = [UserRole.USER, UserRole.DISABLED];

export function isValidUserRole(role: string): role is UserRoleValue {
    return VALID_USER_ROLES.includes(role);
}

export function isDisabledUser(role: string): boolean {
    return role === UserRole.DISABLED;
}

// ==================== 管理员角色 ====================
export const AdminRole = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
} as const;

export type AdminRoleValue = (typeof AdminRole)[keyof typeof AdminRole];

export const VALID_ADMIN_ROLES: readonly string[] = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN];

export function isValidAdminRole(role: string): role is AdminRoleValue {
    return VALID_ADMIN_ROLES.includes(role);
}

/**
 * 检查管理员是否拥有指定角色中的任意一个
 */
export function hasAnyAdminRole(role: string, ...allowedRoles: readonly string[]): boolean {
    return allowedRoles.includes(role);
}

/**
 * 是否为超级管理员
 */
export function isSuperAdmin(role: string | null | undefined): boolean {
    return role === AdminRole.SUPER_ADMIN;
}

/**
 * 是否可登录管理后台（super_admin 或 admin）
 */
export function canAccessAdminDashboard(role: string): boolean {
    return isValidAdminRole(role);
}

/**
 * 是否可以管理其他管理员
 */
export function canManageAdmins(role: string | null | undefined): boolean {
    return isSuperAdmin(role);
}

/**
 * 是否可以查看完整 PII（邮箱、手机号明文）
 */
export function canViewFullPII(role: string | null | undefined): boolean {
    return isSuperAdmin(role);
}

/**
 * 是否可以导出含 PII 的数据
 */
export function canExportPII(role: string | null | undefined): boolean {
    return isSuperAdmin(role);
}

/**
 * 是否可以修改系统级设置（如初始设置、清理任务）
 */
export function canPerformSystemSetup(role: string | null | undefined): boolean {
    return isSuperAdmin(role);
}
