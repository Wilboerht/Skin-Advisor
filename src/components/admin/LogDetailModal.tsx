"use client";

import { X, Copy, Check, Terminal, History, ArrowRight, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { AdminModal } from "@/components/ui/AdminModal";
import { useMounted } from "@/hooks/use-mounted";

interface LogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: any | null;
}

export function LogDetailModal({ isOpen, onClose, log }: LogDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!isOpen && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!mounted) return null;

  const handleCopy = () => {
    if (!log) return;
    navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
    toast.success("内容已复制到剪贴板");
  };

  const renderDiff = () => {
    if (!log) return null;
    const details = log.details;
    if (!details) return null;

    if (details.prev && details.next && typeof details.prev === "object" && typeof details.next === "object") {
      const keys = Array.from(new Set([...Object.keys(details.prev), ...Object.keys(details.next)]));
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-[#1A1A1A]/40" />
            <span className="text-sm font-bold text-[#5E5E5E] uppercase tracking-widest">属性变更对比</span>
          </div>
          <div className="border border-[#E9E9E7] rounded-xl overflow-hidden divide-y divide-[#E9E9E7]">
            {keys.map((key) => {
              const prevVal = details.prev[key];
              const nextVal = details.next[key];
              const isChanged = JSON.stringify(prevVal) !== JSON.stringify(nextVal);
              if (!isChanged) return null;
              return (
                <div key={key} className="grid grid-cols-12 gap-4 bg-white p-3 text-xs">
                  <div className="col-span-12 md:col-span-2 font-mono font-bold text-[#1A1A1A]/40 truncate py-1">
                    {key}
                  </div>
                  <div className="col-span-5 md:col-span-4 bg-rose-50/50 p-2 rounded border border-rose-100 text-rose-700 min-h-[40px] flex items-center overflow-hidden">
                    <div className="truncate w-full line-through opacity-70">
                      {typeof prevVal === "object" ? JSON.stringify(prevVal) : String(prevVal)}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-[#1A1A1A]/30" />
                  </div>
                  <div className="col-span-5 md:col-span-4 bg-emerald-50/50 p-2 rounded border border-emerald-100 text-emerald-700 min-h-[40px] flex items-center overflow-hidden">
                    <div className="truncate w-full font-medium">
                      {typeof nextVal === "object" ? JSON.stringify(nextVal) : String(nextVal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#1A1A1A]/40" />
            <span className="text-sm font-bold text-[#5E5E5E] uppercase tracking-widest">详细数据内容 (JSON)</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-[#1A1A1A]/5 rounded-lg text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60 transition-colors"
            title="复制内容"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 overflow-x-auto border border-[#1A1A1A]/10 shadow-inner max-h-[400px]">
          <pre className="text-xs font-mono text-[#E0DDD5] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="日志详情"
      titleId="log-detail-modal-title"
      subtitle="操作日志记录详情"
      maxWidth="lg"
      headerIcon={
        <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center shadow-lg shadow-[#1A1A1A]/10">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
      }
    >
      <div className="space-y-6">
        {!log ? (
          <p className="text-sm text-[#1A1A1A]/40 text-center py-8">无日志数据</p>
        ) : (
          <>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-[#1A1A1A]/[0.02] border border-[#E9E9E7]">
            <span className="block text-[10px] font-bold text-[#1A1A1A]/50 uppercase mb-1">操作行为</span>
            <span className="text-sm font-semibold text-[#5E5E5E]">{log.action}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#1A1A1A]/[0.02] border border-[#E9E9E7]">
            <span className="block text-[10px] font-bold text-[#1A1A1A]/50 uppercase mb-1">资源标识</span>
            <span className="text-sm font-mono text-[#1A1A1A]/60 truncate">{log.resourceId || "N/A"}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#1A1A1A]/[0.02] border border-[#E9E9E7]">
            <span className="block text-[10px] font-bold text-[#1A1A1A]/50 uppercase mb-1">IP 地址</span>
            <span className="text-sm font-mono text-[#1A1A1A]/60">{log.ip || "Unknown"}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#1A1A1A]/[0.02] border border-[#E9E9E7]">
            <span className="block text-[10px] font-bold text-[#1A1A1A]/50 uppercase mb-1">执行时间</span>
            <span className="text-sm font-semibold text-[#5E5E5E]">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        {renderDiff()}
          </>
        )}
      </div>
    </AdminModal>
  );
}
