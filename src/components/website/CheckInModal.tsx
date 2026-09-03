"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { localDateStr } from "@/lib/local-date";
import { STATE_META, type DiaryEntry } from "./DiaryTimeline";

/** 预置情境标签（多选，与服务端 tags 上限一致） */
const PRESET_TAGS = ["熬夜", "换季", "爆痘", "敏感泛红", "日晒", "姨妈期"];
const STATE_KEYS = ["great", "good", "normal", "bad", "terrible"] as const;

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 编辑当日已有记录时传入；新建为 null */
  existing: DiaryEntry | null;
  /** 打卡目标日期（YYYY-MM-DD，默认今天）；补打卡时传过去日期 */
  dateStr?: string;
  /** 保存成功后回调（父级刷新日记列表） */
  onSaved: () => void;
}

/**
 * CheckInModal — 护肤打卡弹层（userId+date 唯一，upsert）
 * 选择肌肤状态 + 情境标签 + 可选备注；支持补打卡（指定过去日期）；
 * 容器/动效与 AccountModal 等全站模态框对齐。
 */
export function CheckInModal({ isOpen, onClose, existing, dateStr, onSaved }: CheckInModalProps) {
  const toast = useToast();
  const [skinState, setSkinState] = useState<string>("good");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const targetDate = dateStr ?? localDateStr(new Date());
  const isToday = targetDate === localDateStr(new Date());
  const targetLabel = new Date(`${targetDate}T00:00:00.000Z`).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 打开时初始化表单（编辑带入旧值；新建重置）
  useEffect(() => {
    if (!isOpen) return;
    setSkinState(existing?.skinState && STATE_META[existing.skinState] ? existing.skinState : "good");
    setTags(existing?.tags?.slice(0, 5) ?? []);
    setNote(existing?.note ?? "");
  }, [isOpen, existing]);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetchWithCsrf("/api/user/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          skinState,
          tags,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("保存未成功");
      toast.success(existing ? "今日记录已更新" : isToday ? "打卡成功" : `已补打卡 ${targetLabel}`);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Diary check-in error:", err);
      toast.error("保存未成功，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LazyMotion features={domAnimation}>
    <AnimatePresence>
      {isOpen && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-modal-title"
          tabIndex={-1}
          className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-sm bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            <div className="px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
              <h2
                id="checkin-modal-title"
                className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em] text-center mb-6"
              >
                {existing ? "编辑今日记录" : isToday ? "记录今日肌肤" : `补打卡 · ${targetLabel}`}
              </h2>

              {/* 肌肤状态（单选） */}
              <div className="flex justify-between gap-1 mb-6">
                {STATE_KEYS.map((key) => {
                  const meta = STATE_META[key];
                  const Icon = meta.icon;
                  const selected = skinState === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSkinState(key)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-1.5 flex-1 py-2 rounded-xl transition-colors cursor-pointer ${
                        selected ? "bg-brand-charcoal/[0.06]" : "hover:bg-brand-charcoal/[0.03]"
                      }`}
                    >
                      <span style={{ color: selected ? meta.color : "#8A8A8A" }}>
                        <Icon className="w-6 h-6" strokeWidth={1.5} />
                      </span>
                      <span
                        className="text-[11px] font-light"
                        style={{ color: selected ? meta.color : "#8A8A8A" }}
                      >
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 情境标签（多选） */}
              <div className="flex flex-wrap gap-2 mb-6">
                {PRESET_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={selected}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-light border transition-colors cursor-pointer ${
                        selected
                          ? "border-brand-charcoal/60 text-brand-charcoal bg-brand-charcoal/[0.06]"
                          : "border-brand-charcoal/[0.12] text-brand-charcoal/55 hover:border-brand-charcoal/30"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* 备注（可选） */}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="今天用了什么、肌肤有什么变化…（选填）"
                className="w-full mb-6 px-4 py-3 text-[13px] font-light text-[#1A1A1A] bg-white border border-brand-charcoal/[0.12] rounded-2xl resize-none focus:outline-none focus:border-brand-charcoal/50 placeholder:text-brand-charcoal/35"
              />

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#5c4937] text-[#FDFBF7] text-[13px] tracking-[0.12em] font-light cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c] disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {existing ? "保存修改" : "完成打卡"}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
    </LazyMotion>
  );
}
