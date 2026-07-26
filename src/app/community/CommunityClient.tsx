"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Camera, Heart, ShieldCheck, Sparkles } from "lucide-react";
import CommunityGallery from "@/components/community/CommunityGallery";
import ShareStoryModal from "@/components/community/ShareStoryModal";
import type { CommunityPost } from "@/components/community/CommunityGallery";

interface CommunityClientProps {
  initialPosts: CommunityPost[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export default function CommunityClient({ initialPosts, pagination }: CommunityClientProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen bg-[#FAF9F6] selection:bg-[#C8A97E]/20">
      {/* ===== Hero 区 ===== */}
      <section className="relative pt-20 pb-16 px-6 md:px-12 lg:px-20 overflow-hidden">
        {/* 装饰背景 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#F0EDE1]/60 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          {/* 标签 */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C8A97E]/10 border border-[#C8A97E]/20 text-xs font-medium text-[#8B7355]">
            <ShieldCheck className="w-3.5 h-3.5" />
            真实用户反馈
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1A1A1A] leading-tight tracking-tight">
            肌智派社区
            <span className="block text-[#8B7355] text-xl md:text-2xl font-medium mt-2">
              #肌智派送好礼
            </span>
          </h1>

          <p className="text-[#5E5E5E] text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            真实用户分享的护肤前后对比与心得。<br />
            <span className="text-[#8B7355] font-medium">
              分享你的故事，审核通过后获得 +1 次测肤机会 ✨
            </span>
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#8B7355] text-white text-sm font-semibold hover:bg-[#6B5B45] transition-all duration-300 shadow-md shadow-[#8B7355]/20"
            >
              <Camera className="w-4 h-4" />
              分享我的故事
            </button>
            <Link
              href="/gift"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#8B7355] text-[#8B7355] text-sm font-semibold hover:bg-[#8B7355] hover:text-white transition-all duration-300"
            >
              <Sparkles className="w-4 h-4" />
              参与活动
            </Link>
          </div>

          {/* 数据亮点 */}
          <div className="flex items-center justify-center gap-8 md:gap-12 pt-6">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[#8B7355]">
                {formatCount(pagination.total)}
              </div>
              <div className="text-xs text-[#999] mt-1">真实分享</div>
            </div>
            <div className="w-px h-10 bg-[#E9E9E7]" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[#8B7355] flex items-center justify-center gap-1">
                <Heart className="w-5 h-5 fill-[#C8A97E] text-[#C8A97E]" />
                100%
              </div>
              <div className="text-xs text-[#999] mt-1">真实用户</div>
            </div>
            <div className="w-px h-10 bg-[#E9E9E7]" />
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[#8B7355]">+1</div>
              <div className="text-xs text-[#999] mt-1">测肤奖励</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 信任标识栏 ===== */}
      <section className="pb-10 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 text-xs text-[#999]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8B7355]" />
              全部来自真实用户
            </span>
            <span>·</span>
            <span>所有分享均经过人工审核</span>
            <span>·</span>
            <span>数据脱敏处理，保护隐私</span>
          </div>
        </div>
      </section>

      {/* ===== 内容区 ===== */}
      <section className="pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          {/* 小红书专题提示 */}
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-[#FF2442]/5 to-transparent border border-[#FF2442]/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF2442]/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#FF2442]">红</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">
                小红书 #肌智派送好礼 话题精选
              </p>
              <p className="text-xs text-[#999]">
                以下内容来自真实用户在小红书的分享，已获用户授权展示
              </p>
            </div>
          </div>

          <CommunityGallery
            key={refreshKey}
            initialPosts={initialPosts}
            pagination={pagination}
          />
        </div>
      </section>

      {/* ===== 底部 CTA ===== */}
      <section className="pb-16 px-6">
        <div className="max-w-lg mx-auto text-center p-8 rounded-2xl bg-gradient-to-br from-[#F0EDE1]/40 to-[#C8A97E]/10 border border-[#C8A97E]/20">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">
            还没测试肌肤形象？
          </h3>
          <p className="text-sm text-[#5E5E5E] mb-5">
            完成测肤发现你的专属派系，分享结果参与社区互动
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/questions"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#8B7355] text-white text-sm font-semibold hover:bg-[#6B5B45] transition-all duration-300"
            >
              开始测肤
            </Link>
            <Link
              href="/skin-types"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#E9E9E7] text-[#5E5E5E] text-sm font-medium hover:border-[#8B7355] hover:text-[#8B7355] transition-all duration-300"
            >
              了解派系
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 上传弹窗 ===== */}
      <ShareStoryModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={handleUploadSuccess}
      />
    </main>
  );
}

/** 格式化数字（万+ 表示） */
function formatCount(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return String(n);
}
