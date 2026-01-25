
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, Edit, Trash2, CheckCircle, XCircle, FileText } from "lucide-react";

export default async function QuestionsPage() {
    const questions = await prisma.advisorQuestion.findMany({
        orderBy: { order: "asc" },
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Questions Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage survey questions and flow</p>
                </div>
                <Link
                    href="/admin/questions/new"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Question
                </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-semibold w-20">Order</th>
                                <th className="px-6 py-4 font-semibold">Question</th>
                                <th className="px-6 py-4 font-semibold">Field Name</th>
                                <th className="px-6 py-4 font-semibold">Type</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {questions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <FileText className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-base font-medium">No questions found</p>
                                            <p className="text-xs text-slate-400 mt-1">Get started by creating a new question.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                questions.map((q) => (
                                    <tr key={q.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-slate-500">{q.order}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{q.question}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {(JSON.parse(q.options as string) as any[]).length} options
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-blue-600 bg-blue-50/50 rounded inline-block my-4 mx-6 w-fit px-2 py-0.5 border border-blue-100">
                                            {q.fieldName}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 capitalize">{q.type}</td>
                                        <td className="px-6 py-4">
                                            {q.active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                                    <CheckCircle className="mr-1 h-3 w-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    <XCircle className="mr-1 h-3 w-3" />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors" title="Edit">
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button className="p-2 hover:bg-red-50 rounded-md text-red-500 transition-colors" title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
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
