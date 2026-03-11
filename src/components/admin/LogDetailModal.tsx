"use client";

import { X, Copy, Check, Terminal, History, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface LogDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: any | null;
}

export function LogDetailModal({ isOpen, onClose, log }: LogDetailModalProps) {
    const [copied, setCopied] = useState(false);
    const toast = useToast();

    if (!isOpen || !log) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("内容已复制到剪贴板");
    };

    // Helper to render diff if available
    const renderDiff = () => {
        const details = log.details;
        if (!details) return null;

        // If it's a standard diff format { prev, next }
        if (details.prev && details.next && typeof details.prev === 'object' && typeof details.next === 'object') {
            const keys = Array.from(new Set([...Object.keys(details.prev), ...Object.keys(details.next)]));
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">属性变更对比</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                        {keys.map(key => {
                            const prevVal = details.prev[key];
                            const nextVal = details.next[key];
                            const isChanged = JSON.stringify(prevVal) !== JSON.stringify(nextVal);

                            if (!isChanged) return null;

                            return (
                                <div key={key} className="grid grid-cols-12 gap-4 bg-white p-3 text-xs">
                                    <div className="col-span-12 md:col-span-2 font-mono font-bold text-slate-400 truncate py-1">
                                        {key}
                                    </div>
                                    <div className="col-span-5 md:col-span-4 bg-rose-50/50 p-2 rounded border border-rose-100 text-rose-700 min-h-[40px] flex items-center overflow-hidden">
                                        <div className="truncate w-full line-through opacity-70">
                                            {typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal)}
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-center">
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                    </div>
                                    <div className="col-span-5 md:col-span-4 bg-emerald-50/50 p-2 rounded border border-emerald-100 text-emerald-700 min-h-[40px] flex items-center overflow-hidden">
                                        <div className="truncate w-full font-medium">
                                            {typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // Default: Pretty JSON
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">详细数据内容 (JSON)</span>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        title="复制内容"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-800 shadow-inner max-h-[400px]">
                    <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                        {JSON.stringify(details, null, 2)}
                    </pre>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">日志详情</h2>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Log Record Payload</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {/* Log Meta */}
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">操作行为</span>
                            <span className="text-sm font-semibold text-slate-700">{log.action}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">资源标识</span>
                            <span className="text-sm font-mono text-slate-600 truncate">{log.resourceId || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">IP 地址</span>
                            <span className="text-sm font-mono text-slate-600">{log.ip || 'Unknown'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">执行时间</span>
                            <span className="text-sm font-semibold text-slate-700">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Diff/JSON */}
                    {renderDiff()}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}
