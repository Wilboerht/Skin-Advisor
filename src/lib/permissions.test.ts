import { describe, it, expect } from "vitest";
import {
    UserRole,
    AdminRole,
    isValidUserRole,
    isValidAdminRole,
    isDisabledUser,
    canManageAdmins,
    canViewFullPII,
    canExportPII,
} from "./permissions";

describe("permissions", () => {
    describe("user roles", () => {
        it("accepts valid user roles", () => {
            expect(isValidUserRole(UserRole.USER)).toBe(true);
            expect(isValidUserRole(UserRole.DISABLED)).toBe(true);
        });

        it("rejects invalid user roles", () => {
            expect(isValidUserRole("admin")).toBe(false);
            expect(isValidUserRole("")).toBe(false);
        });

        it("detects disabled user", () => {
            expect(isDisabledUser(UserRole.DISABLED)).toBe(true);
            expect(isDisabledUser(UserRole.USER)).toBe(false);
        });
    });

    describe("admin roles", () => {
        it("accepts valid admin roles", () => {
            expect(isValidAdminRole(AdminRole.SUPER_ADMIN)).toBe(true);
            expect(isValidAdminRole(AdminRole.ADMIN)).toBe(true);
        });

        it("rejects invalid admin roles", () => {
            expect(isValidAdminRole("user")).toBe(false);
            expect(isValidAdminRole("owner")).toBe(false);
        });

        it("only super_admin can manage admins", () => {
            expect(canManageAdmins(AdminRole.SUPER_ADMIN)).toBe(true);
            expect(canManageAdmins(AdminRole.ADMIN)).toBe(false);
        });

        it("only super_admin can view full PII and export", () => {
            expect(canViewFullPII(AdminRole.SUPER_ADMIN)).toBe(true);
            expect(canViewFullPII(AdminRole.ADMIN)).toBe(false);
            expect(canExportPII(AdminRole.SUPER_ADMIN)).toBe(true);
            expect(canExportPII(AdminRole.ADMIN)).toBe(false);
        });
    });
});
