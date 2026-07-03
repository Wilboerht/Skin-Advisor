"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Gift, Users, Sparkles, AlertCircle, Loader2 } from "lucide-react"
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar"

interface CampaignData {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  coverImage: string | null
  startDate: string
  endDate: string
  drawDate: string | null
  prizes: Array<{ name: string; image: string; quantity: number; description?: string }>
  shareText: string | null
  rules: string | null
  maxEntries: number
  entryCount: number
  winnerIds: string[] | null
}

type PageState = "loading" | "no_campaign" | "show_campaign" | "error"

export default function GiftPage() {
  const [pageState, setPageState] = useState<PageState>("loading")
  const [campaign, setCampaign] = useState<CampaignData | null>(null)

  const CHARACTER_TYPES = ["ageless", "combination", "desert", "guardian", "luxury", "minimalist", "oily", "sensitive"] as const
  const CHARACTER_GENDERS = ["female", "male"] as const
  const randomCharacterImage = useMemo(() => {
    const type = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)]
    const gender = CHARACTER_GENDERS[Math.floor(Math.random() * CHARACTER_GENDERS.length)]
    return `/images/character/${type}/${type}_${gender}.png`
  }, [])

  const fetchCampaign = useCallback(async () => {
    setPageState("loading")
    try {
      const res = await fetch("/api/campaign")
      const data = await res.json()
      if (!data.campaign) {
        setPageState("no_campaign")
        return
      }
      setCampaign(data.campaign)
      setPageState("show_campaign")
    } catch {
      setPageState("error")
    }
  }, [])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
  }

  return (
    <main className="relative min-h-screen flex flex-col text-[#1A1A1A] bg-[#F8F7F3] overflow-hidden">
      <WebsiteNavbar />

      <div className="flex-1">
        {/* Hero */}
      <section className="relative pt-24 md:pt-40 pb-18 px-6 md:px-12 lg:px-20">
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-5 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
            肌智派送好礼
          </h1>
          <p className="text-[15px] md:text-base text-[#5E5E5E] font-light max-w-xl mx-auto leading-relaxed mb-5 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
            分享你的肌肤形象类型，与 NIHPLOD 一起探索护肤之美，解锁限定礼遇。
          </p>

          {/* 状态信息 */}
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
            {pageState === "loading" && (
              <div className="inline-flex items-center gap-2 text-sm text-[#5E5E5E]">
                <Loader2 className="w-4 h-4 text-[#8B7355] animate-spin" />
                正在加载活动信息…
              </div>
            )}

            {pageState === "no_campaign" && (
              <div className="inline-flex items-center gap-2 text-sm text-[#5E5E5E]">
                <Sparkles className="w-4 h-4 text-[#8B7355]" />
                <span>下一期活动筹备中，敬请期待</span>
              </div>
            )}

            {pageState === "error" && (
              <div className="inline-flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                加载失败，请刷新页面重试
              </div>
            )}

            {pageState === "show_campaign" && campaign && (
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
                <div className={`flex items-center gap-2 ${new Date() >= new Date(campaign.startDate) ? "text-xs" : "text-sm"} text-[#5E5E5E]`}>
                  <Users className="w-4 h-4 text-[#8B7355]" />
                  <span>已参与 {campaign.entryCount} 人{campaign.maxEntries > 0 ? ` / ${campaign.maxEntries}` : ""}</span>
                </div>
                {campaign.drawDate && (
                  <div className={`flex items-center gap-2 ${new Date() >= new Date(campaign.startDate) ? "text-xs" : "text-sm"} text-[#5E5E5E]`}>
                    <Sparkles className="w-4 h-4 text-[#8B7355]" />
                    <span>开奖时间：{formatDate(campaign.drawDate)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 无活动 - 玩法预告 */}
      {pageState === "no_campaign" && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[6fr_4fr] gap-8 md:gap-12 items-center max-w-4xl mx-auto mb-18">
              {/* 左侧引导文案 */}
              <div className="flex justify-center">
                <Image
                  src="/images/gift-badge.png"
                  alt="肌智派送好礼"
                  width={200}
                  height={150}
                  className="w-96 h-auto object-contain"
                  unoptimized
                />
              </div>

              {/* 右侧步骤 */}
              <div className="space-y-4">
                {[
                  { step: "01", title: "完成测肤", desc: "获取你的专属肌肤形象类型" },
                  { step: "02", title: "分享小红书", desc: "发布海报并 @NIHPLOD" },
                  { step: "03", title: "解锁礼遇", desc: "提交分享链接，等待开奖" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-transparent border border-[#1B3A5C] flex items-center justify-center text-sm font-medium text-[#1B3A5C]">
                      {parseInt(item.step)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-[#1A1A1A] mb-1">{item.title}</h3>
                      <p className="text-[13px] text-[#5E5E5E] leading-[1.85]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white"
              >
                <span>开始测肤</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
              <Link
                href="/skin-types"
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#8B7355] text-[#8B7355] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#8B7355] hover:text-white"
              >
                <span>了解肌肤类型</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 错误状态 */}
      {pageState === "error" && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-md mx-auto text-center">
            <div className="rounded-2xl border border-[rgba(61,68,48,0.08)] bg-[#FAF9F6] p-5 md:p-9">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-lg font-serif text-[#1A1A1A] mb-2">活动信息加载失败</h2>
              <p className="text-sm text-[#5E5E5E]/80 mb-6">请检查网络连接后刷新页面，或稍后再试。</p>
              <button
                onClick={() => fetchCampaign()}
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white"
              >
                <Loader2 className="w-4 h-4" />
                <span>重新加载</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 奖品展示 */}
      {pageState === "show_campaign" && campaign && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-[#C9B896] p-6 md:p-8 relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-block px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#1B3A5C] bg-white rounded-full border border-[#C9B896] whitespace-nowrap">
                  本期好礼
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 md:gap-6 place-items-start text-center mt-4">
                {Array.isArray(campaign.prizes) && campaign.prizes.map((prize, i) => (
                  <div key={i} className="flex flex-col items-center w-full">
                    <div className="relative w-full aspect-square max-w-[80px] p-3 flex items-center justify-center mb-3">
                      {prize.image ? (
                        <Image
                          src={prize.image}
                          alt={prize.name}
                          fill
                          className="object-contain p-2"
                        />
                      ) : (
                        <Gift className="w-8 h-8 text-[#8B7355]/30" />
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-[#1A1A1A] mb-1 leading-tight">{prize.name}</h3>
                    {prize.description && (
                      <p className="text-xs text-[#5E5E5E] leading-relaxed mb-1">{prize.description}</p>
                    )}
                    <p className="text-xs text-[#8B7355]">共 {prize.quantity} 份</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 活动规则 */}
      {pageState === "show_campaign" && campaign && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[6fr_4fr] gap-8 md:gap-12 items-center max-w-4xl mx-auto mb-18">
              {/* 左侧引导文案 */}
              <div className="flex justify-center">
                <Image
                  src="/images/gift-badge.png"
                  alt="肌智派送好礼"
                  width={200}
                  height={150}
                  className="w-96 h-auto object-contain"
                  unoptimized
                />
              </div>

              {/* 右侧步骤 */}
              <div className="space-y-4">
                {[
                  { step: "01", title: "生成专属海报", desc: "点击下方按钮，生成您的专属活动海报与小红书分享文案。" },
                  { step: "02", title: "分享到小红书", desc: "将海报发布到您的小红书账号，附上活动文案并 @NIHPLOD" },
                  { step: "03", title: "等待开奖", desc: `审核通过后即可参与抽奖，开奖时间：${campaign.drawDate ? formatDate(campaign.drawDate) : "敬请期待"}。` },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-transparent border border-[#1B3A5C] flex items-center justify-center text-sm font-medium text-[#1B3A5C]">
                      {parseInt(item.step)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-[#1A1A1A] mb-1">{item.title}</h3>
                      <p className="text-[13px] text-[#5E5E5E] leading-[1.85]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white"
              >
                <span>开始测肤</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
              <Link
                href="/skin-types"
                className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#8B7355] text-[#8B7355] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#8B7355] hover:text-white"
              >
                <span>了解肌肤类型</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      </div>

      <footer className="relative z-10 pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center border-t border-[rgba(61,68,48,0.06)]">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-[10px] md:text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
              隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">
              服务条款
            </Link>
          </div>

        </div>
      </footer>
    </main>
  )
}
