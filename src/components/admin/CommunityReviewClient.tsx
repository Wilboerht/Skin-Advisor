"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, Eye, User, Clock, ImageIcon, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ===== 类型 =====

type PostStatus = "pending" | "approved" | "rejected";

interface CommunityPostEntry {
  id: string;
  beforeImage: string | null;
  afterImage: string | null;
  note: string | null;
  personaLabel: string | null;
  status: PostStatus;
  reviewNote: string | null;
  testBonusAwarded: boolean;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
  };
}

interface PaginatedPosts {
  items: CommunityPostEntry[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

const STATUS_LABELS: Record<PostStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "未通过",
};

const STATUS_BADGE: Record<PostStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

// ===== 图片预览弹窗 =====

function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ===== 主组件 =====

export function CommunityReviewClient() {
  const toast = useToast();
  const [posts, setPosts] = useState<CommunityPostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/community/posts?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "加载失败");
      }
      const data: PaginatedPosts = await res.json();
      setPosts(data.items);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleReview = useCallback(
    async (postId: string, action: "approve" | "reject") => {
      try {
        const res = await fetch("/api/admin/community/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, action }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "操作失败");
        }

        toast.success(action === "approve" ? "已通过审核，用户获得 +1 测肤次数" : "已拒绝");

        // 刷新列表
        fetchPosts();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "操作失败");
      }
    },
    [fetchPosts, toast]
  );

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">社区帖子审核</h1>
          <p className="text-sm text-[#999] mt-1">
            审核用户上传的前后对比照与护肤心得 · 通过后自动发放测肤奖励
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                statusFilter === s
                  ? "bg-[#8B7355] text-white border-[#8B7355]"
                  : "bg-white text-[#5E5E5E] border-[#E9E9E7] hover:border-[#8B7355]"
              )}
            >
              {s === "all" ? "全部" : STATUS_LABELS[s]}
              {s === "pending" && total > 0 && statusFilter === "pending" && (
                <span className="ml-1 text-[10px] opacity-70">({total})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#C8A97E]" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={fetchPosts}
            className="mt-4 px-4 py-2 rounded-full text-sm text-[#8B7355] border border-[#8B7355] hover:bg-[#8B7355] hover:text-white transition-colors"
          >
            重试
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="w-12 h-12 text-[#C8A97E]/40 mx-auto mb-4" />
          <p className="text-sm text-[#5E5E5E]">暂无{STATUS_LABELS[statusFilter as PostStatus] || ""}帖子</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border border-[#E9E9E7] bg-white/70 hover:shadow-md transition-shadow"
            >
              {/* 缩略图区 */}
              <div className="flex items-start gap-2 shrink-0">
                {post.beforeImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: post.beforeImage!, alt: "使用前" })}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E9E9E7] hover:ring-2 hover:ring-[#8B7355]/40 transition-all"
                  >
                    <img src={post.beforeImage} alt="使用前" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white">前</span>
                  </button>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-[#F5F2EC] flex items-center justify-center text-[#C8A97E]/50 border border-[#E9E9E7]">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                {post.afterImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: post.afterImage!, alt: "使用后" })}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E9E9E7] hover:ring-2 hover:ring-[#8B7355]/40 transition-all"
                  >
                    <img src={post.afterImage} alt="使用后" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white">后</span>
                  </button>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-[#F5F2EC] flex items-center justify-center text-[#C8A97E]/50 border border-[#E9E9E7]">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* 信息区 */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#1A1A1A] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#999]" />
                    {post.user.name || post.user.email || "匿名用户"}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_BADGE[post.status])}>
                    {STATUS_LABELS[post.status]}
                  </span>
                  {post.personaLabel && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F0EDE1]/60 text-[10px] text-[#8B7355] font-medium">
                      {post.personaLabel}
                    </span>
                  )}
                  {post.testBonusAwarded && (
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-[10px] text-green-600 font-medium">
                      已奖励 +1 测肤
                    </span>
                  )}
                </div>

                {post.note && (
                  <p className="text-sm text-[#5E5E5E] leading-relaxed line-clamp-2">
                    &ldquo;{post.note}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-[#999]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(post.createdAt)}
                  </span>
                  {post.reviewedAt && (
                    <span className="text-[10px] opacity-70">
                      审核于 {formatDateTime(post.reviewedAt)}
                    </span>
                  )}
                  {post.reviewNote && (
                    <span className="text-[#8B7355] text-[10px]">备注：{post.reviewNote}</span>
                  )}
                </div>
              </div>

              {/* 操作区 */}
              {post.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleReview(post.id, "approve")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    通过
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(post.id, "reject")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                    page === p
                      ? "bg-[#8B7355] text-white"
                      : "text-[#5E5E5E] hover:bg-[#F5F2EC]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 图片预览 */}
      {previewImage && (
        <ImagePreview
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

// ===== 工具函数 =====

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
