"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, Camera, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ShareStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareStoryModal({ isOpen, onClose, onSuccess }: ShareStoryModalProps) {
  const { user } = useAuth();

  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File, target: "before" | "after") => {
      setError(null);

      // 校验
      if (!file.type.startsWith("image/")) {
        setError("请上传图片格式文件");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("图片大小不能超过 10MB");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload/community", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "上传失败");
        }

        const data = await res.json();
        if (target === "before") {
          setBeforeImage(data.url);
        } else {
          setAfterImage(data.url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败，请重试");
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!beforeImage && !afterImage) {
      setError("请至少上传一张照片");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beforeImage,
          afterImage,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "提交失败");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        setBeforeImage(null);
        setAfterImage(null);
        setNote("");
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }, [beforeImage, afterImage, note, onSuccess, onClose]);

  if (!isOpen) return null;

  // 未登录状态
  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[#5E5E5E] mb-4">请先登录后再分享你的护肤故事</p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[#8B7355] text-white text-sm font-medium hover:bg-[#6B5B45] transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7] bg-white/95 backdrop-blur-sm rounded-t-2xl">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">分享你的护肤故事</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F5F2EC] transition-colors"
          >
            <X className="w-5 h-5 text-[#5E5E5E]" />
          </button>
        </div>

        {/* 成功状态 */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">提交成功！</h3>
            <p className="text-sm text-[#5E5E5E] mb-4">
              审核通过后你将获得 <span className="text-[#8B7355] font-semibold">+1 次测肤机会</span> ✨
            </p>
            <p className="text-xs text-[#999]">审核结果将尽快推送通知</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* 激励提示 */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#F0EDE1]/50 to-[#C8A97E]/10 border border-[#C8A97E]/20">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#C8A97E]/20 flex items-center justify-center">
                <span className="text-xl">🎁</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#8B7355]">分享前后对比 · 解锁额外测肤</p>
                <p className="text-xs text-[#5E5E5E]">审核通过后即可获得 +1 次测肤机会</p>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* 图片上传区 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 使用前 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#5E5E5E]">使用前照片</label>
                <input
                  ref={beforeInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, "before");
                    e.target.value = "";
                  }}
                />
                {beforeImage ? (
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-[#E9E9E7] group">
                    <img src={beforeImage} alt="使用前" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBeforeImage(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => beforeInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full aspect-square rounded-xl border-2 border-dashed border-[#E9E9E7] hover:border-[#C8A97E] transition-colors flex flex-col items-center justify-center gap-2 text-[#C8A97E]"
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6" />
                        <span className="text-xs">上传照片</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 使用后 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#5E5E5E]">使用后照片</label>
                <input
                  ref={afterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, "after");
                    e.target.value = "";
                  }}
                />
                {afterImage ? (
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-[#E9E9E7] group">
                    <img src={afterImage} alt="使用后" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAfterImage(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => afterInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full aspect-square rounded-xl border-2 border-dashed border-[#E9E9E7] hover:border-[#C8A97E] transition-colors flex flex-col items-center justify-center gap-2 text-[#C8A97E]"
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">上传照片</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 心得输入 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#5E5E5E]">
                分享你的护肤心得 <span className="text-[#999]">（选填）</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="例如：用了两周面霜后，皮肤明显变水润了..."
                className="w-full px-4 py-3 rounded-xl border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#C8A97E] focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]/20 resize-none"
              />
              <p className="text-right text-[11px] text-[#999]">{note.length}/1000</p>
            </div>

            {/* 提交按钮 */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading || (!beforeImage && !afterImage)}
              className="w-full py-3 rounded-full bg-[#8B7355] text-white text-sm font-semibold hover:bg-[#6B5B45] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交分享"
              )}
            </button>

            <p className="text-center text-[11px] text-[#999] leading-relaxed">
              提交后将由我们审核，审核通过后展示在社区并获得额外测肤次数
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
