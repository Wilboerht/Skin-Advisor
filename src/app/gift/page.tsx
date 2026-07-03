"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Gift, Clock, Users, Upload, CheckCircle2, Sparkles, AlertCircle, Loader2, Copy, Ticket } from "lucide-react"
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar"
import { useAuth } from "@/hooks/useAuth"
import { useAuthModal } from "@/components/auth/AuthModalContext"

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

interface EntryData {
  id: string
  status: string
  lotteryCode: string | null
  prizeName: string | null
  proofImage: string | null
  shareLink: string | null
  createdAt: string
  verifiedAt: string | null
  reviewNote: string | null
}

type PageState = "loading" | "no_campaign" | "show_campaign" | "error"

export default function GiftPage() {
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()

  const [pageState, setPageState] = useState<PageState>("loading")
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [entry, setEntry] = useState<EntryData | null>(null)

  // Participation form
  const [shareLink, setShareLink] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [copiedShareText, setCopiedShareText] = useState(false)

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

  const fetchEntry = useCallback(async (campaignId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/campaign/entry?campaignId=${campaignId}`)
      const data = await res.json()
      setEntry(data.hasEntry && data.entry ? data.entry : null)
    } catch {
      // Silently fail
    }
  }, [user])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  useEffect(() => {
    if (campaign && user) {
      fetchEntry(campaign.id)
    } else if (!user) {
      setEntry(null)
    }
  }, [campaign, user, fetchEntry])

  const handleSubmit = async () => {
    if (!campaign || !user) return
    setSubmitting(true)
    setSubmitError("")

    try {
      const res = await fetch("/api/campaign/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          shareLink: shareLink || undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.code === "LOGIN_REQUIRED") {
          openAuthModal("login")
          return
        }
        if (data.code === "ALREADY_ENTERED") {
          setSubmitError("您已参与本次活动，请勿重复提交")
          fetchEntry(campaign.id)
          return
        }
        setSubmitError(data.error || "提交失败，请重试")
        return
      }

      setSubmitSuccess(true)
      setEntry(data.entry)
    } catch {
      setSubmitError("网络错误，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyShareText = () => {
    if (!campaign?.shareText) return
    const text = campaign.shareText.replaceAll("{{nickname}}", user?.name || "用户")
    navigator.clipboard.writeText(text).then(() => {
      setCopiedShareText(true)
      setTimeout(() => setCopiedShareText(false), 2000)
    }).catch(() => {})
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
  }

  // Status badge
  const statusLabels: Record<string, string> = {
    pending: "审核中",
    verified: "已通过",
    rejected: "未通过",
    won: "已中奖",
  }
  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    verified: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    won: "bg-purple-100 text-purple-700",
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
            <div className="text-center mb-8 md:mb-10">
              <span className="inline-block px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#1B3A5C] bg-[#1B3A5C]/[0.04] rounded-full border border-[#1B3A5C]/10">
                本期好礼
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 md:gap-6 place-items-start text-center">
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
                  { step: "01", title: "生成专属海报", desc: "点击下方按钮，生成您的专属活动海报与小红书分享文案" },
                  { step: "02", title: "分享到小红书", desc: "将海报发布到您的小红书账号，附上活动文案并 @NIHPLOD" },
                  { step: "03", title: "提交参与信息", desc: "在本页填写您的小红书分享链接，提交后等待审核" },
                  { step: "04", title: "等待开奖", desc: `审核通过后即可参与抽奖，开奖时间：${campaign.drawDate ? formatDate(campaign.drawDate) : "敬请期待"}` },
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

      {/* CTA 参与区域 */}
      {pageState === "show_campaign" && campaign && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-[rgba(61,68,48,0.08)] bg-[#FAF9F6] p-5 md:p-9">
              {/* 未登录 */}
              {!user && (
                <div className="text-center space-y-5">
                  <div className="w-14 h-14 rounded-full bg-[#8B7355]/10 flex items-center justify-center mx-auto">
                    <Gift className="w-6 h-6 text-[#8B7355]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">登录后参与活动</h3>
                    <p className="text-sm text-[#5E5E5E]">登录您的 NIHPLOD 账户，即可参与肌智派送好礼活动</p>
                  </div>
                  <button
                    onClick={() => openAuthModal("login")}
                    className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white"
                  >
                    立即登录
                    <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                  </button>
                </div>
              )}

              {/* 已参与 - 显示状态 */}
              {user && entry && (
                <div className="text-center space-y-5">
                  <div className="flex justify-center">
                    {entry.status === "won" ? (
                      <Sparkles className="w-12 h-12 text-purple-500" />
                    ) : entry.status === "verified" ? (
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                    ) : entry.status === "rejected" ? (
                      <AlertCircle className="w-12 h-12 text-red-400" />
                    ) : (
                      <Clock className="w-12 h-12 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-2">
                      {entry.status === "won" ? "恭喜中奖！" : "您已成功参与"}
                    </h3>
                    <div className="flex flex-col items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[entry.status] || "bg-gray-100 text-gray-600"}`}>
                        {statusLabels[entry.status] || entry.status}
                      </span>
                      {entry.lotteryCode && (
                        <div className="flex items-center gap-2 mt-1">
                          <Ticket className="w-4 h-4 text-[#8B7355]" />
                          <span className="text-sm font-mono text-[#3D4430] tracking-wider">{entry.lotteryCode}</span>
                        </div>
                      )}
                      {entry.prizeName && (
                        <p className="text-sm text-[#8B7355] mt-1">中奖奖品：{entry.prizeName}</p>
                      )}
                      {entry.reviewNote && (
                        <p className="text-xs text-[#5E5E5E]/70 mt-1 bg-[#F0EDE1]/50 px-3 py-1.5 rounded-lg max-w-xs">
                          {entry.reviewNote}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-[#5E5E5E]/60 mt-4">提交时间：{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              )}

              {/* 未参与 - 参与表单 */}
              {user && !entry && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-[#8B7355]/10 flex items-center justify-center mx-auto mb-4">
                      <Gift className="w-6 h-6 text-[#8B7355]" />
                    </div>
                    <h3 className="text-lg font-serif text-[#1A1A1A] mb-1">参与活动</h3>
                    <p className="text-sm text-[#5E5E5E]">请先分享到小红书，然后提交分享链接</p>
                  </div>

                  {/* 分享文案 */}
                  {campaign.shareText && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#5E5E5E] tracking-wide">小红书分享文案（点击复制）</label>
                      <div className="relative">
                        <div
                          onClick={handleCopyShareText}
                          className="w-full p-4 rounded-xl border border-[rgba(61,68,48,0.1)] bg-[#F0EDE1]/50 text-sm text-[#3D4430] leading-relaxed cursor-pointer hover:bg-[#F0EDE1] transition-colors group"
                        >
                          {campaign.shareText.replace("{{nickname}}", user?.name || "用户")}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy className="w-4 h-4 text-[#8B7355]" />
                          </div>
                        </div>
                        {copiedShareText && (
                          <p className="text-xs text-green-600 mt-1">已复制到剪贴板 ✓</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 小红书链接 */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#5E5E5E] tracking-wide">
                      小红书分享链接 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      value={shareLink}
                      onChange={(e) => setShareLink(e.target.value)}
                      placeholder="https://www.xiaohongshu.com/..."
                      className="w-full px-4 py-3 rounded-xl border border-[rgba(61,68,48,0.15)] bg-white text-sm text-[#1A1A1A] placeholder-[#5E5E5E]/40 focus:outline-none focus:border-[#3D4430]/40 focus:ring-1 focus:ring-[#3D4430]/20 transition-all"
                    />
                  </div>

                  {/* 联系信息（可选） */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#5E5E5E] tracking-wide">姓名（选填）</label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="用于中奖联系"
                        className="w-full px-4 py-3 rounded-xl border border-[rgba(61,68,48,0.15)] bg-white text-sm text-[#1A1A1A] placeholder-[#5E5E5E]/40 focus:outline-none focus:border-[#3D4430]/40 focus:ring-1 focus:ring-[#3D4430]/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#5E5E5E] tracking-wide">手机号（选填）</label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="用于中奖联系"
                        className="w-full px-4 py-3 rounded-xl border border-[rgba(61,68,48,0.15)] bg-white text-sm text-[#1A1A1A] placeholder-[#5E5E5E]/40 focus:outline-none focus:border-[#3D4430]/40 focus:ring-1 focus:ring-[#3D4430]/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* 提交按钮 */}
                  {submitError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {submitError}
                    </div>
                  )}
                  {submitSuccess ? (
                    <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-50 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      提交成功！请等待审核
                    </div>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !shareLink.trim()}
                      className="w-full flex items-center justify-center gap-2 px-8 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1B3A5C] hover:text-white transition-all duration-500"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          提交中…
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          提交参与
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-center text-[10px] text-[#5E5E5E]/50">
                    提交后需等待管理员审核，审核通过后即成功参与抽奖
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 活动说明 */}
      {(pageState === "show_campaign" || pageState === "no_campaign") && (
        <section className="relative z-10 pb-18 px-6 md:px-12 lg:px-20">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">活动说明</h3>
            <div className="space-y-2 text-xs text-[#5E5E5E]/80 leading-relaxed">
              <p>本活动由 NIHPLOD 主办，最终解释权归 NIHPLOD 所有。</p>
              <p>奖品以实物为准，数量有限，送完即止。每位用户仅限参与一次。</p>
              <p>参与活动即表示同意活动规则，如发现作弊或违规行为，主办方有权取消参与资格。</p>
            </div>
          </div>
        </section>
      )}

      </div>

      {/* 页脚 */}
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
