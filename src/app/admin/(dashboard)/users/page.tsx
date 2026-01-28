
import prisma from "@/lib/prisma";
import Image from "next/image";
import { Search, MoreHorizontal, User as UserIcon } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: { advisorSessions: true }
            },
            advisorSessions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    createdAt: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif text-[#1A1A1A]">Users</h1>
                    <p className="text-[#1A1A1A]/60 text-sm mt-1">Manage your registered users and view their activity.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="pl-9 pr-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-full text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]/20 w-full sm:w-64 transition-all hover:bg-[#1A1A1A]/5 focus:bg-white"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#1A1A1A]/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-[#1A1A1A]/5 text-[#1A1A1A]/40 text-xs font-medium uppercase tracking-wider">
                                <th className="px-6 py-4 font-normal">User</th>
                                <th className="px-6 py-4 font-normal">Created</th>
                                <th className="px-6 py-4 font-normal">Last Active</th>
                                <th className="px-6 py-4 font-normal text-right">Tests Taken</th>
                                <th className="px-6 py-4 font-normal text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A1A]/5">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[#1A1A1A]/40">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="group hover:bg-[#FDFBF7] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center text-[#1A1A1A]/60">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-[#1A1A1A]">{user.name || "Anonymous User"}</div>
                                                    <div className="text-xs text-[#1A1A1A]/40">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[#1A1A1A]/60">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-[#1A1A1A]/60">
                                            {user.advisorSessions[0]
                                                ? new Date(user.advisorSessions[0].createdAt).toLocaleDateString()
                                                : "-"
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums text-[#1A1A1A]">
                                            {user._count.advisorSessions}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors rounded-full hover:bg-[#1A1A1A]/5">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
