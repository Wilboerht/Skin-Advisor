"use client";

import { useState, useCallback } from "react";
import { Heart, MessageCircle, ExternalLink, Camera } from "lucide-react";

// ===== 类型定义 =====

export interface XHSPost {
  type: "xhs";
  id: string;
  shareLink: string | null;
  userName: string;
  createdAt: string;
}

export interface DirectPost {
  type: "direct";
  id: string;
  beforeImage: string | null;
  afterImage: string | null;
  note: string | null;
  personaLabel: string | null;
  userName: string;
  createdAt: string;
}

export type CommunityPost = XHSPost | DirectPost;

// ===== 小红书帖子卡片 =====

function XHSCard({ post }: { post: XHSPost }) {
  return (
    <a
      href={post.shareLink || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-2xl border border-[#E9E9E7] bg-white/70 hover:shadow-lg hover:border-[#C8A97E]/40 transition-all duration-300 overflow-hidden"
    >
      {/* 小红书品牌色装饰条 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF2442] via-[#FF6B81] to-[#FF2442] opacity-80" />

      <div className="p-5 pt-6 space-y-3">
        {/* 头部：头像 + 用户名 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF2442]/20 to-[#FF6B81]/20 flex items-center justify-center text-xs text-[#FF2442] font-semibold shrink-0">
            {post.userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#1A1A1A] truncate">{post.userName}</p>
            <p className="text-[11px] text-[#999]">
              {formatRelativeTime(post.createdAt)}
            </p>
          </div>
        </div>

        {/* 小红书标志 */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF2442]/8 text-[11px] text-[#FF2442] font-medium">
            <span className="w-3.5 h-3.5 rounded-full bg-[#FF2442] text-white flex items-center justify-center text-[8px] font-bold">红</span>
            小红书
          </div>
          <span className="text-[11px] text-[#999]">#肌智派送好礼</span>
        </div>

        {/* 底部操作区 */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F5F2EC]">
          <div className="flex items-center gap-3 text-[#999]">
            <span className="inline-flex items-center gap-1 text-xs">
              <Heart className="w-3.5 h-3.5" /> 点赞
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <MessageCircle className="w-3.5 h-3.5" /> 评论
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-[#8B7355] group-hover:text-[#C8A97E] transition-colors">
            查看原文 <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

// ===== 直接上传帖子卡片（前后对比照） =====

function DirectCard({ post }: { post: DirectPost }) {
  const [showAfter, setShowAfter] = useState(false);
  const currentImage = showAfter ? post.afterImage : post.beforeImage;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[#E9E9E7] bg-white/70 hover:shadow-lg hover:border-[#8B7355]/40 transition-all duration-300 overflow-hidden">
      {/* 对比照区域 */}
      <div className="relative aspect-[4/3] bg-[#F9F7F2] overflow-hidden">
        {currentImage ? (
          <img
            src={currentImage}
            alt={showAfter ? "使用后" : "使用前"}
            className="w-full h-full object-cover transition-opacity duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#C8A97E]">
            <Camera className="w-8 h-8 opacity-30" />
          </div>
        )}

        {/* 前后切换按钮 */}
        {post.beforeImage && post.afterImage && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/30 backdrop-blur-sm p-0.5">
            <button
              type="button"
              onClick={() => setShowAfter(false)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                !showAfter ? "bg-white text-[#1A1A1A]" : "text-white/80"
              }`}
            >
              使用前
            </button>
            <button
              type="button"
              onClick={() => setShowAfter(true)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                showAfter ? "bg-white text-[#1A1A1A]" : "text-white/80"
              }`}
            >
              使用后
            </button>
          </div>
        )}

        {/* 派系标签 */}
        {post.personaLabel && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm text-[11px] font-medium text-[#8B7355] shadow-sm">
            {post.personaLabel}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="p-5 space-y-3">
        {/* 用户信息 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B7355]/20 to-[#C8A97E]/20 flex items-center justify-center text-xs text-[#8B7355] font-semibold shrink-0">
            {post.userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#1A1A1A] truncate">{post.userName}</p>
            <p className="text-[11px] text-[#999]">
              {formatRelativeTime(post.createdAt)}
            </p>
          </div>
        </div>

        {/* 心得 */}
        {post.note && (
          <p className="text-sm text-[#5E5E5E] leading-relaxed line-clamp-3">
            &ldquo;{post.note}&rdquo;
          </p>
        )}

        {/* 真实用户反馈标识 */}
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0EDE1]/60 text-[10px] text-[#8B7355] font-medium">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L10 5l4 0.5-3 3 1 4.5L8 11l-4 2 1-4.5-3-3L6 5 8 1z" fill="#C8A97E" opacity="0.7"/>
          </svg>
          真实用户反馈
        </div>
      </div>
    </div>
  );
}

// ===== 主图库组件 =====

interface CommunityGalleryProps {
  initialPosts: CommunityPost[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export default function CommunityGallery({ initialPosts, pagination }: CommunityGalleryProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [page, setPage] = useState(pagination.page);
  const [totalPages, setTotalPages] = useState(pagination.totalPages);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/community/posts?page=${nextPage}&limit=12`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.items]);
      setPage(nextPage);
      setTotalPages(data.pagination.totalPages);
    } catch {
      // 静默降级
    } finally {
      setLoading(false);
    }
  }, [loading, page, totalPages]);

  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <Camera className="w-12 h-12 text-[#C8A97E]/40 mx-auto mb-4" />
        <p className="text-[#5E5E5E] text-sm">还没有用户分享，快来成为第一个吧 🌟</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 网格布局 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post) =>
          post.type === "xhs" ? (
            <XHSCard key={`xhs-${post.id}`} post={post} />
          ) : (
            <DirectCard key={`direct-${post.id}`} post={post} />
          )
        )}
      </div>

      {/* 加载更多 */}
      {page < totalPages && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="px-8 py-3 rounded-full border-2 border-[#8B7355] text-[#8B7355] hover:bg-[#8B7355] hover:text-white transition-all duration-300 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "加载中..." : "查看更早的分享"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== 工具函数 =====

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(diff / 86400000);
  if (days < 30) return `${days} 天前`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;

  return `${Math.floor(days / 365)} 年前`;
}
